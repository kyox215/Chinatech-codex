import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync,writeFileSync,renameSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sourceLoader} from '../../tests/helpers/typescript-source.mjs';
export const productionProjectRef='xluzcoduqsdvjoouqhkc';
export const activationFamilies=Object.freeze(['customer-directory','procurement-list','repair-list','retail-form-values','retail-list','customer-records','customer-devices','dashboard']);
export const activationModelTables=Object.freeze(['customer_directory_models','procurement_list_models','repair_list_models','retail_form_models','retail_list_models','customer_record_models','customer_device_models','dashboard_models']);
export const protectedTables=Object.freeze(['stores','accounts','store_memberships','store_entitlements']);
export const canonicalTables=Object.freeze(['customers','customer_devices','repair_intakes','retail_units','retail_history_records','procurement_records','store_state','intake_photos','intake_photo_objects']);
export const activationSHA=bytes=>createHash('sha256').update(bytes).digest('hex');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i,hash=/^[a-f0-9]{64}$/;
export function sourceManifest(root=process.cwd()) {
 const paths=[];function scan(folder){for(const e of readdirSync(resolve(root,folder),{withFileTypes:true})){const p=folder+'/'+e.name;if(e.isDirectory())scan(p);else if(e.isFile()&&/\.(?:ts|mjs|cjs|json|cc|node)$/.test(p))paths.push(p);}}
 for(const folder of ['lib','data','scripts/lib','tests/helpers','native/icu-sort-key'])scan(folder);
 paths.push('scripts/activate-production.mjs','package.json','package-lock.json',...activationFamilies.map(name=>'scripts/backfill-'+name+'.mjs'));
 return Object.fromEntries([...new Set(paths)].sort().map(p=>[p,activationSHA(readFileSync(resolve(root,p)))]));
}
export function currentModelSpecs(){
 const load=sourceLoader(),{projectionQueryRulesHash:query_rules_hash}=load('./lib/backend/query-rules-version');
 const base={format_version:1,query_rules_hash},result=Object.fromEntries(activationModelTables.map(p=>[p,{...base}]));
 Object.assign(result.retail_list_models,{vocabulary_hash:load('./lib/backend/retail-vocabulary-version').retailVocabularyHash,sort_rules_hash:load('./lib/server/intl-sort-contract').nativeSortRulesHash});
 Object.assign(result.retail_form_models,{format_version:load('./lib/backend/unicode17-version').retailFormModelFormat,rules_hash:load('./lib/backend/unicode17-version').retailFormProjectionHash});
 result.customer_record_models.rules_hash=load('./lib/backend/customer-detail-version').customerRecordRulesHash;
 result.customer_device_models.rules_hash=load('./lib/backend/customer-device-version').customerDeviceRulesHash;
 result.dashboard_models.rules_hash=load('./lib/backend/dashboard-version').dashboardRulesHash;
 return result;
}
export function assertSourceManifest(expected,root=process.cwd()){assert.deepEqual(sourceManifest(root),expected,'Exact reviewed operator/native/source closure required');}
export function admitProductionConnection(value,target){
 assert.equal(target.projectRef,productionProjectRef);assert(uuid.test(target.storeId));const u=new URL(value);
 assert.equal(u.protocol,'postgresql:');assert.equal(u.pathname,'/postgres');assert.equal(u.port||'5432','5432');assert.equal(u.hostname,target.host);assert.equal(decodeURIComponent(u.username),target.username);
 assert(u.password.length>0);assert(!u.hash);assert([...u.searchParams.keys()].every(k=>['sslmode'].includes(k)));if(u.searchParams.has('sslmode'))assert(['require','verify-full'].includes(u.searchParams.get('sslmode')));
 const direct=u.hostname==='db.'+productionProjectRef+'.supabase.co'&&u.username==='postgres';
 const pool=/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(u.hostname)&&decodeURIComponent(u.username)==='postgres.'+productionProjectRef;
 assert(direct||pool,'Only this project direct or session-pool endpoint is permitted');return u;
}
export function validateActivationContract(c,{inspect=false}={}){
 assert.equal(c.version,1);assert.equal(c.target.projectRef,productionProjectRef);assert(uuid.test(c.target.storeId));assert.equal(c.target.database,'postgres');assert.equal(typeof c.target.installer,'string');assert(c.target.installer.length>0);
 assert.equal(c.maximumRows,200);assert.equal(c.statementTimeoutMs,30000);assert.equal(c.lockTimeoutMs,5000);assert(Number.isSafeInteger(c.maximumCanonicalRows)&&c.maximumCanonicalRows>0&&c.maximumCanonicalRows<=10000);
 assert.deepEqual(c.families,activationFamilies);assert(c.sourceSHA256&&Object.keys(c.sourceSHA256).length>100);assert(Object.values(c.sourceSHA256).every(v=>hash.test(v)));
 assert.equal(c.resourceProbe.cloudMemoryMeasured,false);assert(c.resourceProbe.sourceSHA256&&Object.keys(c.resourceProbe.sourceSHA256).length>0);assert(Object.values(c.resourceProbe.sourceSHA256).every(v=>hash.test(v)));assert(hash.test(c.resourceProbe.sha256));assert.equal(c.resourceProbe.minimumCallerAvailableBytes,128*1024*1024);assert(c.resourceProbe.maximumAgeMs>0&&c.resourceProbe.maximumAgeMs<=30000);assert(c.resourceProbe.maximumOtherClients>=0&&c.resourceProbe.maximumOtherClients<=100);
 assert.deepEqual(c.models,currentModelSpecs(),'Model specs must match current reviewed source constants');assert.equal(Object.keys(c.models).length,8);for(const name of activationModelTables){const model=c.models[name];assert(model&&Number.isSafeInteger(model.format_version));assert(hash.test(model.query_rules_hash));for(const[k,v]of Object.entries(model))if(k.endsWith('_hash'))assert(hash.test(v));}
 assert.equal(c.protectedRowContentsRead,false,'Business protected-row reads have not been approved');
 if(!inspect){assert(hash.test(c.installedMetadataSHA256));assert.deepEqual(Object.keys(c.canonical).sort(),[...canonicalTables].sort());for(const v of Object.values(c.canonical)){assert(/^\d+$/.test(v.count));assert(/^[a-f0-9]{32}$/.test(v.digest));}}
 return c;
}
export function privateJSON(path){assert.equal(statSync(path).mode&0o777,0o600,'Private activation file must be0600');return JSON.parse(readFileSync(path,'utf8'));}
export function safeOperatorSummary(value){assert.equal(value.pass,true);assert.equal(value.activated,true);const summary={pass:true,activated:true};for(const[k,v]of Object.entries(value))if(typeof v==='number'){assert(Number.isFinite(v)&&v>=0);summary[k]=v;}return summary;}
export function countNotice(report){return()=>{report.noticeCount=(report.noticeCount??0)+1;};}
export function safeError(error){return{name:['AssertionError','Error','PostgresError','TypeError'].includes(error?.name)?error.name:'Error',code:(/^[A-Z0-9]{5}$/.test(error?.code??'')||['ERR_ASSERTION','ECONNRESET','ECONNREFUSED','ETIMEDOUT','ENOTFOUND'].includes(error?.code))?error.code:'ACTIVATION_STOP'};}
export function writeJournal(path,value){const temporary=path+'.pending';writeFileSync(temporary,JSON.stringify(value,null,2)+'\n',{mode:0o600});renameSync(temporary,path);}
export async function catalogFingerprint(sql){
 const rows=await sql`with objects as(
 select 'function:'||p.oid::regprocedure::text key,jsonb_build_object('definition',pg_get_functiondef(p.oid),'owner',p.proowner,'acl',p.proacl) value from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('chinatech_v2','chinatech_v2_private') and p.prokind in('f','p')
 union all select 'relation:'||n.nspname||'.'||c.relname,jsonb_build_object('kind',c.relkind,'owner',c.relowner,'acl',c.relacl,'rls',c.relrowsecurity,'force',c.relforcerowsecurity)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('chinatech_v2','chinatech_v2_private')
 union all select 'column:'||a.attrelid::regclass::text||':'||a.attnum,jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'acl',a.attacl,'default',pg_get_expr(d.adbin,d.adrelid))from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where n.nspname in('chinatech_v2','chinatech_v2_private')and a.attnum>0 and not a.attisdropped
 union all select 'constraint:'||c.connamespace::text||':'||c.conrelid::text||':'||c.contypid::text||':'||c.conname,to_jsonb(pg_get_constraintdef(c.oid))from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in('chinatech_v2','chinatech_v2_private')
 union all select 'index:'||i.indexrelid::regclass::text,jsonb_build_object('definition',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid,'ready',i.indisready)from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('chinatech_v2','chinatech_v2_private')
 union all select 'trigger:'||t.tgrelid::regclass::text||':'||t.tgname,jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled)from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('chinatech_v2','chinatech_v2_private')
 union all select 'policy:'||p.polrelid::regclass::text||':'||p.polname,to_jsonb(p)from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('chinatech_v2','chinatech_v2_private')
 union all select 'role:'||r.rolname,to_jsonb(r)from pg_roles r where r.rolname in('postgres','chinatech_runtime','chinatech_unicode_reader','anon','authenticated','service_role')
 union all select 'membership:'||m.roleid||':'||m.member||':'||m.grantor,to_jsonb(m)from pg_auth_members m
 union all select 'schema:'||n.nspname,jsonb_build_object('owner',n.nspowner,'acl',n.nspacl)from pg_namespace n where n.nspname in('chinatech_v2','chinatech_v2_private')
 union all select 'default-acl:'||d.defaclrole::text||':'||d.defaclnamespace::text||':'||d.defaclobjtype::text,to_jsonb(d)from pg_default_acl d where d.defaclnamespace=0 or d.defaclnamespace in(select n.oid from pg_namespace n where n.nspname in('chinatech_v2','chinatech_v2_private'))
 union all select 'collation:'||c.collname,to_jsonb(c)from pg_collation c join pg_namespace n on n.oid=c.collnamespace where n.nspname='chinatech_v2_private'
 )select count(*)::text count,md5(coalesce(string_agg(key||':'||value::text,E'\n'order by key collate "C"),''))digest from objects`;
 return activationSHA(JSON.stringify(rows[0]));
}
export async function canonicalFingerprint(sql,maximumRows,storeId){
 assert(uuid.test(storeId));
 const result={};let total=0;for(const table of canonicalTables){const[row]=await sql`select count(*)::text count from ${sql('chinatech_v2_private.'+table)} where store_id=${storeId}`;total+=Number(row.count);assert(total<=maximumRows,'Reviewed small-production canonical row budget exceeded');result[table]={count:row.count};}
 for(const table of canonicalTables){const[row]=await sql`select count(*)::text count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),''order by md5(to_jsonb(t)::text)collate "C"),''))digest from ${sql('chinatech_v2_private.'+table)} t where store_id=${storeId}`;assert.equal(row.count,result[table].count);result[table]=row;}return result;
}
export async function inspectModelStates(tx,c){const models={};
 for(const table of activationModelTables){const[row]=await tx`select to_jsonb(m)||jsonb_build_object('generation',m.generation::text) document from ${tx('chinatech_v2_private.'+table)} m where store_id=${c.target.storeId}`;if(!row){models[table]={present:false};continue;}const value=row.document;for(const[k,v]of Object.entries(c.models[table]))assert.equal(value[k],v,'Installed exact model version/hash required');models[table]={present:true,ready:value.ready,generation:value.generation,verified_at:value.verified_at??null,cursorSHA256:activationSHA(JSON.stringify(value.backfill_cursor??null)),...c.models[table]};}
 return models;
}
export async function captureActivationState(sql,c){
 return sql.begin('isolation level repeatable read read only',async tx=>{
  const[identity]=await tx`select current_database() database,current_user installer,current_setting('server_version_num')::integer version,current_setting('server_encoding') encoding`;
  assert.equal(identity.database,c.target.database);assert.equal(identity.installer,c.target.installer);assert(identity.version>=170000&&identity.version<180000);assert.equal(identity.encoding,'UTF8');
  const stores=await tx`select id::text from chinatech_v2.stores order by id`;assert.equal(stores.length,1,'This release is explicitly bound to the current single production store');assert.equal(stores[0].id,c.target.storeId);
  const metadata=await catalogFingerprint(tx),canonical=await canonicalFingerprint(tx,c.maximumCanonicalRows,c.target.storeId),models={};
  Object.assign(models,await inspectModelStates(tx,c));
  return{identity,metadata,canonical,protectedRowContentsRead:false,models};
 });
}
export function assertBaseline(actual,c){assert.equal(actual.metadata,c.installedMetadataSHA256,'Installed metadata changed');assert.deepEqual(actual.canonical,c.canonical,'Canonical facts changed; never continue activation over a changed baseline');}
export async function loadResourceProbe(c,root=process.cwd()){
 for(const[p,d]of Object.entries(c.resourceProbe.sourceSHA256)){const full=resolve(root,p);assert(full.startsWith(root+sep));assert.equal(activationSHA(readFileSync(full)),d);}
 const path=resolve(root,c.resourceProbe.path);assert(path.startsWith(root+sep));assert.equal(activationSHA(readFileSync(path)),c.resourceProbe.sha256);const probeModule=await import(pathToFileURL(path).href);assert.equal(typeof probeModule.sample,'function');return probeModule.sample;
}
export function validateCallerSample(sample,c){assert.equal(typeof sample.counterSource,'string');assert(sample.counterSource.length>0&&sample.counterSource.length<=512);assert.equal(sample.cloudMemoryMeasured,false);assert.equal(sample.projectRef,productionProjectRef);assert(Number.isSafeInteger(sample.callerAvailableBytes)&&sample.callerAvailableBytes>=c.resourceProbe.minimumCallerAvailableBytes);assert(Number.isFinite(sample.observedAt)&&Math.abs(Date.now()-sample.observedAt)<=c.resourceProbe.maximumAgeMs);for(const key of ['oom','oom_kill','oom_group_kill'])assert.equal(sample.callerOOM[key],0);const local=sample.localCounters;assert(local&&local.withinGuard===true);for(const key of ['currentBytes','limitBytes','vmAvailableBytes'])assert(Number.isSafeInteger(local[key])&&local[key]>=0);assert.equal(local.limitBytes,268435456);assert(local.currentBytes<local.limitBytes*.85);assert.equal(local.vmAvailableBytes,sample.callerAvailableBytes);for(const key of ['oom','oom_kill','oom_group_kill'])assert.equal(local.events[key],0);return{observedAt:sample.observedAt,callerAvailableBytes:sample.callerAvailableBytes,callerOOM:sample.callerOOM,cloudMemoryMeasured:false,counterSource:sample.counterSource,localCounters:{currentBytes:local.currentBytes,limitBytes:local.limitBytes,vmAvailableBytes:local.vmAvailableBytes,events:local.events,withinGuard:true}};}
export async function executeActivation({sql,contract:c,report,path,sample,inspect=false,resume,shouldStop=()=>false,captureState=captureActivationState,loadOperator=name=>import('./activate-'+name+'.mjs')}){
 const save=()=>writeJournal(path,report);let family=null,transaction=0;
 async function checkpoint(label){assert(!shouldStop(),'Operator interrupted; no automatic retry');const resources=validateCallerSample(await sample(),c);const[activity]=await sql`select count(*)filter(where pid<>pg_backend_pid()and state<>'idle'and backend_type='client backend')::integer other_active,count(*)filter(where pid<>pg_backend_pid()and wait_event_type='Lock')::integer lock_waiters from pg_stat_activity where datname=current_database()`;assert(activity.other_active<=c.resourceProbe.maximumOtherClients);assert.equal(activity.lock_waiters,0,'Unexpected cloud lock waiters');report.guards.push({label,...resources,activity});save();}
 await checkpoint('before activation inspection');const before=await captureState(sql,c);report.before=before;save();
 if(inspect){report.complete=true;report.phase='inspected';report.snapshotSHA256=activationSHA(JSON.stringify(before));await checkpoint('after read-only inspection');save();return;}
 assertBaseline(before,c);
 let completed=[];
 if(resume){assert.equal(activationSHA(readFileSync(resume.path)),c.resumeApproval?.priorReportSHA256);assert.equal(resume.value.projectRef,productionProjectRef);assert.equal(resume.value.targetSHA256,report.targetSHA256);assert.equal(resume.value.sourceSHA256,report.sourceSHA256);assert.equal(resume.reconciled.complete,true);assert.equal(resume.reconciled.phase,'inspected');assert.equal(activationSHA(readFileSync(resume.reconciliationPath)),c.resumeApproval.reconciliationSHA256);assert.equal(resume.reconciled.snapshotSHA256,activationSHA(JSON.stringify(before)),'Root-reviewed reconciliation must still match actual current state');completed=resume.value.results.filter(v=>v.complete).map(v=>v.family);for(const name of completed){const model=before.models[activationModelTables[activationFamilies.indexOf(name)]];assert(model.present===true&&model.ready&&model.verified_at);}}
 const guarded=new Proxy(sql,{get(target,key){if(key==='begin')return async(...args)=>{
  await checkpoint('before '+family+' transaction');const index=++transaction;report.active={family,index,outcome:'dispatched'};save();
  const callback=args.at(-1);assert.equal(typeof callback,'function');const wrapped=async tx=>{
   await tx`lock table chinatech_v2.stores,chinatech_v2_private.customers,chinatech_v2_private.repair_intakes,chinatech_v2_private.procurement_records,chinatech_v2_private.retail_units,chinatech_v2_private.retail_history_records in share update exclusive mode`;
   assert.equal(await catalogFingerprint(tx),c.installedMetadataSHA256,'Producer/role/catalog changed while acquiring transaction locks');return callback(tx);
  };
  let value;try{value=await target.begin(...args.slice(0,-1),wrapped);}catch(error){report.active={family,index,outcome:'unknown-no-auto-replay',error:safeError(error)};save();throw error;}
  report.active={family,index,outcome:'committed'};save();await checkpoint('after '+family+' transaction');return value;
 };const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
 for(const name of activationFamilies){if(completed.includes(name))continue;family=name;report.phase='operator';report.family=name;save();const{runOperator}=await loadOperator(name);const summary=safeOperatorSummary(await runOperator({sql:guarded,storeId:c.target.storeId}));const current=await captureState(sql,c);assertBaseline(current,c);const model=current.models[activationModelTables[activationFamilies.indexOf(name)]];assert.equal(model.present,true);assert.equal(model.ready,true);assert(model.verified_at);assertSourceManifest(c.sourceSHA256);report.results.push({family:name,complete:true,summary,generation:model.generation});report.after=current;save();}
 await checkpoint('instant after all8 operators');report.complete=true;report.phase='complete';delete report.active;save();
}
