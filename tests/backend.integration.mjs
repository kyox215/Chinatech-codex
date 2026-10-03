import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import ts from "typescript";
import sharp from "sharp";
const domainModules=new Map();
function domainCode(path){
 if(domainModules.has(path))return domainModules.get(path);
 const code=ts.transpileModule(readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from "\.\/([^"]+)"/g,(_,dep)=>`from "${domainCode(path.slice(0,path.lastIndexOf("/")+1)+dep+".ts")}"`);
 const url="data:text/javascript;base64,"+Buffer.from(code).toString("base64");domainModules.set(path,url);return url;
}
async function domain(path){return import(domainCode(path));}
const retailDomain=await domain("lib/retail.ts");const intakeDomain=await domain("lib/repair-intake-record.ts");
const config=JSON.parse(readFileSync(".local/backend/connection.private.json","utf8"));
if(new URL(config.API_URL).port!=="55421" || new URL(config.DB_URL).port!=="55422") throw new Error("This test only accepts the isolated local rebuild stack.");
const port=Number(process.env.BACKEND_TEST_PORT || 3117);if(![3117,3151].includes(port))throw new Error("Invalid isolated test port");
const api=`http://127.0.0.1:${port}`;const origin=`http://localhost:${port}`;
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
async function command(who,storeId,kind,payload,requestId=randomUUID()){const [member]=await sql`select id from chinatech_v2.store_memberships where store_id=${storeId} and user_id=${who.id}`;return request(who,"/api/backend/command",{storeId,kind,payload,requestId,memberId:member?.id??randomUUID()});}
const stores=[randomUUID(),randomUUID()];
const settings={revision:0,shopName:"ChinaTech local test",address:"Test address",phone:"",paper:"a4",repairWarrantyMonths:6,retailWarrantyMonths:12,suppliers:[],finance:[]};
try {
 for(const id of stores){await sql`insert into chinatech_v2.stores(id,name) values(${id},'ChinaTech local integration')`;await sql`insert into chinatech_v2_private.store_state(store_id,settings) values(${id},${sql.json(settings)})`;}
 const owner=await user("owner","owner",stores[0],permissions);
 const tech=await user("tech","technician",stores[0],["retail.view","retail.edit","retail.inspect","repairs.view","repairs.edit","customers.view"]);
 const viewer=await user("viewer","viewer",stores[0],["retail.view","repairs.view","customers.view"]);
 const pending=await user("pending",null,null,[]);await login(owner);await login(tech);await login(viewer);await login(pending);
 const other=await user("other-store","viewer",stores[1],["repairs.view"]);await login(other);
 assert.equal((await request(null,"/api/backend/state")).status,401);pass("unauthenticated request denied");
 assert.equal((await request(pending,"/api/backend/state")).status,403);pass("verified signup has no automatic membership despite editable owner metadata");
 const forged={cookies:new Map([["ct_preview_session","m1-visual-sample"],["ct_rebuild_auth","forged"]])};assert.equal((await request(forged,"/api/backend/state")).status,401);pass("forged and preview cookies cannot authenticate real backend");
 const cross=await command(owner,stores[1],"customer.save",{draft:{phone:"+393330000001",name:"Test",email:"",note:"",updatedAt:""},version:0});assert.equal(cross.status,403);pass("cross-store write denied");
 let own=await state(owner);
 assert.equal((await command(viewer,stores[0],"settings.save",{settings:own.settings,revision:own.settings.revision})).status,403);pass("read-only member cannot bump settings revision");
 const id="LOCAL-"+randomBytes(8).toString("hex").toUpperCase();const services={screen:{quality:"",technology:""},battery:{quality:"",appleService:""},port:{quality:""}};
 const jpeg=await sharp({create:{width:16,height:12,channels:3,background:"#6157ff"}}).jpeg().toBuffer();
 const photo={id:randomUUID(),slot:"front",mime:"image/jpeg",base64:jpeg.toString("base64")};
 const intake={id,createdAt:"2026-10-02 00:00:00",updatedAt:"2026-10-02 00:00:00",previewAt:"2026-10-02 00:00",customerName:"Synthetic Customer",phone:"+393330000002",email:"",category:"手机",brand:"Apple",model:"Test phone",color:"黑色",serial:"TEST-"+suffix,issue:"屏幕",accessories:[],services,priority:"普通",photoCount:1,photos:[{id:photo.id,slot:photo.slot}]};
 const initialPayload={data:intake,revision:0,signatureCount:0,photos:[photo]};
 const op=randomUUID();let r=await command(owner,stores[0],"intake.save",initialPayload,op);assert.equal(r.status,200,JSON.stringify(r.data));
 assert.equal(r.data.intakes.length,1);assert.notEqual(r.data.intakes[0].createdAt,intake.createdAt);pass("intake customer/device/record commit together with server timestamps");
 r=await command(owner,stores[0],"intake.save",initialPayload,op);assert.equal(r.status,200);assert.equal(r.data.intakes.length,1);pass("identical retry commits once");
 assert.equal((await command(owner,stores[0],"intake.save",{data:{...intake,model:"Changed"},revision:0,signatureCount:0},op)).status,409);pass("operation key cannot change payload");
 assert.equal((await command(owner,stores[0],"intake.save",{data:intake,revision:0,signatureCount:0})).status,409);pass("stale intake version rejected");
 const photoPath=`/api/backend/intake-photo?order=${id}&photo=${photo.id}`;
 const photoRead=(who)=>fetch(api+photoPath,{headers:who?{Cookie:[...who.cookies].map(([k,v])=>k+"="+v).join("; ")}:{}});
 const image=await photoRead(owner);assert.equal(image.status,200);assert.equal(image.headers.get("content-type"),"image/jpeg");assert.equal(image.headers.get("x-content-type-options"),"nosniff");assert.ok(image.headers.get("cache-control").includes("no-store"));assert.deepEqual(Buffer.from(await image.arrayBuffer()),jpeg);
 const photoState=await state(owner);assert.deepEqual(photoState.intakes[0].photos,[{id:photo.id,slot:"front"}]);assert.equal(JSON.stringify(photoState).includes('"base64"'),false);pass("photo bytes persist privately while business snapshot carries references only");
 assert.equal((await photoRead(null)).status,401);assert.equal((await photoRead(pending)).status,403);assert.equal((await photoRead(other)).status,404);pass("photo endpoint denies unauthenticated, unapproved and other-store readers");
 for(const invalid of [{...photo,mime:"image/png"},{...photo,base64:"/9j/AP/Z"},{...photo,base64:photo.base64+"="},{...photo,base64:Buffer.alloc(240001).toString("base64")}]) {
   const bad=await command(owner,stores[0],"intake.save",{data:photoState.intakes[0],revision:1,signatureCount:0,photos:[invalid]});assert.equal(bad.status,400,JSON.stringify(bad.data));
 }
 assert.equal((await state(owner)).intakes[0].revision,1);pass("invalid MIME, corrupt JPEG, noncanonical encoding and oversized photo never change intake");
 const secondJpeg=await sharp({create:{width:16,height:12,channels:3,background:"#ff0000"}}).jpeg().toBuffer();
 const changed=await command(owner,stores[0],"intake.save",{data:{...photoState.intakes[0],model:"Must roll back"},revision:1,signatureCount:0,photos:[{...photo,base64:secondJpeg.toString("base64")}]});assert.equal(changed.status,409);assert.equal((await state(owner)).intakes[0].model,intake.model);assert.equal((await state(owner)).intakes[0].revision,1);pass("reusing photo ID for other bytes rolls back intake and device updates");
 r=await command(owner,stores[0],"intake.save",{data:{...photoState.intakes[0],photoCount:0,photos:[]},revision:1,signatureCount:0,photos:[]});assert.equal(r.status,200);assert.equal((await photoRead(owner)).status,404);
 r=await command(owner,stores[0],"intake.save",{data:{...r.data.intakes[0],photoCount:1,photos:intake.photos},revision:2,signatureCount:0,photos:[photo]});assert.equal(r.status,200);assert.equal((await photoRead(owner)).status,200);pass("removed photo reference becomes unreadable and identical bytes can be restored once");
 await sql`update chinatech_v2.store_memberships set permissions=${["retail.view","customers.view"]},revision=revision+1 where store_id=${stores[0]} and user_id=${viewer.id}`;
 assert.equal((await photoRead(viewer)).status,403);pass("photo read permission revocation takes effect immediately");
 await sql`update chinatech_v2.store_memberships set permissions=${["repairs.edit"]},revision=revision+1 where store_id=${stores[0]} and user_id=${viewer.id}`;
 const photoCurrent=(await state(owner)).intakes[0];
 assert.equal((await command(viewer,stores[0],"intake.save",{data:photoCurrent,revision:photoCurrent.revision,signatureCount:0,photos:[photo]})).status,403);pass("photo writes require both repair view and edit permissions");
 await sql`insert into chinatech_v2_private.intake_photos(store_id,repair_id,id,slot,mime,bytes) select ${stores[0]},${id},gen_random_uuid(),'other','image/jpeg',${jpeg} from generate_series(1,29)`;
 const extra={...photo,id:randomUUID()};
 const capped=await command(owner,stores[0],"intake.save",{data:{...photoCurrent,photos:[{id:extra.id,slot:extra.slot}]},revision:photoCurrent.revision,signatureCount:0,photos:[extra]});assert.equal(capped.status,400);
 const [photoHistory]=await sql`select count(*)::int count from chinatech_v2_private.intake_photos where store_id=${stores[0]} and repair_id=${id}`;assert.equal(photoHistory.count,30);assert.equal((await state(owner)).intakes[0].revision,photoCurrent.revision);pass("photo history cap rolls back new bytes and intake revision together");
 const record={id:"PO-"+suffix,repairId:id,item:"Synthetic screen",supplier:"Test supplier",quantity:2,unitCostCents:12345,expectedAt:"",reference:"",events:[],required:true};
 r=await command(owner,stores[0],"procurement",{type:"create",record});assert.equal(r.status,200,JSON.stringify(r.data));
 let ts=await state(tech);assert.equal(ts.procurement[0].unitCostCents,null);pass("procurement cost excluded before serialization");
 for(const guess of [12345,999]) assert.equal((await command(tech,stores[0],"procurement",{type:"edit",record:{...record,unitCostCents:guess},revision:0})).status,403);
 r=await command(tech,stores[0],"procurement",{type:"edit",record:{...record,item:"Updated screen",unitCostCents:null},revision:0});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal((await state(owner)).procurement[0].unitCostCents,12345);pass("nonfinancial edit preserves hidden cost and rejects guesses uniformly");
 own=await state(owner);let rev=own.procurement[0].events.length;
 const event=(type)=>({type,id:randomUUID(),time:"1999-01-01 00:00:00",note:"Test action",quantity:0});
 for(const type of ["cart_added","cart_removed","cart_added"]){r=await command(owner,stores[0],"procurement",{type:"append",id:record.id,event:event(type),revision:rev++});assert.equal(r.status,200,JSON.stringify(r.data));}
 r=await command(owner,stores[0],"procurement",{type:"edit",record:{...record,item:"Revised screen"},revision:rev});assert.equal(r.status,200);assert.equal(r.data.procurement[0].events.at(-2).type,"cart_removed");pass("editing after repeated add/remove clears current cart marker");
 // Two simultaneous writes cannot both accept one workflow revision.
 const parallel=await Promise.all([command(owner,stores[0],"repair.workflow",{id,command:{type:"custody",custody:"store"},revision:0}),command(owner,stores[0],"repair.workflow",{id,command:{type:"custody",custody:"customer"},revision:0})]);
 assert.equal(parallel.filter(r=>r.status===200).length,1);assert.equal(parallel.filter(r=>r.status===409).length,1);pass("concurrent commands cannot overwrite one another");
 const rejected=await command(owner,stores[0],"procurement",{type:"create",record:{...record,id:"PO-invalid",repairId:"LOCAL-0000000000000000"}});assert.equal(rejected.status,404);assert.equal((await state(owner)).procurement.length,1);pass("invalid relation rolls back all writes");

 // Optional signature binds the existing facts and is committed with the original intake.
 own=await state(owner);const savedIntake=own.intakes.find(row=>row.id===id);
 const signature={id:randomUUID(),signedAt:"1999-01-01 00:00:00",language:"it",termsVersion:"repair-intake-2026-10-v1",strokes:[[{x:0.1,y:0.2},{x:0.6,y:0.8}]],aspectRatio:2,snapshot:intakeDomain.intakeSignatureSnapshot(savedIntake,savedIntake.policy)};
 r=await command(owner,stores[0],"intake.signature",{id,revision:savedIntake.revision,policy:savedIntake.policy,signature,count:0});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.signatures[0].actorId,own.staff.currentId);assert.notEqual(r.data.signatures[0].signedAt,signature.signedAt);pass("signature preserves facts and uses server actor/time");
 assert.equal((await command(owner,stores[0],"intake.signature",{id,revision:savedIntake.revision,policy:savedIntake.policy,signature:{...signature,id:randomUUID()},count:0})).status,409);pass("stale signature count cannot overwrite history");
 const day=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome",dateStyle:"short"}).format(new Date());
 const unitId=randomUUID();const unit={...retailDomain.emptyRetailUnit(),id:unitId,brand:"Apple",model:"Synthetic handset",serial:"UNIT-"+suffix,storeOwned:true,intakeDate:day,costCents:12000,refurbCents:0,priceCents:22000};
 r=await command(owner,stores[0],"retail",{type:"create",unit});assert.equal(r.status,200,JSON.stringify(r.data));pass("retail physical identity created independently from customer device");
 const hidden=(await state(tech)).retail.find(row=>row.id===unitId);assert.equal(hidden.costCents,null);assert.equal(hidden.refurbCents,null);
 const retailCommand=async(command)=>{const current=(await state(owner)).retail.find(row=>row.id===unitId);const response=await commandApi(current,command);assert.equal(response.status,200,JSON.stringify(response.data));return response.data;};
 const commandApi=(current,cmd)=>command(owner,stores[0],"retail",{type:"command",id:unitId,version:current.version,command:cmd});
 await retailCommand({type:"inspect",checks:{functional:true,ownership:true,data:true}});await retailCommand({type:"approve"});
 const saleId=randomUUID();own=await state(owner);const current=own.retail.find(row=>row.id===unitId);
 const warranty={months:current.warrantyMonths,termsVersion:"retail-2026-10-v1",shopName:own.settings.shopName,address:own.settings.address,phone:own.settings.phone};
 await retailCommand({type:"sell",saleId,customerPhone:"+393330000003",customerName:"Synthetic buyer",priceCents:22000,warranty,paymentUnreceived:true});
 const sale=(await state(owner)).retail.find(row=>row.id===unitId).sales[0];assert.equal(sale.costCents,12000);assert.equal(sale.product.serial,unit.serial);assert.equal(sale.paidCents,0);pass("sale freezes server product/cost/warranty and explicit unpaid opening");
 const filtered=(await state(tech)).retail.find(row=>row.id===unitId).sales[0];assert.equal(Object.hasOwn(filtered,"costCents"),false);pass("sale snapshot cannot bypass financial read projection");
 const entryId=randomUUID();await retailCommand({type:"payment",saleId,entryId,amountCents:22000,date:day,method:"cash",note:"Synthetic payment"});
 await retailCommand({type:"payment",saleId,entryId,amountCents:22000,date:day,method:"cash",note:"Synthetic payment"});
 assert.equal((await state(owner)).retail.find(row=>row.id===unitId).sales[0].payments.length,1);pass("stable payment entry retries never duplicate ledger entries");
 await retailCommand({type:"deliver",saleId,deliveryDate:day});
 const caseId=randomUUID();await retailCommand({type:"after_sale",saleId,caseId,date:day,issue:"Synthetic aftersales issue",custody:"left"});
 let before=(await state(owner)).retail.find(row=>row.id===unitId);const repairId="LOCAL-"+randomBytes(8).toString("hex").toUpperCase();const linkId=randomUUID();
 const link={unitId,saleId,caseId,repairId,version:before.version};r=await command(owner,stores[0],"retail.aftersale_repair",link,linkId);assert.equal(r.status,200,JSON.stringify(r.data));
 assert.equal(r.data.intakes.find(row=>row.id===repairId).retailOrigin.saleId,saleId);assert.equal(r.data.retail.find(row=>row.id===unitId).sales[0].afterSales[0].repairId,repairId);
 r=await command(owner,stores[0],"retail.aftersale_repair",link,linkId);assert.equal(r.status,200);assert.equal(r.data.delta,true);assert.equal(r.data.intakes.length,1);assert.equal((await state(owner)).intakes.length,2);pass("aftersale repair and sale link commit together and retry once");
 before=(await state(owner)).retail.find(row=>row.id===unitId);
 assert.equal((await commandApi(before,{type:"after_sale_close",saleId,caseId,date:day,resolution:"Synthetic completion",returned:true})).status,400);pass("aftersale cannot close before the linked repair completion");
 await command(owner,stores[0],"repair.workflow",{id:repairId,command:{type:"stage",status:"completed",note:"Synthetic completed"},revision:0});
 await retailCommand({type:"after_sale_close",saleId,caseId,date:day,resolution:"Synthetic resolution",returned:true});pass("aftersale close traces completed repair and explicit handback");
 own=await state(owner);const pendingDraft={id:randomUUID(),name:"Local test pending",email:pending.email,role:"viewer",accountStatus:"active",membershipStatus:"active",permissions:["retail.view","repairs.view","customers.view"],revision:0};
 r=await command(owner,stores[0],"staff.save",{draft:pendingDraft,revision:own.staff.revision});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal((await request(pending,"/api/backend/state")).status,200);pass("owner approves a verified existing account without sending invitations");
 const member=(await state(pending)).staff.members[0];assert.equal(member.role,"viewer");
 own=await state(owner);const me=own.staff.members.find(row=>row.id===own.staff.currentId);
 assert.equal((await command(owner,stores[0],"staff.save",{draft:{...me,role:"manager"},revision:own.staff.revision})).status,400);pass("owner cannot silently downgrade or change own authorization");
 // Same account in a genuinely independent Auth session; another employee shares the store.
 const owner2={...owner,cookies:new Map()};await login(owner2);
 let parallelState=await state(owner);let v1=parallelState.workflows[id]?.revision??0;let v2=parallelState.workflows[repairId]?.revision??0;
 const different=await Promise.all([command(owner,stores[0],"repair.workflow",{id,command:{type:"custody",custody:parallelState.workflows[id]?.custody==="store"?"customer":"store"},revision:v1}),command(owner2,stores[0],"repair.workflow",{id:repairId,command:{type:"custody",custody:parallelState.workflows[repairId]?.custody==="store"?"customer":"store"},revision:v2})]);
 assert.deepEqual(different.map(row=>row.status),[200,200]);pass("same account two sessions update different repairs without false conflict");
 parallelState=await state(owner);v1=parallelState.workflows[id].revision;
 const same=await Promise.all([command(owner2,stores[0],"repair.workflow",{id,command:{type:"custody",custody:parallelState.workflows[id].custody==="store"?"customer":"store"},revision:v1}),command(tech,stores[0],"repair.workflow",{id,command:{type:"custody",custody:parallelState.workflows[id].custody==="store"?"customer":"store"},revision:v1})]);
 assert.equal(same.filter(row=>row.status===200).length,1,JSON.stringify(same.map(r=>({status:r.status,data:r.status===200?null:r.data}))));assert.equal(same.filter(row=>row.status===409).length,1);
 assert.equal((await command(owner,stores[0],"repair.workflow",{id,command:{type:"custody",custody:"customer"},revision:v1})).status,409);pass("different accounts concurrent and sequential stale edits return 409 without overwrite");
 parallelState=await state(owner);v1=parallelState.workflows[id].revision;
 const replayId=randomUUID();const replayPayload={id,command:{type:"custody",custody:parallelState.workflows[id].custody==="store"?"customer":"store"},revision:v1};
 const duplicates=await Promise.all([command(owner,stores[0],"repair.workflow",replayPayload,replayId),command(owner2,stores[0],"repair.workflow",replayPayload,replayId)]);
 assert.deepEqual(duplicates.map(row=>row.status),[200,200]);assert.equal(duplicates[0].data.operation.entityId,id);assert.equal(duplicates[1].data.operation.requestId,replayId);
 const [auditCount]=await sql`select count(*)::int count from chinatech_v2_private.audit_events where store_id=${stores[0]} and request_id=${replayId}`;assert.equal(auditCount.count,1);pass("concurrent identical intent commits once with the original receipt");
 const boundMember=(await state(owner)).staff.currentId;
 const operationArgs={storeId:stores[0],memberId:boundMember,requestId:replayId};
 const receipt=await request(owner2,"/api/backend/operation?"+new URLSearchParams(operationArgs));assert.equal(receipt.status,200);assert.equal(receipt.data.status,"committed");assert.equal(receipt.data.operation.requestId,replayId);
 const otherReceipt=await request(tech,"/api/backend/operation?"+new URLSearchParams({...operationArgs,memberId:(await state(tech)).staff.currentId}));assert.equal(otherReceipt.data.status,"not_found");pass("receipt follows account across devices but cannot be read by another member");
 const identityWrong=await request(owner,"/api/backend/command",{kind:"repair.workflow",payload:replayPayload,requestId:randomUUID(),storeId:stores[0],memberId:(await state(tech)).staff.currentId});assert.equal(identityWrong.status,409);assert.equal(identityWrong.data.code,"IDENTITY_CHANGED");pass("old tab cannot apply its intent as the newly logged-in account");
 const cancelId=randomUUID();const cancelled=await request(owner,"/api/backend/operation",{...operationArgs,requestId:cancelId});assert.equal(cancelled.data.status,"cancelled");
 assert.equal((await command(owner,stores[0],"repair.workflow",replayPayload,cancelId)).status,410);
 const already=await request(owner,"/api/backend/operation",operationArgs);assert.equal(already.data.status,"committed");pass("cancellation seals an uncommitted request and never reverses a committed operation");
 for(let raceAttempt=0;raceAttempt<10;raceAttempt++){
 parallelState=await state(owner);const raceId=randomUUID();const racePayload={id,command:{type:"custody",custody:parallelState.workflows[id].custody==="store"?"customer":"store"},revision:parallelState.workflows[id].revision};
 const race=await Promise.all([command(owner,stores[0],"repair.workflow",racePayload,raceId),request(owner2,"/api/backend/operation",{...operationArgs,requestId:raceId})]);
 assert.ok(race[0].status===200||race[0].status===410,JSON.stringify(race.map(r=>({status:r.status,data:r.status===200?r.data.status:r.data}))));assert.equal(race[1].status,200);assert.equal(race[1].data.status,race[0].status===200?"committed":"cancelled");
 }
 pass("ten cancel versus late delivery races each have one terminal outcome");
 // Inject failure after repair insertion but before the retail link can commit.
 const failingCase=randomUUID();await retailCommand({type:"after_sale",saleId,caseId:failingCase,date:day,issue:"Rollback probe",custody:"left"});
 const faultRepair="LOCAL-"+randomBytes(8).toString("hex").toUpperCase();const faultId=randomUUID();const faultVersion=(await state(owner)).retail.find(row=>row.id===unitId).version;
 const faultName="sync_probe_"+suffix;
 await sql.unsafe(`create function chinatech_v2_private.${faultName}() returns trigger language plpgsql as $$ begin if new.store_id='${stores[0]}'::uuid then raise exception 'synthetic transaction failure'; end if; return new; end $$; create trigger ${faultName} before update on chinatech_v2_private.retail_units for each row execute function chinatech_v2_private.${faultName}()`);
 try {
  const failure=await command(owner,stores[0],"retail.aftersale_repair",{unitId,saleId,caseId:failingCase,repairId:faultRepair,version:faultVersion},faultId);assert.ok(failure.status>=400);
  const afterFailure=await state(owner);assert.equal(afterFailure.intakes.some(row=>row.id===faultRepair),false);assert.equal(afterFailure.retail.find(row=>row.id===unitId).version,faultVersion);
  const [count]=await sql`select count(*)::int count from chinatech_v2_private.command_receipts where store_id=${stores[0]} and request_id=${faultId}`;assert.equal(count.count,0);
  pass("injected failure after repair insertion rolls back repair sale link and receipt");
 }finally{await sql.unsafe(`drop trigger ${faultName} on chinatech_v2_private.retail_units; drop function chinatech_v2_private.${faultName}()`);}
 // Revoke financial read without deactivating the account; the next read must use fresh permissions.
 await sql`update chinatech_v2.store_memberships set permissions=${permissions.filter(p=>!p.startsWith("financial."))},revision=revision+1 where store_id=${stores[0]} and user_id=${owner.id}`;
 assert.equal((await state(owner)).procurement[0].unitCostCents,null);pass("permission revocation takes effect in the next database read");
 const oldCookies=new Map(tech.cookies);assert.equal((await request(tech,"/api/auth/logout",undefined,"POST")).status,200);
 const stale={cookies:oldCookies};assert.equal((await request(stale,"/api/backend/state")).status,401);pass("logged-out session rejected even with a previously valid access cookie");
 const raw=createClient(config.API_URL,config.PUBLISHABLE_KEY,{auth:{persistSession:false}});const auth=await raw.auth.signInWithPassword({email:viewer.email,password});assert.ifError(auth.error);
 const direct=await raw.schema("chinatech_v2").from("store_memberships").update({permissions}).eq("user_id",viewer.id).select();assert.ok(direct.error || !direct.data?.length);pass("direct Data API cannot grant membership permissions");await raw.auth.signOut();
 writeFileSync(".local/backend/sync-integration-verification.json",JSON.stringify({timestamp:new Date().toISOString(),checks,count:checks.length,status:"PASS"},null,2));
} finally {
 for(const who of sessions) await request(who,"/api/auth/logout",undefined,"POST").catch(()=>{});
 // Synthetic test history is preserved; no production or other local project is accessed.
 await sql.end();
}
