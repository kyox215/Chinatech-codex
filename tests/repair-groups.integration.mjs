import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import ts from "typescript";
const cache=new Map();
function moduleUrl(name){if(cache.has(name))return cache.get(name);let code=ts.transpileModule(readFileSync(`lib/${name}.ts`,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;code=code.replace(/from "\.\/([^"]+)"/g,(_,dep)=>`from "${moduleUrl(dep)}"`);const url="data:text/javascript;base64,"+Buffer.from(code).toString("base64");cache.set(name,url);return url;}
const {defaultRepairGroups}=await import(moduleUrl("repair-groups"));
const config=JSON.parse(readFileSync(process.env.CT_LOCAL_CONFIG || ".local/backend/connection.private.json","utf8"));
if(new URL(config.API_URL).port!=="55421" || new URL(config.DB_URL).port!=="55422") throw new Error("This test only accepts the isolated local rebuild stack.");
const api="http://127.0.0.1:3131";const origin="http://localhost:3131";
const sql=postgres(config.DB_URL,{max:1,prepare:false});
const admin=createClient(config.API_URL,config.SECRET_KEY || config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const suffix=randomBytes(6).toString("hex");const password="Ct"+randomBytes(20).toString("hex");
const permissions=["retail.view","retail.edit","retail.inspect","retail.price","retail.sell","sale.payment","sale.reconcile","sale.deliver","sale.debt","sale.refund","sale.aftersales","financial.read","financial.edit","repairs.view","repairs.edit","customers.view","customers.edit","settings.edit","staff.manage"];
const created=[];const sessions=[];const checks=[];
function pass(name){checks.push(name);console.log("PASS "+name);}
async function user(label,role,storeId,perms){
 const email=`ct-${label}-${suffix}@example.test`;
 const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:"Local test "+label,role:"owner"}});assert.ifError(error);created.push(data.user.id);
 if(storeId) await sql`insert into chinatech_v2.store_memberships(store_id,user_id,role,membership_status,permissions) values(${storeId},${data.user.id},${role},'active',${perms})`;
 return {id:data.user.id,email,cookies:new Map()};
}
async function request(who,path,body,method=body===undefined?"GET":"POST"){
 const response=await fetch(api+path,{method,redirect:"manual",headers:{Origin:origin,...(body===undefined?{}:{"Content-Type":"application/json"}),...(who?{Cookie:[...who.cookies].map(([k,v])=>k+"="+v).join("; ")}: {})},body:body===undefined?undefined:JSON.stringify(body)});
 if(who) for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(";")[0];const i=pair.indexOf("=");who.cookies.set(pair.slice(0,i),pair.slice(i+1));}
 const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
 return {response,status:response.status,data};
}
async function login(who){const r=await request(who,"/api/auth/login",{email:who.email,password});assert.equal(r.status,200,JSON.stringify(r.data));sessions.push(who);}
async function state(who){const r=await request(who,"/api/backend/state");assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
async function command(who,storeId,kind,payload,requestId=randomUUID()){return request(who,"/api/backend/command",{storeId,kind,payload,requestId});}
const stores=[randomUUID(),randomUUID()];
const settings={revision:0,shopName:"Group integration",address:"Test",phone:"",paper:"a4",repairWarrantyMonths:6,retailWarrantyMonths:12,suppliers:[],finance:[]};
try {
 for(const id of stores){await sql`insert into chinatech_v2.stores(id,name) values(${id},'Group integration synthetic')`;await sql`insert into chinatech_v2_private.store_state(store_id,settings) values(${id},${sql.json(settings)})`;}
 const owner=await user('groups-owner','owner',stores[0],permissions);
 const viewer=await user('groups-viewer','viewer',stores[0],['repairs.view']);
 const editor=await user('groups-editor','viewer',stores[0],['repairs.view','settings.edit']);
 const finance=await user('groups-finance','viewer',stores[0],['repairs.view','financial.read','financial.edit']);
 for(const who of [owner,viewer,editor,finance])await login(who);
 const groups=defaultRepairGroups();groups.workflow.unshift(groups.workflow.splice(3,1)[0]);groups.workflow[0].label='处理中';
 const initial=await state(owner);const payload={revision:initial.settings.revision,settings:{...initial.settings,repairGroups:groups}};
 const denied=await command(viewer,stores[0],'settings.save',payload);assert.equal(denied.status,403,JSON.stringify(denied.data));
 assert.equal((await command(finance,stores[0],'settings.save',payload)).status,403);
 assert.equal((await command(owner,stores[1],'settings.save',payload)).status,403);pass('viewer, finance-only and cross-store group writes denied');
 const key=randomUUID();let r=await command(owner,stores[0],'settings.save',payload,key);assert.equal(r.status,200,JSON.stringify(r.data));assert.deepEqual(r.data.settings.repairGroups,groups);
 const revision=r.data.settings.revision;r=await command(owner,stores[0],'settings.save',payload,key);assert.equal(r.status,200);assert.equal(r.data.settings.revision,revision);pass('owner renames and reorders atomically; duplicate operation applies once');
 assert.deepEqual((await state(viewer)).settings.repairGroups,groups);pass('other account reads persisted shared group settings');
 assert.equal((await command(editor,stores[0],'settings.save',payload)).status,409);pass('stale settings revision cannot overwrite another editor');
 let current=await state(editor);const changed=structuredClone(current.settings);changed.repairGroups.workflow[0].label='已授权修改';
 r=await command(editor,stores[0],'settings.save',{revision:current.settings.revision,settings:changed});assert.equal(r.status,200,JSON.stringify(r.data));pass('delegated settings editor can rename without owner identity');
 current=await state(owner);const legacy={...current.settings,paper:'a5'};delete legacy.repairGroups;
 r=await command(owner,stores[0],'settings.save',{revision:current.settings.revision,settings:legacy});assert.equal(r.status,200);assert.deepEqual(r.data.settings.repairGroups,current.settings.repairGroups);pass('old client omitting groups preserves existing configuration');
 current=await state(owner);const broken=structuredClone(current.settings);broken.repairGroups.workflow[0].key='unknown';
 assert.equal((await command(owner,stores[0],'settings.save',{revision:current.settings.revision,settings:broken})).status,400);assert.equal((await state(owner)).settings.revision,current.settings.revision);pass('invalid group identity rejected without partial update');
 await sql`update chinatech_v2.store_memberships set permissions=${['repairs.view']},revision=revision+1 where store_id=${stores[0]} and user_id=${editor.id}`;
 assert.equal((await command(editor,stores[0],'settings.save',{revision:current.settings.revision,settings:current.settings})).status,403);pass('permission revocation is checked at write time');
 writeFileSync(process.env.CT_GROUP_PROOF || '.local/group-edit-api-verification.json',JSON.stringify({status:'PASS',checks,count:checks.length,timestamp:new Date().toISOString()},null,2));
} finally {
 for(const who of sessions) await request(who,'/api/auth/logout',undefined,'POST').catch(()=>{});
 // Keep synthetic audit evidence in the isolated local stack; never access production data.
 await sql.end();
}
