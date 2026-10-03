import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import ts from "typescript";

const root=fileURLToPath(new URL("../",import.meta.url));
const compiled=new Map();
function domainURL(path) {
  if(compiled.has(path))return compiled.get(path);
  let code=ts.transpileModule(readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  code=code.replace(/from "(\.\.?\/[^\"]+)"/g,(_,source)=>`from "${domainURL(resolve(dirname(path),source+".ts"))}"`);
  const url="data:text/javascript;base64,"+Buffer.from(code).toString("base64");compiled.set(path,url);return url;
}
const intakeDomain=await import(domainURL(resolve(root,"lib/repair-intake-record.ts")));
const requirementDomain=await import(domainURL(resolve(root,"lib/repair-requirements.ts")));
const pricing=await import(domainURL(resolve(root,"lib/repair-item-pricing.ts")));
const procurementDomain=await import(domainURL(resolve(root,"lib/procurement.ts")));
const config=JSON.parse(readFileSync(process.env.CT_LOCAL_CONFIG??process.env.REPAIR_OPERATIONS_CONFIG??fileURLToPath(new URL("../.local/backend/connection.private.json",import.meta.url)),"utf8"));
const api=process.env.REPAIR_OPERATIONS_API_URL??"http://127.0.0.1:3144";
const origin=process.env.REPAIR_OPERATIONS_ORIGIN??"http://localhost:3144";
for(const [value,port] of [[config.API_URL,"55421"],[config.DB_URL,"55422"],[api,"3144"],[origin,"3144"]]) {
  const target=new URL(value);assert.ok(["127.0.0.1","localhost"].includes(target.hostname) && target.port===port,"Only the isolated local rebuild stack and candidate port 3144 are accepted.");
}
const sql=postgres(config.DB_URL,{max:1,prepare:false});
const admin=createClient(config.API_URL,config.SECRET_KEY||config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const suffix=randomBytes(6).toString("hex"),password="Ct"+randomBytes(20).toString("hex");
const stores=[randomUUID(),randomUUID()],sessions=[],checks=[];
const permissions=["retail.view","retail.edit","retail.inspect","retail.price","retail.sell","sale.payment","sale.reconcile","sale.deliver","sale.debt","sale.refund","sale.aftersales","financial.read","financial.edit","repairs.view","repairs.edit","customers.view","customers.edit","settings.edit","staff.manage"];
const suppliers=[{id:"supplier-a",name:"Synthetic A",phone:"",website:"",active:true},{id:"supplier-b",name:"Synthetic B",phone:"",website:"",active:true}];
const initialSettings={revision:0,shopName:"Repair operations test",address:"Synthetic address",phone:"",paper:"a4",repairWarrantyMonths:6,retailWarrantyMonths:12,suppliers,finance:[]};
const failName="repair_price_fail_"+suffix;
let failureTrigger=false;
function pass(name){checks.push(name);console.log("PASS "+name);}
async function request(who,path,body,method=body===undefined?"GET":"POST") {
  const response=await fetch(api+path,{method,redirect:"manual",headers:{Origin:origin,...(body===undefined?{}:{"Content-Type":"application/json"}),...(who?{Cookie:[...who.cookies].map(([key,value])=>key+"="+value).join("; ")}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  if(who)for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(";")[0],at=pair.indexOf("=");who.cookies.set(pair.slice(0,at),pair.slice(at+1));}
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
  return {status:response.status,data};
}
async function user(label,role,storeId,allowed) {
  const email=`ct-repair-price-${label}-${suffix}@example.test`;
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:"Synthetic "+label}});assert.ifError(error);
  const [member]=await sql`insert into chinatech_v2.store_memberships(store_id,user_id,role,membership_status,permissions) values(${storeId},${data.user.id},${role},'active',${allowed}) returning id`;
  const who={id:data.user.id,memberId:member.id,email,cookies:new Map(),storeId};
  const result=await request(who,"/api/auth/login",{email,password});assert.equal(result.status,200,"local login");sessions.push(who);return who;
}
async function state(who){const result=await request(who,"/api/backend/state");assert.equal(result.status,200,JSON.stringify(result.data));return result.data;}
async function command(who,kind,payload,requestId=randomUUID(),storeId=who.storeId){return request(who,"/api/backend/command",{kind,payload,requestId,storeId,memberId:who.memberId});}
function ok(result){assert.equal(result.status,200,JSON.stringify(result.data));return result.data;}
function requirements(snapshot,id){return requirementDomain.currentRepairRequirements(intakeDomain.intakeDirectoryEntry(snapshot.intakes.find(row=>row.id===id)),snapshot.workflows[id]);}
async function createIntake(who,label,withRequirements=false) {
  const id="LOCAL-"+randomBytes(8).toString("hex").toUpperCase();
  const services={screen:{quality:withRequirements?"assembled":"",technology:withRequirements?"oled":""},battery:{quality:withRequirements?"original":"",appleService:""},port:{quality:""}};
  const data={id,createdAt:"2026-10-02 00:00:00",updatedAt:"2026-10-02 00:00:00",previewAt:"2026-10-02 00:00",customerName:"Synthetic "+label,phone:"+39333"+String(Number.parseInt(suffix.slice(0,6),16)).padStart(8,"0"),email:"",category:"手机",brand:"Apple",model:"Synthetic phone",color:"",serial:label+suffix,issue:withRequirements?"屏幕、电池":"Synthetic issue",...(withRequirements?{faults:["屏幕","电池"],issueNote:""}:{}),accessories:[],services,priority:"普通",photoCount:0,custody:"customer"};
  ok(await command(who,"intake.save",{data,revision:0,signatureCount:0,photos:[]}));return id;
}
async function itemPayload(who,id,title,options={}) {
  const s=await state(who),intake=s.intakes.find(r=>r.id===id),requirement=requirements(s,id).find(r=>r.title===title),old=options.existing?s.procurement.find(r=>r.id===options.existing):undefined;
  return {type:"save-item",revision:old?.events.length??0,intakeRevision:intake.revision,workflowRevision:s.workflows[id]?.revision??0,quoteCents:options.quote??null,...(options.none?{noProcurement:true}:{}),record:{...(old??{id:"PO-"+randomUUID(),repairId:id,item:title,quantity:1,expectedAt:"",reference:"",required:true,specification:"Synthetic specification"}),supplier:options.none?"":suppliers[0].name,supplierId:options.none?"":suppliers[0].id,unitCostCents:options.cost??null,events:[],...(requirement?{requirementId:requirement.id,requirementRevision:requirement.revision}:{})}};
}
async function rejected(who,payload,status=409) {const before=await state(who);const result=await command(who,"procurement",payload);assert.equal(result.status,status,JSON.stringify(result.data));const after=await state(who);assert.deepEqual(after.intakes,before.intakes);assert.deepEqual(after.workflows,before.workflows);assert.deepEqual(after.procurement,before.procurement);assert.equal(after.revision,before.revision);}
async function reconfirmChecks(owner,tech,viewer,other) {
  const repair=await createIntake(owner,"reconfirm"),a=await itemPayload(owner,repair,"Camera",{quote:999,cost:4321});ok(await command(owner,"procurement",a));const b=await itemPayload(owner,repair,"Camera",{quote:999,cost:2222});b.record.required=false;ok(await command(owner,"procurement",b));
  let s=await state(owner),ids=[a.record.id,b.record.id];
  for(const action of ["ordered","arrival"]){s=ok(await command(owner,"procurement.batch",{action,supplierId:"supplier-a",items:ids.map(id=>({id,revision:s.procurement.find(r=>r.id===id).events.length,...(action==="arrival"?{quantity:1}:{})}))}));}
  const old=s.intakes.find(r=>r.id===repair);ok(await command(owner,"intake.save",{data:{...old,model:"Synthetic changed device"},revision:old.revision,signatureCount:0,photos:[]}));
  s=await state(owner);const make=source=>({repairId:repair,requirementId:"project:"+a.record.id,intakeRevision:source.intakes.find(r=>r.id===repair).revision,workflowRevision:source.workflows[repair].revision,items:source.procurement.filter(r=>ids.includes(r.id)).map(r=>({id:r.id,revision:r.events.length}))});
  const payload=make(s),before=s;assert.equal(procurementDomain.repairPartsSummary(s.procurement,repair,requirements(s,repair)).allRequiredReady,false);
  const reject=async (who,p,status)=>{assert.equal((await command(who,"procurement.reconfirm",p)).status,status);const now=await state(owner);assert.deepEqual(now.procurement,before.procurement);assert.deepEqual(now.workflows,before.workflows);assert.deepEqual(now.intakes,before.intakes);assert.equal(now.revision,before.revision);};
  await reject(owner,{...payload,items:payload.items.slice(0,1)},409);await reject(owner,{...payload,items:[payload.items[0],payload.items[0]]},400);await reject(owner,{...payload,items:[...payload.items,{id:"unlinked",revision:0}]},409);await reject(owner,{...payload,items:[]},400);await reject(owner,{...payload,items:[{...payload.items[0],revision:999},payload.items[1]]},409);await reject(owner,{...payload,items:[{...payload.items[0],cost:0},payload.items[1]]},400);await reject(viewer,payload,403);assert.equal((await command(other,"procurement.reconfirm",payload)).status,404);
  pass("reconfirmation requires the complete required and optional allocation set, rejects duplicates, extra rows, stale record versions, forged fields and foreign/read-only actors atomically");
  const stale={...payload};const current=before.intakes.find(r=>r.id===repair);ok(await command(owner,"intake.save",{data:{...current,model:"Synthetic changed again"},revision:current.revision,signatureCount:0,photos:[]}));assert.equal((await command(owner,"procurement.reconfirm",stale)).status,409);
  s=await state(owner);const actual=make(s),expectedRequirement=requirements(s,repair)[0],facts=s.procurement.filter(r=>ids.includes(r.id)),intake=s.intakes.find(r=>r.id===repair),snapshotSignatures=s.signatures;
  assert.equal((await command(owner,"procurement.reconfirm",{...actual,workflowRevision:999})).status,409);
  ok(await command(owner,"settings.save",{revision:s.settings.revision,settings:{...s.settings,suppliers:s.settings.suppliers.map(r=>({...r,active:false}))}}));
  const requestId=randomUUID();s=ok(await command(tech,"procurement.reconfirm",actual,requestId));s=await state(owner);
  for(const fact of facts){const now=s.procurement.find(r=>r.id===fact.id);assert.deepEqual({...now,requirementRevision:fact.requirementRevision,events:fact.events},fact);assert.equal(now.events.length,fact.events.length+1);assert.equal(now.events.at(-1).type,"requirement_linked");assert.equal(now.events.at(-1).actorId,tech.memberId);assert.equal(now.requirementRevision,expectedRequirement.revision);assert.equal(procurementDomain.arrivedQuantity(now),1);}
  const updated=s.intakes.find(r=>r.id===repair);assert.equal(updated.revision,intake.revision);assert.deepEqual(updated.itemQuotes,intake.itemQuotes);assert.deepEqual(updated.itemQuoteHistory,intake.itemQuoteHistory);assert.deepEqual(s.signatures,snapshotSignatures);assert.equal(s.workflows[repair].requirements[0].revision,expectedRequirement.revision);assert.equal(s.workflows[repair].requirements[0].confirmed,true);assert.equal(procurementDomain.repairPartsSummary(s.procurement,repair,requirements(s,repair)).allRequiredReady,true);
  ok(await command(tech,"procurement.reconfirm",actual,requestId));assert.deepEqual((await state(owner)).procurement,s.procurement);
  pass("stale intake source and workflow reject; explicit complete reconfirmation restores arrival readiness without changing prices, costs, supplier, quantities, arrivals or requirement revision, even for disabled supplier");
  const removed=await createIntake(owner,"removed-source",true);s=await state(owner);ok(await command(owner,"settings.save",{revision:s.settings.revision,settings:{...s.settings,suppliers:s.settings.suppliers.map(r=>({...r,active:true}))}}));const onlyScreen=s.intakes.find(r=>r.id===removed);ok(await command(owner,"intake.save",{data:{...onlyScreen,faults:["屏幕"],issue:"屏幕",services:{...onlyScreen.services,battery:{quality:"",appleService:""}}},revision:onlyScreen.revision,signatureCount:0,photos:[]}));const source=await itemPayload(owner,removed,"屏幕",{quote:500});s=ok(await command(owner,"procurement",source));
  for(const action of ["ordered","arrival"]){s=ok(await command(owner,"procurement.batch",{action,supplierId:"supplier-a",items:[{id:source.record.id,revision:s.procurement.find(r=>r.id===source.record.id).events.length,...(action==="arrival"?{quantity:1}:{})}]}));}
  const sourceIntake=s.intakes.find(r=>r.id===removed);ok(await command(owner,"intake.save",{data:{...sourceIntake,faults:[],issueNote:"Synthetic source removed",issue:"Synthetic source removed",services:{screen:{quality:"",technology:""},battery:{quality:"",appleService:""},port:{quality:""}}},revision:sourceIntake.revision,signatureCount:0,photos:[]}));
  s=await state(owner);const changedSource=requirements(s,removed).find(r=>r.id===source.record.requirementId),sourceFact=s.procurement.find(r=>r.id===source.record.id);assert.equal(changedSource.mode,"pending");s=ok(await command(owner,"procurement.reconfirm",{repairId:removed,requirementId:source.record.requirementId,intakeRevision:s.intakes.find(r=>r.id===removed).revision,workflowRevision:s.workflows[removed].revision,items:[{id:source.record.id,revision:sourceFact.events.length}]}));
  const retained=requirements(s,removed).find(r=>r.id===source.record.requirementId);assert.equal(retained.mode,"parts");assert.equal(retained.confirmed,true);assert.equal(retained.sourceFingerprint,undefined);assert.equal(retained.revision,changedSource.revision);assert.equal(requirements(await state(owner),removed).find(r=>r.id===retained.id).revision,retained.revision);assert.equal(procurementDomain.arrivedQuantity(s.procurement.find(r=>r.id===source.record.id)),1);
  assert.equal(procurementDomain.repairPartsSummary(s.procurement,removed,requirements(s,removed)).allRequiredReady,true);
  pass("explicit reconfirmation retains a removed intake source as a stable independent project without recurring version invalidation or losing arrival history");
  const beforeRepeat=await state(owner);s=ok(await command(owner,"procurement.reconfirm",make(beforeRepeat)));assert.deepEqual(s.procurement,beforeRepeat.procurement);assert.equal(s.workflows[repair].revision,beforeRepeat.workflows[repair].revision+1);
  const full={...s.procurement.find(r=>r.id===a.record.id),events:[...s.procurement.find(r=>r.id===a.record.id).events]};while(full.events.length<1000)full.events.push({...full.events.at(-1),id:randomUUID()});
  await sql`update chinatech_v2_private.procurement_records set data=${sql.json(full)} where store_id=${stores[0]} and id=${full.id}`;await sql`update chinatech_v2_private.store_state set revision=revision+1 where store_id=${stores[0]}`;
  const capped=await state(owner);assert.equal((await command(owner,"procurement.reconfirm",make(capped))).status,400);assert.deepEqual((await state(owner)).workflows,capped.workflows);
  pass("already-current references append only workflow confirmation, while any full event ledger prevents partial reconfirmation");
}
try {
  assert.equal(pricing.parseItemMoney(""),null);assert.equal(pricing.parseItemMoney("0"),0);assert.equal(pricing.parseItemMoney("1.09"),109);assert.equal(pricing.parseItemMoney("1000000.00"),100000000);
  for(const value of ["-1","1.001","1e2",".2","1,23","1000000.01"])assert.throws(()=>pricing.parseItemMoney(value));
  assert.equal(pricing.itemQuoteTotal([{item:"屏幕",amountCents:0}]),0);assert.equal(pricing.itemQuoteTotal([{item:"屏幕",amountCents:12},{item:"电池",amountCents:null}]),null);
  pass("strict euro cents retain explicit zero and unknown amounts without rounding");
  for(const id of stores){await sql`insert into chinatech_v2.stores(id,name) values(${id},'Synthetic item pricing')`;await sql`insert into chinatech_v2_private.store_state(store_id,settings) values(${id},${sql.json(initialSettings)})`;}
  const owner=await user("owner","owner",stores[0],permissions),tech=await user("tech","technician",stores[0],["repairs.view","repairs.edit"]),readOnly=await user("read-only","technician",stores[0],["repairs.view","repairs.edit","financial.read"]),viewer=await user("viewer","viewer",stores[0],["repairs.view"]),other=await user("other","owner",stores[1],permissions);
  if(process.env.REPAIR_RECONFIRM_ONLY==="1") await reconfirmChecks(owner,tech,viewer,other);
  else {
  await assert.rejects(sql`update chinatech_v2.store_memberships set permissions=${["repairs.view","repairs.edit","financial.edit"]} where id=${tech.memberId}`,error=>error.code==="23514");
  const repair=await createIntake(owner,"pricing",true),foreign=await createIntake(other,"foreign",true);
  let s=await state(owner),intake=s.intakes.find(r=>r.id===repair);
  const signature={id:randomUUID(),signedAt:"1999-01-01 00:00:00",language:"it",termsVersion:"repair-intake-2026-10-v1",strokes:[[{x:.1,y:.2},{x:.5,y:.6}]],snapshot:intakeDomain.intakeSignatureSnapshot(intake,intake.policy)};
  ok(await command(owner,"intake.signature",{id:repair,revision:intake.revision,policy:intake.policy,signature,count:0}));const signatures=(await state(owner)).signatures;
  const p=await itemPayload(owner,repair,"屏幕",{quote:12000,cost:4321}),rid=randomUUID(),initialReq=requirements(await state(owner),repair).find(r=>r.title==="屏幕");
  s=ok(await command(owner,"procurement",p,rid));let record=s.procurement.find(r=>r.id===p.record.id);intake=s.intakes.find(r=>r.id===repair);
  assert.equal(procurementDomain.procurementStatus(record),"cart");assert.equal(record.events[0].actorId,owner.memberId);assert.equal(s.workflows[repair].revision,1);assert.equal(s.workflows[repair].requirements.find(r=>r.id===initialReq.id).revision,initialReq.revision);assert.equal(s.workflows[repair].requirements.find(r=>r.id===initialReq.id).confirmed,true);assert.equal(intake.revision,2);assert.equal(pricing.itemQuoteTotal(intake.itemQuotes),null);assert.equal(intake.itemQuotes.find(r=>r.item==="电池").amountCents,null);assert.ok(intake.itemQuoteHistory.every(r=>r.actorId===owner.memberId));assert.deepEqual(s.signatures,signatures);assert.equal(s.workflows[repair].status,"diagnosis");
  pass("pending demand becomes confirmed cart atomically, preserves demand version and signature, and unpriced sibling keeps total unknown");
  ok(await command(owner,"procurement",p,rid));assert.deepEqual((await state(owner)).intakes,s.intakes);assert.equal((await command(owner,"procurement",{...p,quoteCents:3},rid)).status,409);
  const receipt=ok(await request(owner,"/api/backend/operation?"+new URLSearchParams({storeId:stores[0],memberId:owner.memberId,requestId:rid})));assert.equal(receipt.status,"committed");
  assert.equal((await state(tech)).procurement.find(r=>r.id===record.id).unitCostCents,null);assert.equal((await state(viewer)).intakes.find(r=>r.id===repair).itemQuotes[0].amountCents!==undefined,true);
  pass("same request commits once, changed retry conflicts, receipt recovers and cost is projected away from ordinary repair readers");
  const hidden=await itemPayload(tech,repair,"屏幕",{existing:record.id,quote:13000});s=ok(await command(tech,"procurement",hidden));assert.equal(s.procurement.find(r=>r.id===record.id).unitCostCents,null);s=await state(owner);record=s.procurement.find(r=>r.id===record.id);assert.equal(record.unitCostCents,4321);assert.equal(procurementDomain.procurementStatus(record),"cart");assert.equal(record.events.at(-1).type,"details_changed");
  for(const who of [tech,readOnly]){
    await rejected(who,await itemPayload(who,repair,"屏幕",{existing:record.id,cost:1}),403);
    const legacy={...record,events:[],unitCostCents:1};assert.equal((await command(who,"procurement",{type:"edit",record:legacy,revision:record.events.length})).status,403);
    assert.equal((await command(who,"procurement",{type:"create",record:{...legacy,id:"PO-"+randomUUID()}})).status,403);
  }
  pass("null cost preserves old cost during cart editing; both financial permissions are required across new and legacy write entrypoints");
  const fresh=await itemPayload(owner,repair,"屏幕",{existing:record.id,quote:14000});
  for(const key of ["revision","workflowRevision","intakeRevision"])await rejected(owner,{...fresh,[key]:999});
  await rejected(owner,{...fresh,quoteCents:0.5},400);await rejected(owner,{...fresh,record:{...fresh.record,supplierId:""}},400);await rejected(owner,{...fresh,record:{...fresh.record,supplierId:"unknown"}});await rejected(owner,{...fresh,record:{...fresh.record,repairId:foreign}});
  assert.equal((await command(viewer,"procurement",fresh)).status,403);assert.equal((await command(owner,"procurement",fresh,randomUUID(),stores[1])).status,403);
  pass("three stale versions, invalid money, missing supplier, foreign linkage and insufficient membership reject without writes");
  const none=await itemPayload(owner,repair,"电池",{none:true,quote:0});s=ok(await command(owner,"procurement",none));assert.equal(s.procurement.some(r=>r.id===none.record.id),false);assert.equal(s.workflows[repair].requirements.find(r=>r.title==="电池").mode,"none");assert.equal(pricing.itemQuoteTotal(s.intakes.find(r=>r.id===repair).itemQuotes),13000);
  await rejected(owner,await itemPayload(owner,repair,"屏幕",{none:true}));await rejected(owner,{...await itemPayload(owner,repair,"电池",{none:true}),record:{...none.record,unitCostCents:1}},400);
  pass("explicit no-purchase writes quote and requirement only, zero remains known, mandatory procurement cannot be erased");
  intake=(await state(owner)).intakes.find(r=>r.id===repair);const omitted={...intake};delete omitted.itemQuotes;delete omitted.itemQuoteHistory;
  s=ok(await command(owner,"intake.save",{data:omitted,revision:intake.revision,signatureCount:1,photos:[]}));let newer=s.intakes.find(r=>r.id===repair);assert.deepEqual(newer.itemQuotes,intake.itemQuotes);assert.deepEqual(newer.itemQuoteHistory,intake.itemQuoteHistory);
  assert.equal((await command(owner,"intake.save",{data:{...newer,itemQuoteHistory:[]},revision:newer.revision,signatureCount:1,photos:[]})).status,400);
  s=ok(await command(owner,"intake.save",{data:{...newer,itemQuotes:[]},revision:newer.revision,signatureCount:1,photos:[]}));newer=s.intakes.find(r=>r.id===repair);assert.deepEqual(newer.itemQuotes,[]);assert.equal(newer.itemQuoteHistory.length,intake.itemQuoteHistory.length+2);assert.deepEqual(s.signatures,signatures);
  pass("legacy intake omission preserves quotes and history; explicit clear appends audit while forged history fails and signatures remain frozen");
  const custom=await createIntake(owner,"custom"),cp=await itemPayload(owner,custom,"Camera",{quote:999});s=ok(await command(owner,"procurement",cp));assert.equal(s.procurement.find(r=>r.id===cp.record.id).requirementId,"project:"+cp.record.id);
  const legacy={...cp.record,id:"PO-"+randomUUID(),item:"Legacy item",events:[]};delete legacy.requirementId;delete legacy.requirementRevision;ok(await command(owner,"procurement",{type:"create",record:legacy}));s=ok(await command(owner,"procurement",await itemPayload(owner,custom,"Legacy item",{existing:legacy.id,quote:100})));assert.equal(s.procurement.find(r=>r.id===legacy.id).requirementId,undefined);await rejected(owner,await itemPayload(owner,custom,"Legacy item",{existing:legacy.id,none:true}));
  pass("new custom project links explicitly while editing legacy unlinked procurement preserves its identity and rejects no-purchase");
  const compatibility=await createIntake(owner,"compatibility",true),linkedA=await itemPayload(owner,compatibility,"屏幕",{quote:1});ok(await command(owner,"procurement",linkedA));const linkedB=await itemPayload(owner,compatibility,"屏幕",{quote:2});ok(await command(owner,"procurement",linkedB));
  let ci=(await state(owner)).intakes.find(r=>r.id===compatibility);ok(await command(owner,"intake.save",{data:{...ci,model:"Synthetic changed model"},revision:ci.revision,signatureCount:0,photos:[]}));
  await rejected(owner,await itemPayload(owner,compatibility,"屏幕",{existing:linkedA.record.id,quote:3}));
  const one=await createIntake(owner,"single-compatibility",true),single=await itemPayload(owner,one,"屏幕",{quote:1});ok(await command(owner,"procurement",single));ci=(await state(owner)).intakes.find(r=>r.id===one);ok(await command(owner,"intake.save",{data:{...ci,model:"Synthetic changed single model"},revision:ci.revision,signatureCount:0,photos:[]}));
  const rechecked=await itemPayload(owner,one,"屏幕",{existing:single.record.id,quote:2});s=ok(await command(owner,"procurement",rechecked));assert.equal(s.procurement.find(r=>r.id===single.record.id).requirementRevision,rechecked.record.requirementRevision);assert.ok(rechecked.record.requirementRevision>single.record.requirementRevision);
  pass("changed device requires current demand revision; one preorder can be explicitly rechecked but another stale mandatory row prevents false completeness");
  const limit=await createIntake(owner,"history-limit",true);ci=(await state(owner)).intakes.find(r=>r.id===limit);const capped=Array.from({length:1000},(_,i)=>({id:"synthetic-"+i,time:"2026-01-01 00:00:00",item:"屏幕",previousCents:null,amountCents:null,actorId:owner.memberId}));
  await sql`update chinatech_v2_private.repair_intakes set data=${sql.json({...ci,itemQuoteHistory:capped})} where store_id=${stores[0]} and id=${limit}`;await sql`update chinatech_v2_private.store_state set revision=revision+1 where store_id=${stores[0]}`;
  await rejected(owner,await itemPayload(owner,limit,"屏幕",{quote:100}),400);
  pass("full quote audit ledger rejects new changes without partial procurement or intake writes");
  const concurrent=await createIntake(owner,"concurrent",true),pa=await itemPayload(owner,concurrent,"屏幕",{quote:1}),pb=await itemPayload(owner,concurrent,"电池",{quote:2});const racing=await Promise.all([command(owner,"procurement",pa),command(owner,"procurement",pb)]);assert.deepEqual(racing.map(r=>r.status).sort(),[200,409]);s=await state(owner);assert.equal(s.procurement.filter(r=>r.repairId===concurrent).length,1);
  pass("simultaneous saves to one intake yield one commit and one conflict without lost quote updates");
  s=await state(owner);record=s.procurement.find(r=>r.id===p.record.id);ok(await command(owner,"procurement.batch",{action:"ordered",supplierId:"supplier-a",items:[{id:record.id,revision:record.events.length}]}));await rejected(owner,await itemPayload(owner,repair,"屏幕",{existing:record.id,quote:1}));
  pass("ordered procurement cannot be rewritten by simplified item save");
  const quotedBefore=await state(owner),quotedIntake=quotedBefore.intakes.find(r=>r.id===repair),quotePayload={id:repair,item:"屏幕",quoteCents:15000,intakeRevision:quotedIntake.revision};
  s=ok(await command(tech,"repair.quote",quotePayload));assert.deepEqual((await state(owner)).procurement,quotedBefore.procurement);assert.deepEqual(s.workflows,quotedBefore.workflows);assert.deepEqual(s.signatures,quotedBefore.signatures);assert.equal(s.intakes.find(r=>r.id===repair).itemQuotes.find(r=>r.item==="屏幕").amountCents,15000);assert.equal(s.intakes.find(r=>r.id===repair).itemQuoteHistory.at(-1).actorId,tech.memberId);
  assert.equal((await command(tech,"repair.quote",quotePayload)).status,409);assert.equal((await command(viewer,"repair.quote",{...quotePayload,intakeRevision:quotedIntake.revision+1})).status,403);assert.equal((await command(owner,"repair.quote",{...quotePayload,item:"Unknown",intakeRevision:quotedIntake.revision+1})).status,409);assert.equal((await command(owner,"repair.quote",{...quotePayload,quoteCents:-1,intakeRevision:quotedIntake.revision+1})).status,400);
  pass("independent quote correction after ordering preserves procurement, workflow and signatures and enforces title, amount, permission and intake revision");
  const rollback=await createIntake(owner,"rollback",true),rp=await itemPayload(owner,rollback,"屏幕",{quote:9900,cost:8888}),requestId=randomUUID();
  await sql.unsafe(`create function chinatech_v2_private.${failName}() returns trigger language plpgsql as $$ begin if new.store_id='${stores[0]}'::uuid and new.id='${rollback}' and new.workflow is distinct from old.workflow then raise exception 'synthetic item save rollback'; end if; return new; end $$`);
  await sql.unsafe(`create trigger ${failName} before update on chinatech_v2_private.repair_intakes for each row execute function chinatech_v2_private.${failName}()`);failureTrigger=true;
  const before=await state(owner);assert.equal((await command(owner,"procurement",rp,requestId)).status,503);s=await state(owner);assert.deepEqual(s.intakes,before.intakes);assert.deepEqual(s.procurement,before.procurement);assert.deepEqual(s.workflows,before.workflows);assert.equal(s.revision,before.revision);const [receiptMissing]=await sql`select count(*)::int count from chinatech_v2_private.command_receipts where store_id=${stores[0]} and request_id=${requestId}`;assert.equal(receiptMissing.count,0);
  await sql.unsafe(`drop trigger ${failName} on chinatech_v2_private.repair_intakes`);await sql.unsafe(`drop function chinatech_v2_private.${failName}()`);failureTrigger=false;ok(await command(owner,"procurement",rp,requestId));ok(await command(owner,"procurement",rp,requestId));
  pass("failure after procurement and intake writes rolls back all ledgers and receipt; exact retry commits once");
  await sql`update chinatech_v2.store_memberships set permissions=${["repairs.view"]},revision=revision+1 where store_id=${stores[0]} and id=${tech.memberId}`;assert.equal((await command(tech,"procurement",await itemPayload(tech,rollback,"屏幕",{quote:1}))).status,403);
  pass("live permission revocation is enforced on actual command");
  }
  console.log(JSON.stringify({status:"PASS",count:checks.length,checks,timestamp:new Date().toISOString()}));
} finally {
  if(failureTrigger){await sql.unsafe(`drop trigger if exists ${failName} on chinatech_v2_private.repair_intakes`).catch(()=>{});await sql.unsafe(`drop function if exists chinatech_v2_private.${failName}()`).catch(()=>{});}
  for(const who of sessions)await request(who,"/api/auth/logout",undefined,"POST").catch(()=>{});
  await sql.end();
}
