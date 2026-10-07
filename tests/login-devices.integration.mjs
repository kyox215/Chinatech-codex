// Real isolated Supabase + BFF test. Creates synthetic identities/stores and removes them.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
const c=JSON.parse(readFileSync('.local/backend/connection.private.json','utf8'));
for(const [value,port] of [[c.API_URL,'55421'],[c.DB_URL,'55422']]) { const u=new URL(value); assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,port); }
const sql=postgres(c.DB_URL,{max:3,prepare:false});
const admin=createClient(c.API_URL,c.SECRET_KEY||c.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const origin=process.env.LOGIN_DEVICES_ORIGIN||'http://localhost:3117'; const target=new URL(origin); assert.equal(target.hostname,'localhost'); assert.ok(/^3\d{3}$/.test(target.port)); const api='http://127.0.0.1:'+target.port;
function jarSession(jar){const encoded=jar.get('ct_rebuild_auth')||[...jar].filter(([name])=>/^ct_rebuild_auth\.\d+$/.test(name)).sort(([a],[b])=>Number(a.split('.')[1])-Number(b.split('.')[1])).map(([,value])=>value).join('');try{return JSON.parse(Buffer.from(JSON.parse(Buffer.from(encoded.slice(7),'base64url').toString()).access_token.split('.')[1],'base64url').toString()).session_id;}catch{return '';}}
const users=[],stores=[randomUUID(),randomUUID()], checks=[],timings=[];
const pass=name=>{checks.push(name);console.log('PASS '+name);};
async function create(name) { const email=`ct-devices-${name}-${randomBytes(5).toString('hex')}@example.test`,password='Ct'+randomBytes(20).toString('hex');const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'Synthetic '+name}});assert.ifError(error);users.push(data.user.id);return {id:data.user.id,email,password}; }
async function req(jar,path,body,identity,headers={}) { const started=performance.now();const response=await fetch(api+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json',Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(identity?{'X-CT-Account-ID':identity,'X-CT-Session-ID':jarSession(jar)}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});timings.push({path:path.split('?')[0],method:body===undefined?'GET':'POST',status:response.status,ms:Number((performance.now()-started).toFixed(2))});for(const raw of response.headers.getSetCookie()){const [pair]=raw.split(';');const i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}return response; }
async function login(user,remember){const jar=new Map();const response=await req(jar,'/api/auth/login',{email:user.email,password:user.password,remember});assert.equal(response.status,200,await response.clone().text());const cookies=response.headers.getSetCookie().filter(v=>/^ct_rebuild_auth(?:\.\d+)?=/.test(v));assert.ok(cookies.length);assert.ok(cookies.every(v=>/HttpOnly/i.test(v)));assert.equal(cookies.some(v=>/Max-Age=|Expires=/i.test(v)),remember);return jar;}
const read=async jar=>{const r=await req(jar,'/api/auth/account/sessions');assert.equal(r.status,200,await r.clone().text());return r.json();};
const current=async jar=>(await read(jar)).devices.find(d=>d.current);
try {
 const owner=await create('owner'),staff=await create('staff'),outsider=await create('outsider');
 await sql`insert into chinatech_v2.stores(id,name) values(${stores[0]},'Synthetic devices A'),(${stores[1]},'Synthetic devices B')`;
 for (const id of stores) await sql`insert into chinatech_v2_private.store_state(store_id,settings) values(${id},${sql.json({revision:0,shopName:'Synthetic devices',address:'Test',phone:'',paper:'a4',repairWarrantyMonths:6,retailWarrantyMonths:12,suppliers:[],finance:[]})})`;
 const permissions=['retail.view','retail.edit','retail.inspect','retail.price','retail.sell','sale.payment','sale.reconcile','sale.deliver','sale.debt','sale.refund','sale.aftersales','financial.read','financial.edit','repairs.view','repairs.edit','customers.view','customers.edit','settings.edit','staff.manage'];
 await sql`insert into chinatech_v2.store_memberships(store_id,user_id,role,membership_status,permissions) values(${stores[0]},${owner.id},'owner','active',${permissions}),(${stores[0]},${staff.id},'technician','active',${['repairs.view','settings.edit']}),(${stores[1]},${staff.id},'owner','active',${permissions})`;
 const [membership]=await sql`select id from chinatech_v2.store_memberships where store_id=${stores[0]} and user_id=${staff.id}`;
 const a=await login(staff,true),b=await login(staff,false),o=await login(owner,true),x=await login(outsider,false);
 a.set('ct_store',stores[0]);b.set('ct_store',stores[0]);o.set('ct_store',stores[0]);
 assert.equal((await req(a,'/api/auth/activity',{store:true})).status,200);
 assert.equal((await req(b,'/api/auth/activity',{store:true})).status,200);
 pass('real password logins install HttpOnly persistent/session cookies and register independent sessions');
 const sameAccount=await login(outsider,false),staleSession=jarSession(x);
 assert.notEqual(jarSession(sameAccount),staleSession);
 assert.equal((await req(sameAccount,'/api/auth/account/sessions/revoke',{requestId:randomUUID(),scope:'others'},outsider.id,{'X-CT-Session-ID':staleSession})).status,409);
 assert.equal((await req(sameAccount,'/api/auth/account/sessions/revoke',{requestId:randomUUID(),scope:'others'},outsider.id,{'X-CT-Session-ID':''})).status,409);
 assert.equal((await req(x,'/api/auth/account')).status,200);
 pass('stale same-account session and missing session scope fail before any device mutation');
 // Empty targets expose the receipt-only PK race deterministically. Hold an
 // uncommitted identical receipt while two real BFF transactions pass reads.
 const receiptId=randomUUID(),receiptLock=await sql.reserve(); let receiptHeld=true;
 try {
  await receiptLock`begin`;
  await receiptLock`insert into chinatech_v2_private.session_audit(actor_id,request_id,target_user_id,kind) values(${outsider.id},${receiptId},${outsider.id},'account.others')`;
  // Make all other synthetic outsider sessions already revoked, leaving no targets to update.
  await sql`update chinatech_v2_private.login_sessions set revoked_at=now() where user_id=${outsider.id} and session_id<>${staleSession}`;
  let completed=0;const racing=[0,1].map(()=>req(new Map(x),'/api/auth/account/sessions/revoke',{requestId:receiptId,scope:'others'},outsider.id).then(r=>{completed++;return r;}));
  await new Promise(resolve=>setTimeout(resolve,300));assert.equal(completed,0);
  await receiptLock`commit`;receiptHeld=false;
  for(const r of await Promise.all(racing))assert.equal(r.status,200,await r.clone().text());
  const [receiptCount]=await sql`select count(*)::int n from chinatech_v2_private.session_audit where actor_id=${outsider.id} and request_id=${receiptId}`;assert.equal(receiptCount.n,1);
  const currentX=await current(x);assert.equal((await req(x,'/api/auth/account/sessions/revoke',{requestId:receiptId,scope:'one',sessionId:currentX.id,revision:currentX.revision},outsider.id)).status,409);
 }finally{if(receiptHeld)await receiptLock`rollback`;receiptLock.release();}
 pass('concurrent receipt PK collision retries the full transaction, returns stable success and rejects request-ID reuse for another action');

 const sid=(await current(a)).id,bid=(await current(b)).id;
 const sleeping=await login(staff,true),sleepDevice=await current(sleeping);
 const joined=sleeping.get('ct_rebuild_auth')||[...sleeping].filter(([name])=>/^ct_rebuild_auth\.\d+$/.test(name)).sort(([a],[b])=>Number(a.split('.')[1])-Number(b.split('.')[1])).map(([,value])=>value).join('');
 const sleepingEnvelope=JSON.parse(Buffer.from(joined.slice(7),'base64url').toString());const jwt=sleepingEnvelope.access_token.split('.');const hint=JSON.parse(Buffer.from(jwt[1],'base64url').toString());hint.exp=1;jwt[1]=Buffer.from(JSON.stringify(hint)).toString('base64url');sleepingEnvelope.access_token=jwt.join('.');sleepingEnvelope.expires_at=1;sleepingEnvelope.expires_in=0;
 for(const name of [...sleeping.keys()])if(/^ct_rebuild_auth(?:\.\d+)?$/.test(name))sleeping.delete(name);
 sleeping.set('ct_rebuild_auth','base64-'+Buffer.from(JSON.stringify(sleepingEnvelope)).toString('base64url'));
 const expiredHint=await req(sleeping,'/api/auth/activity',{store:false});assert.equal(expiredHint.status,409);assert.deepEqual(expiredHint.headers.getSetCookie(),[]);
 assert.equal((await req(sleeping,'/api/auth/account/session')).status,200);
 assert.equal((await current(sleeping)).id,sleepDevice.id);assert.equal((await req(sleeping,'/api/auth/activity',{store:false})).status,200);
 pass('synthetic expired-access hint uses the real refresh token without replacing the project session or logging out');
 const [before]=await sql`select last_active_at from chinatech_v2_private.login_sessions where session_id=${sid}`;
 await read(a);await req(a,'/api/auth/account');await req(a,'/api/backend/state');
 const [after]=await sql`select last_active_at from chinatech_v2_private.login_sessions where session_id=${sid}`;assert.equal(+before.last_active_at,+after.last_active_at);
 await sql`update chinatech_v2_private.login_sessions set last_active_at=now()-interval '2 minutes' where session_id=${sid}`;
 assert.equal((await req(a,'/api/auth/activity',{store:true})).status,200);
 const [active]=await sql`select last_active_at>now()-interval '10 seconds' as active from chinatech_v2_private.login_sessions where session_id=${sid}`;assert.equal(active.active,true);
 pass('read-only account/state requests do not renew idle time; explicit foreground activity does');
 const list=await req(o,`/api/backend/staff/sessions?memberId=${membership.id}`);assert.equal(list.status,200,await list.clone().text());const devices=(await list.json()).devices;assert.equal(devices.length,2);
 const d=devices.find(d=>d.id===sid),operation={requestId:randomUUID(),memberId:membership.id,scope:'one',sessionId:sid,revision:d.revision};
 assert.equal((await req(o,'/api/backend/staff/sessions/revoke',operation,owner.id,{Origin:'https://foreign.invalid'})).status,403);
 assert.equal((await req(o,'/api/backend/staff/sessions/revoke',operation,staff.id)).status,409);
 assert.equal((await req(a,`/api/backend/staff/sessions?memberId=${membership.id}`)).status,403);
 assert.equal((await req(x,'/api/auth/account/sessions/revoke',{requestId:randomUUID(),scope:'one',sessionId:sid,revision:1},outsider.id)).status,404);
 pass('foreign origin, stale account, non-owner and cross-account session actions fail closed');
 const hold=await sql.reserve(); let revoke, held=true;
 try { await hold`begin isolation level serializable`;await hold`select session_id from chinatech_v2_private.login_sessions where session_id=${sid} for share`;
 let finished=false;revoke=req(o,'/api/backend/staff/sessions/revoke',operation,owner.id).then(r=>{finished=true;return r;});
 await new Promise(resolve=>setTimeout(resolve,300));assert.equal(finished,false);await hold`commit`;held=false;assert.equal((await revoke).status,200);
 } finally {if(held)await hold`rollback`;hold.release();}
 pass('store revocation waits for an in-flight protected transaction parent session lock');
 assert.equal((await req(o,'/api/backend/staff/sessions/revoke',operation,owner.id)).status,200);
 assert.equal((await req(a,'/api/auth/activity',{store:true})).status,403);
 assert.equal((await req(a,'/api/backend/state')).status,403);
 assert.equal((await req(a,'/api/auth/account')).status,200);
 a.set('ct_store',stores[1]);assert.equal((await req(a,'/api/auth/activity',{store:true})).status,200);assert.equal((await req(a,'/api/backend/state')).status,200);
 await sql.begin(async tx=>{await tx`select set_config('request.jwt.claims',${JSON.stringify({sub:staff.id,session_id:sid,role:'authenticated'})},true)`;const [r]=await tx`select chinatech_v2_private.sync_topic_access(${'ct:store:'+stores[0]}) a,chinatech_v2_private.sync_topic_access(${'ct:store:'+stores[1]}) b`;assert.equal(r.a,false);assert.equal(r.b,true);});
 pass('owner revocation is idempotent and denies only store A including Realtime, preserving account/store B');
 const anew=await login(staff,true);anew.set('ct_store',stores[0]);assert.equal((await req(anew,'/api/auth/activity',{store:true})).status,200);
 pass('fresh authentication restores store access without overwriting revoked session facts');
 const oldB=new Map(b),deviceB=await current(b);
 assert.equal((await req(a,'/api/auth/account/sessions/revoke',{requestId:randomUUID(),scope:'one',sessionId:bid,revision:deviceB.revision},staff.id)).status,200);
 assert.equal((await req(oldB,'/api/auth/account')).status,401);assert.equal((await req(oldB,'/api/backend/state')).status,401);assert.equal((await req(oldB,'/api/auth/activity',{store:true})).status,401);
 pass('personal remote revocation rejects retained cookies and still-valid Auth JWT immediately');
 const idle=await login(staff,true),iid=(await current(idle)).id;
 await sql`update chinatech_v2_private.login_sessions set last_active_at=now()-interval '30 days' where session_id=${iid}`;
 assert.equal((await req(idle,'/api/auth/account')).status,401);assert.equal((await req(idle,'/api/auth/activity',{store:false})).status,401);
 const [still]=await sql`select last_active_at<=now()-interval '30 days' as expired from chinatech_v2_private.login_sessions where session_id=${iid}`;assert.equal(still.expired,true);
 pass('exact 30-day idle boundary expires the session and activity cannot resurrect it');
 const fresh=createClient(c.API_URL,c.SECRET_KEY||c.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const direct=await fresh.auth.signInWithPassword({email:staff.email,password:staff.password});assert.ifError(direct.error);const missingSid=JSON.parse(Buffer.from(direct.data.session.access_token.split('.')[1],'base64url').toString()).session_id;
 await sql.begin(async tx=>{await tx`select set_config('request.jwt.claims',${JSON.stringify({sub:staff.id,session_id:missingSid,role:'authenticated'})},true)`;const [r]=await tx`select chinatech_v2_private.live_user() as live`;assert.equal(r.live,false);});pass('a real Auth session missing project enrollment is denied in strict mode');
 try {
  await sql`update chinatech_v2_private.login_session_controls set enabled=false where id`;
  const legacy=new Map([['ct_rebuild_auth','base64-'+Buffer.from(JSON.stringify(direct.data.session)).toString('base64url')]]);
  assert.equal((await req(legacy,'/api/auth/account')).status,200);
  const [adopted]=await sql`select remember from chinatech_v2_private.login_sessions where session_id=${missingSid}`;assert.equal(adopted.remember,true);
  await sql`update chinatech_v2_private.login_sessions set revoked_at=now() where session_id=${missingSid}`;
  assert.equal((await req(legacy,'/api/auth/account')).status,401);
 } finally {await sql`update chinatech_v2_private.login_session_controls set enabled=true where id`;}
 pass('cutover compatibility adopts only missing verified sessions and never revives a tombstone');
 const previous=(await current(x)).id, switchingJar=new Map(x), delayed=await sql.reserve();let delayedHeld=true;
 try {
  await delayed`begin`;await delayed`select session_id from chinatech_v2_private.login_sessions where session_id=${previous} for update`;
  let done=false;const oldActivity=req(switchingJar,'/api/auth/activity',{store:false}).then(r=>{done=true;return r;});
  await new Promise(resolve=>setTimeout(resolve,200));assert.equal(done,false);
  const switched=await req(switchingJar,'/api/auth/login',{email:owner.email,password:owner.password,remember:true});assert.equal(switched.status,200);
  await delayed`commit`;delayedHeld=false;const late=await oldActivity;assert.equal(late.status,200);assert.deepEqual(late.headers.getSetCookie(),[]);
  const account=await req(switchingJar,'/api/auth/account');assert.equal(account.status,200);assert.equal((await account.json()).account.id,owner.id);
 }finally{if(delayedHeld)await delayed`rollback`;delayed.release();}
 pass('late keepalive activity after account switch emits no cookies and cannot restore the previous account');
 const others={requestId:randomUUID(),scope:'others'};assert.equal((await req(a,'/api/auth/account/sessions/revoke',others,staff.id)).status,200);assert.equal((await req(a,'/api/auth/account')).status,200);assert.equal((await req(anew,'/api/auth/account')).status,401);
 const snap=new Map(a);assert.equal((await req(a,'/api/auth/logout',{})).status,200);assert.equal((await req(snap,'/api/auth/account')).status,401);
 pass('sign out all other sessions preserves current; local logout rejects captured original cookies');
 const {browserProof}=await import('./login-devices.browser.mjs');await browserProof(owner,staff,stores[0],pass,origin);
 mkdirSync('.local/login-devices',{recursive:true});writeFileSync('.local/login-devices/integration.json',JSON.stringify({checks,timings,productionWrites:0},null,2));
}finally {
 // Only synthetic identities/stores created by this test are removed.
 await sql`delete from chinatech_v2_private.session_audit where actor_id=any(${users}::uuid[])`;
 await sql`delete from chinatech_v2_private.store_login_sessions where store_id=any(${stores}::uuid[])`;
 await sql`delete from chinatech_v2_private.store_state where store_id=any(${stores}::uuid[])`;
 await sql`delete from chinatech_v2.store_memberships where store_id=any(${stores}::uuid[])`;
 await sql`delete from chinatech_v2.stores where id=any(${stores}::uuid[])`;
 await sql`delete from chinatech_v2.accounts where id=any(${users}::uuid[])`;
 for(const id of users){const {error}=await admin.auth.admin.deleteUser(id);assert.ifError(error);}
 await sql.end();
}
