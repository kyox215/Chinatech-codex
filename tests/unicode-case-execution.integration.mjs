import assert from 'node:assert/strict';
import {existsSync,readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import postgres from 'postgres';

const migration='supabase/migrations/20261017122335_performance_unicode_case_execution.sql';
const prior='supabase/migrations/20261017063155_performance_unicode17_compatibility.sql';
const inputs=[migration,prior,'scripts/unicode/unicode17-data.json','tests/data/unicode17-normalization.txt.gz','tests/unicode-case-execution.integration.mjs'];
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const sourceSha256=Object.fromEntries(inputs.map(file=>[file,sha(file)]));
if(!process.argv.includes('--run')){
 console.log(JSON.stringify({planOnly:true,target:'Dedicated SQL-only 127.0.0.1:55432/ct_perf_acceptance_icu_20261017',sourceSha256,changes:'Function replacement inside one rolled-back transaction; no business rows/model/index changes',checks:['All official normalization-column inputs lowercased against prior SQL and actual Node','All Unicode17 data scalars and full Cased/Case_Ignorable/Mark contexts','Five 5000-UTF16 shapes; old one sample/new thirty samples, function only','Actual internal SQL EXPLAIN ANALYZE BUFFERS, and prior installed function restored byte-for-byte on success or failure','Actual384MiB SQL-only container below85%, VM available128MiB, unchanged OOM: each phase/every2000 vectors/every5 timed calls/between plans; guards outside timing']}));
 process.exit(0);
}
const output=process.argv.find(value=>value.startsWith('--out='))?.slice(6);
assert(output&&/^\.\.\/proof\/[a-z0-9-]+\.json$/.test(output),'Explicit fresh proof output is required');
assert(!existsSync(output),'Proof output must be new before any SQL begins');
const config=JSON.parse(readFileSync('../../../.company-tmp/performance-20261017/clean-database/fresh-instance/icu-connection.private.json','utf8'));
const url=new URL(config.DB_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55432');assert.equal(url.pathname,'/ct_perf_acceptance_icu_20261017');
const sql=postgres(config.DB_URL,{max:1,prepare:false}),rollback=new Error('Rollback equivalent Unicode execution oracle');
const result={condition:'Public Unicode only; dedicated local PG17.11/ICU database. Function timings/plan are not canonical write, HTTP, Auth, browser or production/P95 evidence. Idle Storage is held as a separately recorded local resource condition.',sourceSha256,runtime:{node:process.versions.node,icu:process.versions.icu,unicode:process.versions.unicode},checks:[],resourceSamples:[]};
function resources(){const raw=execFileSync('docker',['exec','ct-performance-isolated-20261017','cat','/sys/fs/cgroup/memory.current','/sys/fs/cgroup/memory.max','/sys/fs/cgroup/memory.events','/proc/meminfo'],{encoding:'utf8',timeout:5000}),lines=raw.split('\n');return{current:Number(lines[0]),limit:Number(lines[1]),available:Number(/^MemAvailable:\s+(\d+) kB$/m.exec(raw)[1])*1024,oom:Number(/^oom_kill (\d+)$/m.exec(raw)[1])};}
let baseline,definition;
function resourceCheck(label){const value=resources();baseline??=value;result.resourceSamples.push({label,...value});assert.equal(value.limit,384*1024*1024);assert(value.current<value.limit*.85,label+' SQL-only cgroup margin');assert(value.available>=128*1024*1024,label+' VM margin');assert.equal(value.oom,baseline.oom,label+' OOM unchanged');}
const oldBody=/as \$\$([\s\S]*?)\$\$;/.exec(readFileSync(prior,'utf8').split('create function chinatech_v2_private.unicode17_lower(value text)returns text\n')[1])[1];
const data=JSON.parse(readFileSync('scripts/unicode/unicode17-data.json','utf8'));
const decode=hex=>String.fromCodePoint(...hex.trim().split(/\s+/).filter(Boolean).map(point=>parseInt(point,16)));
const official=new Set();
for(const raw of gunzipSync(readFileSync('tests/data/unicode17-normalization.txt.gz')).toString('utf8').split(/\r?\n/)){
 const line=raw.split('#')[0].trim();if(!line||line.startsWith('@'))continue;
 for(const hex of line.split(';').slice(0,5))official.add(decode(hex));
}
try{
 resourceCheck('before SQL');
 definition=(await sql`select pg_get_functiondef('chinatech_v2_private.unicode17_lower(text)'::regprocedure) body`)[0].body;
 result.ownedBackendPid=(await sql`select pg_backend_pid() pid`)[0].pid;
 assert.equal((await sql`select prosrc from pg_proc where oid='chinatech_v2_private.unicode17_lower(text)'::regprocedure`)[0].prosrc,oldBody);
 try{await sql.begin(async tx=>{
  await tx`set local statement_timeout='30s'`;
  await tx`create temporary table unicode_case_execution_guard(value boolean) on commit drop`;
  await tx.unsafe(definition.replace('chinatech_v2_private.unicode17_lower','pg_temp.unicode17_lower_before'));
  await tx.unsafe(readFileSync(migration,'utf8'));
  const compare=async(values,label)=>{
   resourceCheck(label+' before');
   for(let start=0;start<values.length;start+=200){
    const rows=await tx`select value,pg_temp.unicode17_lower_before(value) prior,chinatech_v2_private.unicode17_lower(value) actual from unnest(${tx.array(values.slice(start,start+200),25)})value`;
    for(const row of rows){assert.equal(row.actual,row.prior,label+' prior SQL '+JSON.stringify(row.value));assert.equal(row.actual,row.value.toLocaleLowerCase('en-US'),label+' Node '+JSON.stringify(row.value));}
    if(start%2000===0)resourceCheck(label+' vectors '+Math.min(start+200,values.length));
   }
   resourceCheck(label+' after');
   result.checks.push({label,count:values.length});console.log(label+' '+values.length+' passed');
  };
  await compare([...official],'Official Unicode17 normalization-column unique inputs');
  await compare([...new Set([...data.rows.map(([point])=>String.fromCodePoint(point)),...Array.from({length:127},(_,i)=>String.fromCodePoint(i+1))])],'Complete Unicode17 scalar data and ASCII');
  const contexts=new Set(['Σ','AΣ','AΣA','ΣA','\u0345Σ','AΣ\u0345','AΣ\u{1E6E3}A','\u{16EA0}Σ','AΣ\u0897A','AΣ A','AΣ\u0301','AΣ\u0301A']);
  for(let point=1;point<=0x10ffff;point++){
   if(point>=0xd800&&point<=0xdfff)continue;
   const value=String.fromCodePoint(point);
   if(/\p{Mark}/u.test(value)){contexts.add('q\u0315'+value);contexts.add('q'+value+'\u0301');}
   if(/\p{Cased}|\p{Case_Ignorable}/u.test(value)){contexts.add(value+'Σ');contexts.add('AΣ'+value+'A');contexts.add('A'+value+'Σ');contexts.add('AΣ'+value);}
  }
  await compare([...contexts],'Complete Mark and contextual Sigma/Cased/Case_Ignorable vectors');
  const fields=[['ascii','DEMO '.repeat(1000)],['unmapped-cjk','型'.repeat(5000)],['mapped-cjk','꟎'+'型'.repeat(4999)],['contextual-sigma','AΣ\u{1E6E3}A'.repeat(1000)],['all-sigma','Σ'.repeat(5000)]];
  result.functionSamples=[];
  for(const[name,value]of fields){
   resourceCheck(name+' before old sample');
   assert.equal(value.length,5000);const expected=value.toLocaleLowerCase('en-US'),started=performance.now();
   assert.equal((await tx`select pg_temp.unicode17_lower_before(${value}) value`)[0].value,expected);
   const priorSingleMs=performance.now()-started,samples=[];
   resourceCheck(name+' after old sample');
   for(let sample=0;sample<30;sample++){const started=performance.now();assert.equal((await tx`select chinatech_v2_private.unicode17_lower(${value}) value`)[0].value,expected);samples.push(performance.now()-started);if(sample%5===4)resourceCheck(name+' after new sample '+(sample+1));}
   result.functionSamples.push({name,inputUtf16:value.length,inputUtf8:Buffer.byteLength(value),priorSingleMs,newSamplesMs:samples,newP95Ms:samples.toSorted((a,b)=>a-b)[28]});
  }
  const nextBody=readFileSync(migration,'utf8').split('as $$')[1].split('$$;')[0];
  const internal=(body,branch)=>{
   const raw=branch==='no-sigma'?/if strpos\(prepared,'Σ'\)=0 then\s*([\s\S]*?);\s*return/.exec(body)[1]:body.slice(body.indexOf('with chars as materialized(')).split(';\n return')[0];
   return raw.replace(/\binto result\b/,'').replace(/\bprepared\b/g,'$1');
  };
  result.plans={};
  for(const[name,body,branch,value]of [['prior-mapped-cjk',oldBody,'sigma',fields[2][1]],['new-mapped-cjk',nextBody,'no-sigma',fields[2][1]],['prior-sigma',oldBody,'sigma',fields[3][1]],['new-sigma',nextBody,'sigma',fields[3][1]]]){
   resourceCheck(name+' before EXPLAIN');
   const rows=await tx.unsafe('explain(analyze,buffers,format json) '+internal(body,branch),[value.replace(/[A-Z]/g,c=>c.toLowerCase())]);
   result.plans[name]=rows[0]['QUERY PLAN'];
   resourceCheck(name+' after EXPLAIN');
  }
  result.checks.push({label:'Five valid maximum text shapes and actual internal SQL plans',count:fields.length});
  throw rollback;
 });}catch(error){if(error!==rollback)throw error;}
 for(const file of inputs)assert.equal(sha(file),sourceSha256[file]);
 result.complete=true;
}catch(error){result.complete=false;result.error={name:error.name,message:error.message};process.exitCode=1;}
finally{
 try{if(definition){assert.equal((await sql`select pg_get_functiondef('chinatech_v2_private.unicode17_lower(text)'::regprocedure) body`)[0].body,definition);result.originalDefinitionRestored=true;result.cleanup='Original installed Unicode9 function definition byte-identical after explicit transaction rollback; no business entities created';}resourceCheck('after rollback');}
 catch(error){result.complete=false;result.restorationError={name:error.name,message:error.message};process.exitCode=1;}
 await sql.end();writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
}
console.log(JSON.stringify({complete:result.complete,checks:result.checks,output}));
