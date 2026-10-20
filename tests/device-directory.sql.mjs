// Runs only against the existing loopback database. Every migration, fixture and
// injected failure is enclosed in one ROLLBACK transaction; no reset or persistence.
import assert from 'node:assert/strict';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import postgres from 'postgres';
import {directory,catalog} from './helpers/directory-modules.mjs';
const path=process.env.DIRECTORY_TEST_CONNECTION;if(!path)throw new Error('DIRECTORY_TEST_CONNECTION must point to the local private connection file');
const config=JSON.parse(readFileSync(path,'utf8')),url=new URL(config.DB_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55422');assert.equal(url.pathname,'/postgres');assert.equal(url.username,'postgres');
const db=postgres(config.DB_URL,{max:1,connect_timeout:5,onnotice:()=>{}}),migration=readFileSync('supabase/migrations/20261018085930_global_device_directory_snapshot.sql','utf8');
const rows=JSON.parse(readFileSync('data/device-catalog/catalog.json','utf8')).filter(r=>r.enabled).map(r=>({...r,notes:'PRIVATE-DIRECTORY-TEST',sourceUrls:['https://private.invalid/fixture'],markets:['PRIVATE']}));
const result={database:'127.0.0.1:55422/postgres',roles:['postgres','chinatech_runtime','anon','authenticated'],checks:[]};
const marker=new Error('ROLLBACK_DIRECTORY_TEST');
async function baseline(){const [r]=await db`select (select count(*)::int from chinatech_v2_private.device_catalog_entries) as entries,(select revision::text from chinatech_v2_private.device_catalog_control where singleton) as revision,to_regclass('chinatech_v2_private.device_directory_versions') as snapshots`;return r;}
const before=await baseline();assert.equal(before.entries,0,'local directory fixtures require an empty catalog; do not replace existing data');assert.equal(before.snapshots,null);
try{
 await db.begin(async tx=>{
  await tx`set local lock_timeout='2s'`;await tx`set local statement_timeout='15s'`;
  await tx`lock table chinatech_v2_private.device_catalog_entries,chinatech_v2_private.device_catalog_control in access exclusive mode`;
  const values=rows.map(r=>({id:r.id,category:r.category,brand:r.brand,family:r.family,enabled:r.enabled,release_sort:r.releasedAt??'',name_sort:r.name.toLowerCase(),search_text:r.name,identity_key:r.id,version:1,data:r}));
  await tx`insert into chinatech_v2_private.device_catalog_entries ${tx(values,'id','category','brand','family','enabled','release_sort','name_sort','search_text','identity_key','version','data')}`;
  await tx.unsafe(migration);
  async function snapshot(){const [m]=await tx`select v.manifest_body from chinatech_v2_private.device_directory_pointer p join chinatech_v2_private.device_directory_versions v using(version)`;const shards=await tx`select shard_key,body from chinatech_v2_private.device_directory_shards where version=${JSON.parse(m.manifest_body).version}`;return {manifest:m.manifest_body,shards:Object.fromEntries(shards.map(r=>[r.shard_key,r.body])),checkedAt:Date.now()};}
  const initial=await snapshot(),validated=await directory.validateDirectoryPackage(initial);assert.equal(validated.models.length,3476);assert.equal(validated.manifest.shards.length,56);
  assert.deepEqual(new Set(validated.models.map(r=>r.id)),new Set(rows.map(r=>r.id)));for(const row of validated.models)assert.deepEqual(Object.keys(row).sort(),Object.keys(catalog.catalogPickerModel(rows[0])).sort());assert.equal(JSON.stringify(initial).includes('PRIVATE-DIRECTORY-TEST'),false);
  const [owners]=await tx`select bool_and(p.proowner=n.nspowner and p.prosecdef and p.proconfig=ARRAY['search_path=""']) as safe from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='chinatech_v2_private' and p.proname in ('publish_device_directory','device_directory_revision_changed')`;assert.equal(owners.safe,true);
  result.checks.push('real SQL whitelist 3476/56 + exact SHA parsing + private markers excluded + empty search_path/same owner');
  await tx`grant chinatech_runtime to postgres with set true`; // test-only membership option, rolled back below
  async function denied(run){await assert.rejects(tx.savepoint(run),e=>e.code==='42501');}
  await tx.savepoint(async scoped=>{
   await scoped`set local role chinatech_runtime`;await scoped`select set_config('request.jwt.claims','{"role":"anon"}',true)`;
   const [r]=await scoped`select count(*)::int as count from chinatech_v2_private.device_directory_versions`;assert.equal(r.count,1);
   const [privateRows]=await scoped`select count(*)::int as count from chinatech_v2_private.device_catalog_entries`;assert.equal(privateRows.count,0);
   await assert.rejects(scoped.savepoint(q=>q`update chinatech_v2_private.device_directory_pointer set version=version`),e=>e.code==='42501');
   await assert.rejects(scoped.savepoint(q=>q`select chinatech_v2_private.publish_device_directory()`),e=>e.code==='42501');
   await assert.rejects(scoped.savepoint(q=>q`select chinatech_v2_private.device_directory_revision_changed()`),e=>e.code==='42501');
   await scoped`reset role`;
  });
  for(const role of ['anon','authenticated'])await denied(async q=>{await q.unsafe('set local role '+role);await q`select * from chinatech_v2_private.device_directory_versions`;});
  result.checks.push('runtime anonymous snapshot SELECT works; source RLS remains empty; runtime writes/functions and anon/authenticated direct access denied');
  await tx`update chinatech_v2_private.device_catalog_control set revision=revision where singleton`;await tx`select chinatech_v2_private.publish_device_directory()`;
  const [{count}]=await tx`select count(*)::int as count from chinatech_v2_private.device_directory_versions`;assert.equal(count,1);
  const id=rows[0].id;
  await tx`update chinatech_v2_private.device_catalog_entries set enabled=false,data=jsonb_set(data,'{enabled}','false'::jsonb) where id=${id}`;
  await tx`update chinatech_v2_private.device_catalog_control set revision=revision+1 where singleton`;
  assert.equal((await directory.validateDirectoryPackage(await snapshot())).models.length,3475);
  await tx`update chinatech_v2_private.device_catalog_entries set enabled=true,data=jsonb_set(data,'{enabled}','true'::jsonb) where id=${id}`;
  await tx`update chinatech_v2_private.device_catalog_control set revision=revision+1 where singleton`;
  const restored=await snapshot();assert.equal((await directory.validateDirectoryPackage(restored)).models.length,3476);
  const [retained]=await tx`select count(*)::int as count from chinatech_v2_private.device_directory_versions`;assert.equal(retained.count,3);
  const [old]=await tx`select count(*)::int as count from chinatech_v2_private.device_directory_shards where version=${validated.manifest.version}`;assert.equal(old.count,56);
  result.checks.push('revision noop/idempotent replay produces no version; disable/apply and restore/rollback publish new complete versions, old immutable version retained');
  await tx.unsafe("create function pg_temp.directory_test_failure() returns trigger language plpgsql as $$begin raise exception 'DIRECTORY_TEST_FAILURE'; end$$");
  await tx.unsafe('create trigger directory_test_failure before insert on chinatech_v2_private.device_directory_shards for each row execute function pg_temp.directory_test_failure()');
  await assert.rejects(tx.savepoint(async q=>{
   await q`update chinatech_v2_private.device_catalog_entries set enabled=false,data=jsonb_set(data,'{enabled}','false'::jsonb) where id=${id}`;
   await q`update chinatech_v2_private.device_catalog_control set revision=revision+1 where singleton`;
  }),e=>e.message==='DIRECTORY_TEST_FAILURE');
  assert.equal((await snapshot()).manifest,restored.manifest);
  const [entry]=await tx`select enabled from chinatech_v2_private.device_catalog_entries where id=${id}`;assert.equal(entry.enabled,true);
  const [versions]=await tx`select count(*)::int as count from chinatech_v2_private.device_directory_versions`;assert.equal(versions.count,3);
  result.checks.push('injected shard insert failure rolls back source change/revision/version/pointer atomically');
  result.models=validated.models.length;result.shards=validated.manifest.shards.length;result.shardBytes=validated.bytes;result.packageBytes=Buffer.byteLength(JSON.stringify({manifest:initial.manifest,shards:initial.shards}));
  throw marker;
 });
}catch(e){if(e!==marker)throw e;}finally{await db.end();}
const verify=postgres(config.DB_URL,{max:1,onnotice:()=>{}});try{const [after]=await verify`select (select count(*)::int from chinatech_v2_private.device_catalog_entries) as entries,(select revision::text from chinatech_v2_private.device_catalog_control where singleton) as revision,to_regclass('chinatech_v2_private.device_directory_versions') as snapshots`;assert.deepEqual(after,before);}finally{await verify.end();}
result.checks.push('after ROLLBACK original empty catalog/control revision and absent new tables restored');mkdirSync('.local/device-directory',{recursive:true});writeFileSync('.local/device-directory/sql-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
