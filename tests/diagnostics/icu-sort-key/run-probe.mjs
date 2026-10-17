// Public diagnostic only, never imports an application module or contacts a service.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),args=Object.fromEntries(process.argv.slice(2).map(value=>{assert(value.startsWith('--'));const index=value.indexOf('=');return index<0?[value.slice(2),true]:[value.slice(2,index),value.slice(index+1)];}));
assert(Object.keys(args).every(key=>['run','out','headers','expected-node'].includes(key)));assert(args.run===undefined||args.run===true);
const expectedNode=args['expected-node']??'v24.19.0';assert(['v24.19.0','v24.21.0'].includes(expectedNode),'Explicit reviewed diagnostic runtime required');
if(!args.run){console.log(JSON.stringify({planOnly:true,expectedNode,expectedIcu:'78.3',expectedUnicode:'17.0',compilation:false,connections:0,operation:'Compile exact Node ICU78 public C API native diagnostic and compare 53 values in both modes against original Intl,5618 pairs and exact original14 order. Explicit --run required.',boundary:'No product dependency, SQL, Auth, browser, service, runtime installation or production claim.'}));process.exit(0);}
assert.equal(process.version,expectedNode);assert.equal(process.versions.icu,'78.3');assert.equal(process.versions.unicode,'17.0');assert.equal(new Intl.Collator().resolvedOptions().locale,'en-US');
const output=resolve(args.out??'.local/native-sort-key-diagnostic'),subpath=relative(process.cwd(),output);assert(subpath.startsWith('.local/')&&!subpath.split('/').includes('..')&&!existsSync(output),'Use a fresh project-local .local output');mkdirSync(output,{recursive:true});
const headers=resolve(args.headers??resolve(dirname(process.execPath),'../include/node'));assert(existsSync(headers+'/node_api.h'),'Existing Node API headers required, never download dependencies here');
const sha=value=>createHash('sha256').update(value).digest('hex'),source=here+'/probe.cc',addon=output+'/probe.node',fixtureBytes=readFileSync(here+'/public-fixture.json'),fixture=JSON.parse(fixtureBytes);
assert.equal(sha(fixtureBytes),'c37378dbe5165dad73d077ce981409eeffbb7bb828038cbe9ed2df4cd62aeb0f');assert.equal(sha(readFileSync(source)),'ac0598da52deca433d6d1d56cb8c0eb9526780b72489c7da200ff02c752e4ccf');assert.equal(fixture.originalReportSHA256,'67666aa7646ca506f25aa0f53b14ad73dda12476d75e48e0ed828a2c2113b199');assert.equal(fixture.values.length,14);
const report={expectedNode,condition:'Public values and the explicitly declared Node24 runtime own ICU78 symbols only. Native compilation and actual addon import must succeed on this platform. No product loader, tracing/deployment, database or canonical maintenance proof.',runtime:{node:process.version,icu:process.versions.icu,unicode:process.versions.unicode,platform:process.platform,arch:process.arch},sourceSHA256:sha(readFileSync(source)),fixtureSHA256:sha(fixtureBytes),complete:false,pairs:0};
try{
 assert(['linux','darwin'].includes(process.platform));const compiler=process.platform==='linux'?'g++':'clang++',options=process.platform==='linux'?['-shared','-fPIC']:['-bundle','-undefined','dynamic_lookup'];
 execFileSync(compiler,['-std=c++17','-DNAPI_VERSION=8',...options,'-I'+headers,source,'-o',addon],{timeout:30000,maxBuffer:10000});report.addonSHA256=sha(readFileSync(addon));
 const native=createRequire(import.meta.url)(addon),names=new Intl.Collator('en',{sensitivity:'base',numeric:true});
 const values=[...fixture.values.map(row=>row.normalized),'','A','a','á','a\u0301','å','Å','A10','A010','A2','a-2','a 2','a_2','a.2','中文','𖺠','𖻛','Σ','σ','ς','İ','i\u0307','ß','ss','æ','Æ','ﬃ','ffi','\ud800','\udfff','x\0y','xy','x\u200dy','x\u200cy','x\u0301\u0327','x\u0327\u0301',...['0','1','9'].map(d=>'a'+d.repeat(254))];assert.equal(values.length,53);
 for(const mode of [true,false]){const keyed=values.map(value=>native.key(value,mode));for(const result of keyed){assert.deepEqual(result.ucaVersion,[17,0,0,0]);assert.deepEqual(result.collatorVersion,[153,136,0,0]);assert(Buffer.isBuffer(result.key));assert.equal(result.key.at(-1),0);}for(let i=0;i<values.length;i++)for(let j=0;j<values.length;j++){assert.equal(Math.sign(Buffer.compare(keyed[i].key,keyed[j].key)),Math.sign(mode?names.compare(values[i],values[j]):values[i].localeCompare(values[j])));report.pairs++;}}
 const ordered=fixture.values.map(row=>({...row,name:native.key(row.normalized,true).key,tie:native.key(row.key,false).key})).sort((a,b)=>Buffer.compare(a.name,b.name)||Buffer.compare(a.tie,b.tie)).map(row=>row.key);assert.deepEqual(ordered,fixture.nodeOrder);assert.equal(report.pairs,5618);report.original14OrderExact=true;report.complete=true;
}catch(error){report.error={name:error.name,message:String(error.message).slice(0,400)};process.exitCode=1;}
writeFileSync(output+'/report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
