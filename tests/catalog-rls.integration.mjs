import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import postgres from 'postgres';
import {createClient} from '@supabase/supabase-js';
const c=JSON.parse(readFileSync('.local/backend/connection.private.json'));
for(const [url,port] of [[c.API_URL,'55421'],[c.DB_URL,'55422']]){const u=new URL(url);assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,port);}
const db=postgres(c.DB_URL,{max:1,prepare:false});const local=JSON.parse(readFileSync('.local/backend/env.private.json'));
const runtimeUrl=new URL(local.APP_DATABASE_URL);assert.equal(runtimeUrl.hostname,'127.0.0.1');assert.equal(runtimeUrl.port,'55422');assert.equal(runtimeUrl.username,'chinatech_runtime');
const runtime=postgres(local.APP_DATABASE_URL,{max:1,prepare:false});const admin=createClient(c.API_URL,c.SECRET_KEY||c.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const seed=randomBytes(8).toString('hex'),store=randomUUID(),email=`catalog-perf-${seed}@example.test`,password='Ct'+randomBytes(20).toString('hex');let user;
const table='chinatech_v2_private.perf_catalog_'+seed;
const result={condition:'Local PG17 real verified Auth session and actual runtime connection, temporary synthetic table only; not production latency',samples:[],security:[]};
try{
const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);user=created.data.user.id;
const auth=createClient(c.API_URL,c.PUBLISHABLE_KEY||c.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const signed=await auth.auth.signInWithPassword({email,password});assert.ifError(signed.error);const session=JSON.parse(Buffer.from(signed.data.session.access_token.split('.')[1],'base64url')).session_id;
await db.begin(async tx=>{
await tx`insert into chinatech_v2.stores(id,name) values(${store},'Synthetic performance diagnosis')`;
await tx`insert into chinatech_v2.store_memberships(store_id,user_id,role,membership_status,permissions) values(${store},${user},'owner','active',array['repairs.view'])`;
await tx`insert into chinatech_v2_private.login_sessions(session_id,user_id) values(${session},${user})`;
await tx`insert into chinatech_v2_private.store_login_sessions(store_id,session_id,user_id) values(${store},${session},${user})`;
await tx`create table ${tx(table)} (like chinatech_v2_private.device_catalog_entries including all)`;
await tx`alter table ${tx(table)} enable row level security`;await tx`alter table ${tx(table)} force row level security`;await tx`grant select on ${tx(table)} to chinatech_runtime`;await tx`create policy catalog_entries_read on ${tx(table)} for select to chinatech_runtime using(chinatech_v2_private.device_catalog_can_read())`;
await tx`insert into ${tx(table)} (id,category,brand,family,enabled,release_sort,name_sort,search_text,identity_key,data)
select ${'perf-'+seed+'-'}||i,'phone','Synthetic','',true,'2026-01-01',lpad(i::text,6,'0'),'synthetic '||i,${'perf-'+seed+'-'}||i,jsonb_build_object('id',${'perf-'+seed+'-'}||i,'category','phone','brand','Synthetic','family','','enabled',true,'name','Synthetic '||i) from generate_series(1,10000) i`;
});
const measure=async(label)=>runtime.begin(async tx=>{await tx`select set_config('request.jwt.claims',${JSON.stringify({sub:user,session_id:session,role:'authenticated'})},true),set_config('app.store_id',${store},true),set_config('statement_timeout','10000',true)`;assert.equal((await tx`select chinatech_v2_private.device_catalog_can_read() allowed`)[0].allowed,true);let start=performance.now();try{const rows=await tx.savepoint(async q=>q`explain(analyze,buffers,format json) select count(*)::int total from ${q(table)} where brand='Synthetic'`);const plan=rows[0]['QUERY PLAN'][0];result.samples.push({label,ms:performance.now()-start,plan});}catch(e){result.samples.push({label,ms:performance.now()-start,code:e.code,name:e.name});}});
await measure('before');
const migration=readFileSync('supabase/migrations/20261016234231_catalog_read_initplan.sql','utf8');
const statement=migration.match(/alter policy catalog_entries_read[^;]+;/)?.[0];assert.ok(statement);
await db.unsafe(statement.replace('chinatech_v2_private.device_catalog_entries',table));
for(let sample=0;sample<30;sample++)await measure('after');
assert.ok(result.samples.filter(row=>row.label==='after').every(row=>!row.code&&JSON.stringify(row.plan).includes('InitPlan')));
await runtime.begin(async tx=>{await tx`select set_config('request.jwt.claims',${JSON.stringify({sub:user,session_id:session,role:'authenticated'})},true),set_config('app.store_id',${randomUUID()},true)`;assert.equal((await tx`select count(*)::int total from ${tx(table)}`)[0].total,0);result.crossStoreDenied=true;});
const expectDenied=async(label,claims={sub:user,session_id:session,role:'authenticated'})=>{await runtime.begin(async tx=>{await tx`select set_config('request.jwt.claims',${JSON.stringify(claims)},true),set_config('app.store_id',${store},true)`;assert.equal((await tx`select count(*)::int total from ${tx(table)}`)[0].total,0);});result.security.push(label);};
await expectDenied('anonymous',{});
await db`update chinatech_v2.store_memberships set membership_status='disabled' where store_id=${store} and user_id=${user}`;await expectDenied('disabled membership');
await db`update chinatech_v2.store_memberships set membership_status='active' where store_id=${store} and user_id=${user}`;
await db`update chinatech_v2.accounts set account_status='disabled' where id=${user}`;await expectDenied('disabled account');
await db`update chinatech_v2.accounts set account_status='active' where id=${user}`;
await db`update chinatech_v2_private.login_sessions set revoked_at=now() where session_id=${session}`;await expectDenied('revoked login');
await db`update chinatech_v2_private.login_sessions set revoked_at=null where session_id=${session}`;
await db`update chinatech_v2_private.store_login_sessions set revoked_at=now() where store_id=${store} and session_id=${session}`;await expectDenied('revoked store session');
const times=result.samples.filter(row=>row.label==='after').map(row=>row.ms).sort((a,b)=>a-b);result.afterP95Ms=times[Math.ceil(times.length*.95)-1];
mkdirSync('.company-tmp/performance-20261017/catalog-rls',{recursive:true});writeFileSync('.company-tmp/performance-20261017/catalog-rls/verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify({beforeMs:result.samples[0].ms,afterP95Ms:result.afterP95Ms,samples:times.length,security:result.security,crossStoreDenied:result.crossStoreDenied}));
}finally{try{await db`drop table if exists ${db(table)}`;if(user){const deleted=await admin.auth.admin.deleteUser(user);assert.ifError(deleted.error);}if((await db`select to_regclass('chinatech_v2_private.store_entitlements') table_name`)[0].table_name)await db`delete from chinatech_v2_private.store_entitlements where store_id=${store}`;await db`delete from chinatech_v2.stores where id=${store}`;}finally{await runtime.end();await db.end();}}
