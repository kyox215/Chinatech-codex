// Real project-local Auth + runtime RLS + HTTP integration, no production targets.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import postgres from 'postgres';
import {createClient} from '@supabase/supabase-js';
const root=process.env.CATALOG_PROJECT_ROOT||process.cwd();
const config=JSON.parse(readFileSync(resolve(root,'.local/backend/connection.private.json'),'utf8'));
for(const [v,p]of [[config.API_URL,'55421'],[config.DB_URL,'55422']]){const u=new URL(v);assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,p);}
const localEnv=JSON.parse(readFileSync(resolve(root,'.local/backend/env.private.json'),'utf8'));
const sql=postgres(config.DB_URL,{max:4,prepare:false});
const runtime=postgres(localEnv.APP_DATABASE_URL,{max:1,prepare:false});
const auth=createClient(config.API_URL,config.SECRET_KEY||config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const origin='http://localhost:3177';const api='http://127.0.0.1:3177';
const proof=resolve(root,'.local/device-catalog');mkdirSync(proof,{recursive:true});
const checks=[],timings=[],users=[],stores=[],prefix='catalog-test-'+randomBytes(5).toString('hex');
const pass=name=>{checks.push(name);console.log('PASS '+name);};
const cookieHeader=jar=>[...jar].map(([k,v])=>k+'='+v).join('; ');
function sid(jar){const encoded=jar.get('ct_rebuild_auth')||[...jar].filter(([n])=>/^ct_rebuild_auth\.\d+$/.test(n)).sort(([a],[b])=>Number(a.split('.')[1])-Number(b.split('.')[1])).map(([,v])=>v).join('');return JSON.parse(Buffer.from(JSON.parse(Buffer.from(encoded.slice(7),'base64url').toString()).access_token.split('.')[1],'base64url').toString()).session_id;}
async function req(jar,path,body,user,headers={}){const start=performance.now();const raw=body instanceof Uint8Array;const r=await fetch(api+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':raw?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/json',Cookie:cookieHeader(jar),...(user?{'X-CT-Account-ID':user.id,'X-CT-Session-ID':sid(jar)}:{}),...headers},body:body===undefined?undefined:raw?body:JSON.stringify(body)});for(const raw of r.headers.getSetCookie()){const [pair]=raw.split(';');const i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}timings.push({path:path.split('?')[0],status:r.status,ms:Math.round(performance.now()-start)});return r;}
async function json(r,status=200){assert.equal(r.status,status,await r.clone().text());return r.json();}
async function create(label){const email=prefix+'-'+label+'@example.test',password='Ct'+randomBytes(20).toString('hex');const {data,error}=await auth.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'Synthetic catalog '+label}});assert.ifError(error);const u={id:data.user.id,email,password};users.push(u.id);writeFileSync(proof+'/fixtures.private.json',JSON.stringify({users,stores,prefix}));return u;}
async function login(u){const jar=new Map();await json(await req(jar,'/api/auth/login',{email:u.email,password:u.password,remember:false}));jar.set('ct_store',stores[0]);return jar;}
const base=(i=0,patch={})=>({id:prefix+'-'+i,category:'phone',brand:'SyntheticCatalog',family:i%2?'A':'S',name:'Synthetic '+i,releasedAt:null,year:2000+i%25,generation:'',network:i%2?'4G':'5G',platform:'Test '+i,modelCodes:['000'+i],aliases:[],markets:[],status:'review',enabled:true,sourceUrls:[],checkedAt:null,notes:'Synthetic data only',...patch});
const oldControl=(await sql`select admin_user_id,revision::text,updated_by,updated_at from chinatech_v2_private.device_catalog_control where singleton`)[0];assert.ok(oldControl);assert.equal(oldControl.admin_user_id,null,'An assigned catalog must never be hijacked by this test');assert.equal((await sql`select count(*)::int n from chinatech_v2_private.device_catalog_entries`)[0].n,0,'Use only the new empty local catalog');
let lastRevision=oldControl.revision;
try{
 const manager=await create('manager'),owner=await create('owner'),outsider=await create('outsider');
 stores.push(randomUUID(),randomUUID());writeFileSync(proof+'/fixtures.private.json',JSON.stringify({users,stores,prefix}));for(const id of stores){await sql`insert into chinatech_v2.stores(id,name) values(${id},'Synthetic catalog store')`;await sql`insert into chinatech_v2_private.store_state(store_id,settings) values(${id},${sql.json({revision:0,shopName:'Synthetic catalog store',address:'Test',phone:'',paper:'a4',repairWarrantyMonths:6,retailWarrantyMonths:12,suppliers:[],finance:[]})})`;}
 const permissions=['retail.view','retail.edit','retail.inspect','retail.price','retail.sell','sale.payment','sale.reconcile','sale.deliver','sale.debt','sale.refund','sale.aftersales','financial.read','financial.edit','repairs.view','repairs.edit','customers.view','customers.edit','settings.edit','staff.manage'];
 await sql`insert into chinatech_v2.store_memberships(store_id,user_id,role,membership_status,permissions) values(${stores[0]},${manager.id},'technician','active',${permissions}),(${stores[0]},${owner.id},'owner','active',${permissions})`;
 await sql`update chinatech_v2_private.device_catalog_control set admin_user_id=${manager.id} where singleton and admin_user_id is null`;
 const m=await login(manager),o=await login(owner),x=await login(outsider);
 const state=await json(await req(m,'/api/catalog?kind=state'));assert.equal(state.canManage,true);assert.equal((await json(await req(o,'/api/catalog?kind=state'))).canManage,false);
 assert.equal((await req(new Map(),'/api/catalog')).status,401);assert.equal((await req(x,'/api/catalog')).status,403);assert.equal((await req(o,'/api/catalog?kind=history')).status,403);assert.equal((await req(o,'/api/catalog?disabled=true')).status,403);assert.equal((await req(o,'/api/catalog/workbook')).status,403);
 const reference=JSON.parse(readFileSync(resolve(root,'data/device-catalog/catalog.json'),'utf8')).filter(r=>r.brand==='Samsung'&&/Galaxy A13/.test(r.name));
 const initial=[...Array.from({length:130},(_,i)=>({entry:base(i),expectedVersion:0})),...reference.map((entry,i)=>({entry:{...entry,id:prefix+'-official-'+i},expectedVersion:0}))];
 const previewBody={action:'preview',revision:lastRevision,rows:initial};
 assert.equal((await req(o,'/api/catalog',previewBody,owner)).status,403);assert.equal((await req(m,'/api/catalog',previewBody,manager,{Origin:'https://foreign.invalid'})).status,403);assert.equal((await req(m,'/api/catalog',previewBody,manager,{'X-CT-Account-ID':owner.id})).status,409);assert.equal((await req(m,'/api/catalog',previewBody,manager,{'X-CT-Session-ID':randomUUID()})).status,409);assert.equal((await req(m,'/api/catalog',previewBody,manager,{'X-CT-Store-ID':stores[1]})).status,403);
 pass('anonymous, outsider, ordinary owner, stale identity/session, foreign origin and wrong store fail closed');
 const preview=await json(await req(m,'/api/catalog',previewBody,manager));assert.equal(preview.errors.length,0);assert.equal(preview.changes.filter(r=>r.kind==='add').length,initial.length);assert.equal((await sql`select count(*)::int n from chinatech_v2_private.device_catalog_entries`)[0].n,0);
 const requestId=randomUUID(),applyBody={action:'apply',rows:preview.rows,revision:preview.revision,digest:preview.digest,requestId};
 const a=await json(await req(m,'/api/catalog',applyBody,manager));assert.equal(a.applied,initial.length);lastRevision=a.revision;
 const replay=await json(await req(m,'/api/catalog',applyBody,manager));assert.equal(replay.replayed,true);assert.equal(replay.revision,lastRevision);
 const page=await json(await req(o,'/api/catalog?category=phone&brand=SyntheticCatalog&page=3'));assert.equal(page.total,130);assert.equal(page.rows.length,30);
 const found=await json(await req(o,'/api/catalog?q=000129'));assert.equal(found.rows[0].id,base(129).id);const groups=await json(await req(o,'/api/catalog?kind=groups&category=phone&brand=SyntheticCatalog'));assert.equal(groups.families.length,2);
 assert.equal((await sql`select count(*)::int n from chinatech_v2_private.device_catalog_history where actor_id=${manager.id}`)[0].n,1);assert.equal((await req(m,'/api/catalog',previewBody,manager)).status,409);
 pass('real 130-row preview is read-only; apply commits once with history/receipt, total-aware paging, codes and series');
 const changed={entry:base(0,{notes:'confirmed update'}),expectedVersion:1};
 const p2=await json(await req(m,'/api/catalog',{action:'preview',revision:lastRevision,rows:[changed]},manager));
 const conflict=await json(await req(m,'/api/catalog',{action:'preview',revision:lastRevision,rows:[{...changed,expectedVersion:0}]},manager));assert.equal(conflict.errors.length,1);
 const invalidBatch=await json(await req(m,'/api/catalog',{action:'preview',revision:lastRevision,rows:[changed,{entry:base(1),expectedVersion:0}]},manager));assert.equal(invalidBatch.errors.length,1);
 assert.equal(invalidBatch.digest,'');assert.equal((await req(m,'/api/catalog',{action:'apply',revision:lastRevision,rows:invalidBatch.rows,digest:invalidBatch.digest,requestId:randomUUID()},manager)).status,400);
 assert.equal((await sql`select data->>'notes' notes from chinatech_v2_private.device_catalog_entries where id=${base(0).id}`)[0].notes,'Synthetic data only');
 const updated=await json(await req(m,'/api/catalog',{action:'apply',revision:p2.revision,rows:p2.rows,digest:p2.digest,requestId:randomUUID()},manager));lastRevision=updated.revision;
 pass('stale versions block the entire preview; no valid subset gets an apply digest, omission retains other rows');
 const p3=await json(await req(m,'/api/catalog',{action:'preview',revision:lastRevision,rows:[{entry:base(0,{enabled:false,notes:'confirmed update'}),expectedVersion:2}]},manager));
 const concurrentBody={action:'apply',revision:p3.revision,rows:p3.rows,digest:p3.digest,requestId:randomUUID()};const racing=await Promise.all([req(new Map(m),'/api/catalog',concurrentBody,manager),req(new Map(m),'/api/catalog',concurrentBody,manager)]);for(const r of racing)await json(r);lastRevision=(await json(await req(m,'/api/catalog?kind=state'))).revision;
 assert.equal((await json(await req(o,'/api/catalog?brand=SyntheticCatalog'))).total,129);assert.equal((await json(await req(m,'/api/catalog?brand=SyntheticCatalog&disabled=true'))).total,130);
 const restored=await json(await req(m,'/api/catalog',{action:'restore',revision:lastRevision,targetRevision:lastRevision},manager));assert.equal(restored.changes.length,1);assert.equal(restored.rows[0].entry.enabled,true);const undo=await json(await req(m,'/api/catalog',{action:'apply',revision:restored.revision,rows:restored.rows,digest:restored.digest,requestId:randomUUID()},manager));lastRevision=undo.revision;
 assert.equal((await json(await req(o,'/api/catalog?brand=SyntheticCatalog'))).total,130);
 pass('concurrent identical apply is idempotent; disable hides candidates, inverse preview restores without deletes');
 for(const locale of ['zh-CN','it','en']){const response=await req(m,'/api/catalog/workbook?format=xlsx&locale='+locale);assert.equal(response.status,200);const bytes=new Uint8Array(await response.arrayBuffer());assert.ok(bytes.length>2000);const result=await json(await req(m,'/api/catalog/workbook',bytes,manager,{'X-CT-Catalog-Revision':lastRevision}));assert.equal(result.errors.length,0);assert.equal(result.changes.length,initial.length);assert.ok(result.changes.every(r=>r.kind==='unchanged'));}
 pass('three-language Excel export → upload → unchanged preview preserves IDs, versions and leading-zero codes');
 await runtime.begin(async tx=>{await tx`select set_config('request.jwt.claims',${JSON.stringify({sub:owner.id,session_id:sid(o),role:'authenticated'})},true),set_config('app.store_id',${stores[0]},true)`;const rows=await tx`select id from chinatech_v2_private.device_catalog_entries`;assert.equal(rows.length,initial.length);const updated=await tx`update chinatech_v2_private.device_catalog_entries set enabled=false where id=${base(0).id} returning id`;assert.equal(updated.length,0);});
 let denied=false;try{await runtime.begin(async tx=>{await tx`select set_config('request.jwt.claims',${JSON.stringify({sub:owner.id,session_id:sid(o),role:'authenticated'})},true),set_config('app.store_id',${stores[0]},true)`;await tx`update chinatech_v2_private.device_catalog_control set admin_user_id=${owner.id} where singleton`;});}catch(e){assert.equal(e.code,'42501');denied=true;}assert.equal(denied,true);
 await sql`update chinatech_v2.store_memberships set membership_status='disabled' where store_id=${stores[0]} and user_id=${manager.id}`;assert.equal((await req(m,'/api/catalog?kind=state')).status,403);assert.equal((await req(m,'/api/catalog',applyBody,manager)).status,403);await sql`update chinatech_v2.store_memberships set membership_status='active' where store_id=${stores[0]} and user_id=${manager.id}`;
 pass('real runtime RLS denies ordinary writes/admin self-grant; revoked membership denies previously designated admin');
 // Browser matrix imports a module in this task only; credentials remain in memory.
 if(process.env.CATALOG_BROWSER==='1'){const {browserCatalog}=await import('./device-catalog.browser.mjs');await browserCatalog({manager,owner,storeId:stores[0],prefix,pass,origin,root});lastRevision=(await sql`select revision::text from chinatech_v2_private.device_catalog_control where singleton`)[0].revision;}
 writeFileSync(proof+'/integration.json',JSON.stringify({checks,timings,productionWrites:0},null,2));
}catch(error){console.error('Integration stopped:',error.message);throw error;}finally{
 // Never truncate shared tables. Remove this test's exact IDs/actors and restore only our unchanged control.
 const created=(await sql`select id from chinatech_v2_private.device_catalog_entries where id like ${prefix+'-%'} or data->>'notes'=${prefix+' browser fixture'}`).map(r=>r.id);
 const foreign=(await sql`select count(*)::int n from chinatech_v2_private.device_catalog_entries where id<>all(${created}::text[])`)[0].n;
 if(foreign)throw Error('Unexpected external catalog rows; preserve state and require targeted cleanup');
 await sql`delete from chinatech_v2_private.device_catalog_entries where id=any(${created}::text[])`;
 await sql`delete from chinatech_v2_private.device_catalog_receipts where actor_id=any(${users}::uuid[])`;
 await sql`delete from chinatech_v2_private.device_catalog_history where actor_id=any(${users}::uuid[])`;
 await sql`update chinatech_v2_private.device_catalog_control set admin_user_id=${oldControl.admin_user_id},revision=${oldControl.revision},updated_by=${oldControl.updated_by},updated_at=${oldControl.updated_at} where singleton and admin_user_id=any(${users}::uuid[])`;
 await sql`delete from chinatech_v2_private.store_login_sessions where store_id=any(${stores}::uuid[])`;
 await sql`delete from chinatech_v2_private.audit_events where store_id=any(${stores}::uuid[])`;
 await sql`delete from chinatech_v2_private.command_receipts where store_id=any(${stores}::uuid[])`;
 await sql`delete from chinatech_v2_private.retail_units where store_id=any(${stores}::uuid[])`;
 await sql`delete from chinatech_v2_private.store_state where store_id=any(${stores}::uuid[])`;
 await sql`delete from chinatech_v2.store_memberships where store_id=any(${stores}::uuid[])`;
 await sql`delete from chinatech_v2.stores where id=any(${stores}::uuid[])`;
 await sql`delete from chinatech_v2.accounts where id=any(${users}::uuid[])`;
 for(const id of users){const {error}=await auth.auth.admin.deleteUser(id);assert.ifError(error);}
 assert.equal((await sql`select count(*)::int n from chinatech_v2_private.device_catalog_entries`)[0].n,0);
 await runtime.end();await sql.end();console.log('Synthetic catalog fixtures removed; local control restored.');
}
