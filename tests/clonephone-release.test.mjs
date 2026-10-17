import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash, randomUUID, randomBytes, sign } from 'node:crypto';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { load, env, keys, publicKey, tokens } from './office-desktop-v3.test.mjs';
const native = createRequire(import.meta.url), { NextRequest, NextResponse } = native('next/server');
const metadata = {};
new Function('exports', ts.transpileModule(readFileSync('lib/toolbox/clonephone-release.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(metadata);
const release = metadata.clonephoneRelease;

test('Clone Phone public APK and checksum bind the exact supplied bytes; old public phone files are absent', () => {
 const bytes=readFileSync('public'+release.apkPath);
 assert.equal(bytes.length,32358088);assert.equal(bytes.length,release.bytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),release.sha256);
 assert.equal(release.version,'14.7.34_third');assert.equal(release.versionCode,140734);assert.equal(release.minSdk,26);assert.equal(release.packageName,'com.coloros.backuprestore');
 assert.equal(readFileSync('public'+release.checksumsPath,'utf8'),release.sha256+'  '+release.filename+'\n');
 assert.deepEqual(readdirSync('public/toolbox/clonephone').sort(),['SHA256SUMS.txt',release.filename].sort());
 assert.equal(existsSync('public/toolbox/phone-current'),false);
 const page=readFileSync('components/toolbox/android-transfer-page.tsx','utf8');
 for(const retired of ['MimoverOriginalDownload','SmartSwitchExperimentDownload','androidAssistantRelease','DeviceChoices'])assert.equal(page.includes(retired),false);
 assert.equal(page.includes('DownloadLink'),true);
});

function recoveryHarness(){
 const h={existing:[],known:[],inserts:0,updates:0,reads:0};
 const tx=async(strings)=>{const q=strings.join('?');h.reads++;if(q.includes('select key_hash'))return h.known;if(q.includes('select job_id'))return h.existing;if(q.startsWith('update ')){h.updates++;return [];}if(q.startsWith('insert ')){h.inserts++;return [];}throw Error(q);};
 const database={requestRateV3:async()=>{},lockV3:async()=>{},transactionV3:async(_body,_hash,_op,_source,run)=>run(tx)};
 const server=load('lib/toolbox/tool-client-server.ts',{'./office-desktop-v3-database':database,'./tool-registry-server':{readTool:async()=>{throw Error('Retired tool must not fetch a current download or admit new tasks');}},'./office-server':{officeResponse:r=>r},'./office-desktop-server':{desktopBody:r=>r.json(),desktopFailure:e=>NextResponse.json({code:e.code??'SERVICE_UNAVAILABLE'},{status:e.status??503})},'./office-desktop-v3-server':{sourceHashV3:()=> 'a'.repeat(64)}},env);
 const body={requestId:randomUUID(),installationId:randomUUID(),appVersion:'0.5.1-test',releaseId:'phone-assistant-0.5.1',timestamp:Math.floor(Date.now()/1000),nonce:randomBytes(32).toString('base64url'),publicKey,jobId:randomUUID(),action:'send',scopeHash:'b'.repeat(64)};
 h.row={job_id:body.jobId,fingerprint:tokens.hashV3(JSON.stringify(['phone-assistant',body.releaseId,body.appVersion,body.jobId,body.action,body.scopeHash,body.publicKey])),request_id:body.requestId,nonce:body.nonce,permit:{payload:'frozen-existing-permit',signature:'unchanged'},expires_at:new Date(Date.now()+86400000),completed_at:null,completion_hash:null,terminal_status:null};
 h.call=async(op='start',changes={},signingKey=keys.privateKey)=>{const b={...body,...changes},path='/api/toolbox/client/v1/phone-assistant/jobs/'+op,payload=Buffer.from(JSON.stringify(b)).toString('base64url'),signature=sign('sha256',Buffer.from(server.toolProofCanonical(path,payload,b)),{key:signingKey,dsaEncoding:'ieee-p1363'}).toString('base64url');return server.toolOperation(new NextRequest('https://www.chinatech.in'+path,{method:'POST',body:JSON.stringify({payload,signature})}),'phone-assistant',op);};
 h.server=server;return h;
}

test('Retired phone blocks new signed jobs without writes; same original receipt replay and frozen resume/outcome remain',async()=>{
 const h=recoveryHarness();assert.equal((await h.call()).status,410);assert.equal(h.inserts,0);assert.equal(h.updates,0);
 await assert.rejects(h.server.toolUpdate('phone-assistant'),e=>e.code==='TOOL_RETIRED'&&e.status===410);
 h.existing=[h.row];
 assert.deepEqual((await(await h.call()).json()).permit,h.row.permit);
 assert.deepEqual((await(await h.call('resume',{requestId:randomUUID(),nonce:randomBytes(32).toString('base64url')})).json()).permit,h.row.permit);
 assert.equal((await h.call('resume',{scopeHash:'c'.repeat(64)})).status,409);
 assert.equal((await h.call('outcome',{checkpointHash:'d'.repeat(64)})).status,200);assert.equal(h.updates,1);assert.equal(h.inserts,0);
 h.row.completed_at=new Date();h.row.completion_hash='d'.repeat(64);h.row.terminal_status='completed';
 assert.equal((await h.call('resume')).status,409);
 assert.equal((await h.call('outcome',{checkpointHash:'d'.repeat(64)})).status,200);
 assert.equal((await h.call('outcome',{checkpointHash:'e'.repeat(64)})).status,409);
 assert.equal(h.updates,1);assert.equal(h.inserts,0);
});

test('Retired phone still rejects mismatched identity, expired recovery, invalid proof and missing original job',async()=>{
 const h=recoveryHarness();assert.equal((await h.call('resume')).status,401);h.existing=[h.row];
 h.row.expires_at=new Date(Date.now()-1);assert.equal((await h.call('resume')).status,403);h.row.expires_at=new Date(Date.now()+86400000);
 assert.equal((await h.call('start',{requestId:randomUUID()})).status,409);
 assert.equal((await h.call('resume',{action:'receive'})).status,409);
 const other=native('node:crypto').generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 assert.equal((await h.call('resume',{},other.privateKey)).status,401);
 h.known=[{key_hash:'e'.repeat(64),public_key:publicKey}];assert.equal((await h.call('resume')).status,409);
 h.known=[];assert.equal((await h.call('resume',{timestamp:Math.floor(Date.now()/1000)-301})).status,400);
 assert.equal(h.inserts,0);assert.equal(h.updates,0);
});

test('Public retired phone status/update contain no stale APK while Windows and Office dispatch remain unchanged',async()=>{
 let reads=0,windows=0,office=0;
 const route=load('app/api/toolbox/client/v1/[toolId]/[...operation]/route.ts',{'@/lib/toolbox/tool-client-server':{toolUpdate:async()=>{windows++;return{payload:'windows-original'};}},'@/lib/toolbox/tool-registry-server':{toolStatus:async()=>{reads++;return{enabled:true,ready:true};}},'@/lib/toolbox/office-desktop-v3-server':{statusV3:async()=>{office++;return{office:true};},sourceHashV3:()=> 'a'.repeat(64)},'@/lib/toolbox/office-desktop-v3-database':{requestRateV3:async()=>{}},'@/lib/toolbox/office-server':{officeResponse:r=>r},'@/lib/toolbox/office-desktop-server':{desktopFailure:e=>NextResponse.json({code:e.code},{status:e.status})}},env);
 const get=(toolId,op)=>route.GET(new NextRequest('https://www.chinatech.in/api/toolbox/client/v1/'+toolId+'/'+op),{params:Promise.resolve({toolId,operation:[op]})});
 const status=await(await get('phone-assistant','status')).json();assert.equal(status.enabled,false);assert.equal(status.ready,false);assert.equal(status.activeReleaseId,null);assert.equal(status.acceptingNewJobs,false);assert.equal(status.updateUrl,'https://www.chinatech.in/toolbox/transfer');assert.equal(JSON.stringify(status).includes('phone-current'),false);
 const update=await get('phone-assistant','update');assert.equal(update.status,410);assert.equal((await update.json()).code,'TOOL_RETIRED');assert.equal(reads,0);assert.equal(windows,0);
 assert.equal((await(await get('windows-check','status')).json()).acceptingNewJobs,true);assert.equal(reads,1);
 assert.equal((await(await get('windows-check','update')).json()).payload,'windows-original');assert.equal(windows,1);
 assert.equal((await(await get('office','status')).json()).office,true);assert.equal(office,1);
});
