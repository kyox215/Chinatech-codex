// Opt-in local benchmark and access-control regression. Never accepts cloud URLs.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import ts from "typescript";

const config=JSON.parse(readFileSync(".local/backend/connection.private.json","utf8"));
for(const [field,port] of [["API_URL","55421"],["DB_URL","55422"]]){
  const url=new URL(config[field]);assert.ok(["127.0.0.1","localhost"].includes(url.hostname)&&url.port===port,"Only the isolated rebuild stack is accepted");
}
const origins=["http://localhost:3131","http://localhost:3132"];
const sql=postgres(config.DB_URL,{max:1,prepare:false});
const admin=createClient(config.API_URL,config.SECRET_KEY||config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const stores=[randomUUID(),randomUUID()];const users=[];const checks=[];const samples=[];
const password="Ct"+randomBytes(20).toString("hex");const suffix=randomBytes(5).toString("hex");
const permission=["repairs.view","repairs.edit","customers.view","retail.view","financial.read","settings.edit","staff.manage"];
const modules=new Map();
function library(name){
  if(modules.has(name))return modules.get(name);
  const code=ts.transpileModule(readFileSync("lib/"+name+".ts","utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from "\.\/([^"]+)"/g,(_,dep)=>`from "${library([...name.split("/").slice(0,-1),dep].join("/"))}"`);
  const url="data:text/javascript;base64,"+Buffer.from(code).toString("base64");modules.set(name,url);return url;
}
const {fixtureIntakeReceipt}=await import(library("repair-intake-record"));
const {repairOrders}=await import(library("repair-fixtures"));
const {defaultStoreSettings}=await import(library("store-settings"));
const pass=name=>{checks.push(name);console.log("PASS "+name);};
async function createUser(role,store){
  const email=`ct-perf-${role}-${suffix}-${users.length}@example.test`;
  const result=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(result.error);users.push(result.data.user.id);
  const [member]=await sql`insert into chinatech_v2.store_memberships(store_id,user_id,role,membership_status,permissions) values(${store},${result.data.user.id},${role},'active',${permission}) returning id`;
  return {email,id:result.data.user.id,memberId:member.id};
}
async function session(origin,who){
  const cookies=new Map();
  const login=await fetch(origin+"/api/auth/login",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({email:who.email,password})});
  assert.equal(login.status,200);
  for(const value of login.headers.getSetCookie()){const pair=value.split(";")[0];const index=pair.indexOf("=");cookies.set(pair.slice(0,index),pair.slice(index+1));}
  return {origin,who,cookie:[...cookies].map(([k,v])=>k+"="+v).join("; ")};
}
async function request(context,known){
  const begin=performance.now();
  const result=await fetch(context.origin+"/api/backend/state"+(known?"?known="+known:""),{headers:{Cookie:context.cookie}});
  const body=await result.text();
  return {status:result.status,data:JSON.parse(body),bytes:Buffer.byteLength(body),ms:performance.now()-begin,timing:result.headers.get("server-timing"),cache:result.headers.get("cache-control")};
}
async function measure(label,context,known){
  const runs=[];for(let i=0;i<30;i++){const result=await request(context,known);assert.equal(result.status,200);runs.push({ms:result.ms,bytes:result.bytes,timing:result.timing});}
  const sorted=runs.map(x=>x.ms).sort((a,b)=>a-b);
  return {label,n:runs.length,bytes:runs[0].bytes,p50ms:sorted[14],p95ms:sorted[28],runs};
}
try{
  for(const store of stores){await sql`insert into chinatech_v2.stores(id,name) values(${store},'Synthetic performance test')`;await sql`insert into chinatech_v2_private.store_state(store_id,settings) values(${store},${sql.json({...defaultStoreSettings,shopName:"Synthetic performance test"})})`;}
  const owner=await createUser("owner",stores[0]);const viewer=await createUser("viewer",stores[0]);const other=await createUser("viewer",stores[1]);
  const contexts=await Promise.all(origins.map(origin=>session(origin,owner)));
  const viewerContext=await session(origins[1],viewer);const otherContext=await session(origins[1],other);
  const customer=randomUUID(),device=randomUUID();
  await sql`insert into chinatech_v2_private.customers(id,store_id,normalized_phone,data) values(${customer},${stores[0]},'synthetic-perf',${sql.json({phone:"+390000000001",name:"Synthetic customer",email:"",note:"",version:1,updatedAt:"2026-10-02 10:00:00"})})`;
  await sql`insert into chinatech_v2_private.customer_devices(id,store_id,customer_id,data) values(${device},${stores[0]},${customer},${sql.json({category:"手机",brand:"Synthetic",model:"Synthetic model",color:"黑色",serial:"PERF"})})`;
  const template=fixtureIntakeReceipt(repairOrders[0]);
  for(const size of [100,1000,5000]){
    await sql`delete from chinatech_v2_private.repair_intakes where store_id=${stores[0]}`;
    for(let start=0;start<size;start+=200){
      const rows=Array.from({length:Math.min(200,size-start)},(_,i)=>{
        const id="LOCAL-"+(start+i).toString(16).padStart(16,"0").toUpperCase();
        return {store_id:stores[0],id,customer_id:customer,device_id:device,data:sql.json({...template,id,customerName:"Synthetic customer",phone:"+390000000001",email:"",serial:"PERF-"+(start+i),revision:1}),signatures:sql.json([]),workflow:null};
      });
      await sql`insert into chinatech_v2_private.repair_intakes ${sql(rows,'store_id','id','customer_id','device_id','data','signatures','workflow')}`;
    }
    await sql`update chinatech_v2_private.store_state set revision=revision+1 where store_id=${stores[0]}`;
    const initial=await request(contexts[1]);assert.match(initial.data.stateToken,/^[a-f0-9]{64}$/);
    assert.equal(initial.data.intakes.length,size);
    const before=await measure("baseline full",contexts[0]);
    const after=await measure("candidate unchanged",contexts[1],initial.data.stateToken);
    samples.push({size,before,after,reduction:1-after.bytes/before.bytes});
    assert.ok(after.bytes<before.bytes*.1);pass(`${size} synthetic intakes: unchanged response body reduced by over 90%`);
  }
  let initial=(await request(contexts[1])).data;const originalToken=initial.stateToken;
  assert.equal((await request(contexts[1],originalToken)).data.unchanged,true);pass("unchanged state uses a verified private response");
  const invalid=await request(contexts[1],"invalid");assert.equal(invalid.data.intakes.length,5000);assert.match(invalid.cache,/private.*no-store/);pass("malformed validator falls back to full authorized snapshot");
  const cross=await request(otherContext,originalToken);assert.equal(cross.data.unchanged,undefined);assert.equal(cross.data.intakes.length,0);pass("other store cannot reuse a validator or read these records");
  await sql`update chinatech_v2.accounts set display_name='Renamed synthetic member' where id=${viewer.id}`;
  const renamed=await request(contexts[1],originalToken);assert.notEqual(renamed.data.stateToken,originalToken);assert.equal(renamed.data.revision,initial.revision);pass("roster metadata invalidates without business revision change");
  const viewInitial=(await request(viewerContext)).data;
  await sql`update chinatech_v2.store_memberships set permissions=${['customers.view']} where id=${viewer.memberId}`;
  const projected=await request(viewerContext,viewInitial.stateToken);assert.equal(projected.data.unchanged,undefined);assert.equal(projected.data.intakes.length,0);assert.equal(projected.data.revision,viewInitial.revision);pass("permission change invalidates and reprojects at the same business/member revision");
  await sql`update chinatech_v2.store_memberships set membership_status='disabled' where id=${viewer.memberId}`;
  assert.equal((await request(viewerContext,projected.data.stateToken)).status,403);pass("membership revocation is checked before validator equality");
  await sql`update chinatech_v2.accounts set account_status='disabled' where id=${owner.id}`;
  assert.equal((await request(contexts[1],renamed.data.stateToken)).status,401);pass("account revocation rejects an otherwise current validator");
  mkdirSync(".local/performance-p1",{recursive:true});
  writeFileSync(".local/performance-p1/state-results.json",JSON.stringify({timestamp:new Date().toISOString(),status:"PASS",method:"Node24 local production servers, same isolated DB and synthetic users; 30 warmed serial samples per variant/size, uncompressed JSON bytes; not production telemetry",checks,samples},null,2));
}catch(error){
  // Keep the benchmark failure visible if fixture cleanup also fails.
  console.error("Performance verification failed:",error);
  throw error;
}finally{
  // Remove only fixtures created by this run; there is no production connection.
  for(const store of stores){
    for(const table of ['intake_photos','repair_intakes','procurement_records','retail_units','retail_history_records','customer_devices','customers','command_receipts','audit_events','store_state'])await sql.unsafe(`delete from chinatech_v2_private.${table} where store_id=$1`,[store]);
    await sql`delete from chinatech_v2.store_memberships where store_id=${store}`;await sql`delete from chinatech_v2.stores where id=${store}`;
  }
  // The isolated stack can retain an older non-cascading account FK. These IDs
  // belong exclusively to this run; remove their empty projections first.
  for(const id of users){await sql`delete from chinatech_v2.accounts where id=${id}`;const result=await admin.auth.admin.deleteUser(id);assert.ifError(result.error);}
  await sql.end();
}
