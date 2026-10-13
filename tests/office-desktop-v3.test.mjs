import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { createContext, runInContext } from 'node:vm';
import { generateKeyPairSync, randomUUID, randomBytes, sign } from 'node:crypto';
import ts from 'typescript';
const nativeRequire = createRequire(import.meta.url), modules = new Map();
export function load(file, overrides = {}, env = process.env) {
 const path=resolve(file); if(modules.has(path)&&!Object.keys(overrides).length)return modules.get(path);
 const exports={}; const require=name=>Object.hasOwn(overrides,name)?overrides[name]:name==='server-only'?{}:name==='./office-desktop-server'?{}:name==='./office-server'?{}:name.startsWith('@/')?load(name.slice(2)+'.ts',overrides,env):name.startsWith('./')?load(resolve(dirname(path),name)+'.ts',overrides,env):nativeRequire(name);
 runInContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,createContext({exports,require,Buffer,TextDecoder,URL,Date,BigInt,console,setTimeout,process:{env}}));
 if(!Object.keys(overrides).length)modules.set(path,exports); return exports;
}
export const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
export const publicKey=keys.publicKey.export({type:'spki',format:'der'}).toString('base64url');
export const env={...process.env,OFFICE_DESKTOP_V3_KID:'office-v3-test',OFFICE_DESKTOP_V3_PRIVATE_KEY:keys.privateKey.export({type:'pkcs8',format:'pem'}).toString()};
export const tokens=load('lib/toolbox/office-desktop-v3-token.ts',{},env);
export const plan={target:'LTSC2024',bitness:64,language:'en-us',components:['Word','Excel'],server:'S1.KMS.CX:1688',expectedFingerprint:'A'.repeat(64),removalTargets:[],removalMode:'selected',mediaVersion:'16.0.17932.21000'};
export const proof=(extra={})=>({requestId:randomUUID(),installationId:randomUUID(),appVersion:'1.4.0',timestamp:Math.floor(Date.now()/1000),nonce:randomBytes(32).toString('base64url'),...extra});
export function signed(body,op,bearer='',signingKey=keys.privateKey){const payload=Buffer.from(JSON.stringify(body)).toString('base64url');const signature=sign('sha256',Buffer.from(tokens.canonicalV3(tokens.pathV3(op),payload,body,bearer)),{key:signingKey,dsaEncoding:'ieee-p1363'}).toString('base64url');return{payload,signature};}
const fails=(fn,code)=>assert.throws(fn,e=>e.code===code);
test('P256 SPKI and P1363 proof bind body, bearer, endpoint and timestamp',()=>{
 const body=proof({publicKey}),wire=signed(body,'session'),key=tokens.publicKeyV3(publicKey);
 tokens.verifyProofV3('/api/toolbox/office-desktop/v3/session',wire.payload,body,wire.signature,key);
 for(const [path,bearer] of [['/api/toolbox/office-desktop/v3/jobs/start',''],['/api/toolbox/office-desktop/v3/session','other']])fails(()=>tokens.verifyProofV3(path,wire.payload,body,wire.signature,key,bearer),'DEVICE_PROOF_INVALID');
 fails(()=>tokens.proofV3(wire.payload,['publicKey'],body.timestamp+301),'DEVICE_PROOF_EXPIRED');
 const other=generateKeyPairSync('ec',{namedCurve:'secp384r1'});fails(()=>tokens.publicKeyV3(other.publicKey.export({type:'spki',format:'der'}).toString('base64url')),'DEVICE_PROOF_INVALID');
 const bad=proof({unexpected:'value'});fails(()=>tokens.proofV3(signed(bad,'session').payload,['publicKey']),'INVALID_REQUEST');
});
test('Frozen plan normalization and host/removal counterexamples',()=>{
 const normalized=tokens.planV3(plan,'install');assert.equal(JSON.stringify(normalized),'\x7b"target":"LTSC2024","bitness":64,"language":"en-us","components":["Excel","Word"],"server":"s1.kms.cx:1688","expectedFingerprint":"'+ 'a'.repeat(64)+'","removalTargets":[],"removalMode":"selected","mediaVersion":"16.0.17932.21000"}');
 for(const server of ['evil.test','kms.cx;whoami','s1.kms.cx:0','k.302.pub:65536','https://kms.cx'])fails(()=>tokens.planV3({...plan,server},'install'),'PLAN_INVALID');
 for(const change of [{components:['Word','Word']},{components:['Word;evil']},{removalTargets:['msi:display-name']},{removalMode:'guess'},{language:'fr-fr'},{bitness:32}])fails(()=>tokens.planV3({...plan,...change},'install'),'PLAN_INVALID');
});
test('Office media version is explicit and hashed for install/reinstall while non-install actions may use an empty version',()=>{
 for(const action of ['install','reinstall'])for(const mediaVersion of [undefined,'','16.0.1','15.0.1.1','16.0.65536.1','16.0.1.65536','16.0.01.1','16.0.1.1;whoami'])fails(()=>tokens.planV3({...plan,mediaVersion},action),'PLAN_INVALID');
 assert.equal(tokens.planV3({...plan,mediaVersion:''},'close').mediaVersion,'');
 assert.notEqual(tokens.hashV3(JSON.stringify(tokens.planV3(plan,'install'))),tokens.hashV3(JSON.stringify(tokens.planV3({...plan,mediaVersion:'16.0.17932.21001'},'install'))));
});
test('JWS ES256 audience, signature, expiry and full frozen plan are enforced',()=>{
 const body=proof(),normalized=tokens.planV3(plan,'install'),claims={v:3,iss:tokens.v3Origin,aud:'office-v3-start',sub:body.installationId,keyHash:tokens.hashV3(Buffer.from(publicKey,'base64url')),appVersion:'1.4.0',iat:body.timestamp,exp:body.timestamp+300,jti:body.requestId,jobId:randomUUID(),action:'install',architecture:'win-x64',plan:normalized,planHash:tokens.hashV3(JSON.stringify(normalized)),controlRevision:'0'};
 const token=tokens.signV3(claims);assert.equal(tokens.readV3(token,'office-v3-start').planHash,claims.planHash);
 fails(()=>tokens.readV3(token,'office-v3-permit'),'SESSION_INVALID');fails(()=>tokens.readV3(token,'office-v3-start',body.timestamp+301),'SESSION_INVALID');
 const parts=token.split('.');parts[1]=Buffer.from(JSON.stringify({...claims,action:'uninstall'})).toString('base64url');fails(()=>tokens.readV3(parts.join('.'),'office-v3-start'),'SESSION_INVALID');
 fails(()=>tokens.readV3(tokens.signV3({...claims,planHash:'b'.repeat(64)}),'office-v3-start'),'SESSION_INVALID');
});
test('Source rate uses only trusted platform IP and rejects self-hosted forged forwarding headers',()=>{
 env.OFFICE_DESKTOP_V3_RATE_SECRET='a'.repeat(64);const server=load('lib/toolbox/office-desktop-v3-server.ts',{},env);
 const request={headers:new Headers({'x-vercel-forwarded-for':'203.0.113.9','x-forwarded-for':'198.51.100.2'})};
 delete env.VERCEL;fails(()=>server.sourceHashV3(request),'SERVICE_UNAVAILABLE');env.VERCEL='1';
 const source=server.sourceHashV3(request);assert.match(source,/^[a-f0-9]{64}$/);assert.equal(server.sourceHashV3({headers:new Headers({'x-vercel-forwarded-for':'203.0.113.9','x-forwarded-for':'spoofed'})}),source);
 fails(()=>server.sourceHashV3({headers:new Headers({'x-forwarded-for':'203.0.113.9'})}),'SERVICE_UNAVAILABLE');
 fails(()=>server.sourceHashV3({headers:new Headers({'x-vercel-forwarded-for':'203.0.113.9, 198.51.100.2'})}),'SERVICE_UNAVAILABLE');delete env.VERCEL;
 const unavailable=load('lib/toolbox/office-desktop-v3-token.ts',{'server-only':{}},{});assert.equal(unavailable.signingReadyV3(),false);fails(()=>unavailable.signV3({}),'SERVICE_UNAVAILABLE');
});
test('A previously selected verified minimum remains available when the latest release changes',async()=>{
 const identity={userId:randomUUID(),sessionId:randomUUID()},row={enabled:false,minimum_version:'1.4.1',release_ready:true,verified_version:'1.5.0',revision:'7',updated_at:null};
 const tx=async(strings)=>{const query=strings.join('');if(query.includes('office_command_control'))return[{admin_user_id:identity.userId}];if(query.includes('office_v3_control'))return[row];return[];};
 const admin=load('lib/toolbox/office-desktop-v3-admin.ts',{'@/lib/backend/database':{withDatabase:(id,store,run)=>run(tx)}},env);
 const state=await admin.getAdminV3(identity);assert.ok(state.eligibleMinimumVersions.includes('1.4.1'));
 const paused=await admin.changeAdminV3(identity,{enabled:false,minimumVersion:'1.4.1',expectedRevision:'7',requestId:randomUUID()});assert.equal(paused.minimumVersion,'1.4.1');
});
test('Admin jobs response is limited and projects metadata without device, permit, plan or session fields',async()=>{
 const identity={userId:randomUUID(),sessionId:randomUUID()},now=new Date(),jobId=randomUUID();let bounded=false;
 const tx=async(strings)=>{const query=strings.join('');if(query.includes('office_command_control'))return[{admin_user_id:identity.userId}];bounded=query.includes('limit 20');return[{job_id:jobId,action:'install',status:'completed',app_version:'1.4.0',architecture:'win-x64',created_at:now,started_at:now,updated_at:now,installation_id:randomUUID(),key_hash:'a'.repeat(64),permit_token:'synthetic-private-permit',plan:{secret:'not-projected'},session_id:identity.sessionId}];};
 const admin=load('lib/toolbox/office-desktop-v3-admin.ts',{'@/lib/backend/database':{withDatabase:(id,store,run)=>run(tx)}},env);
 const result=await admin.getJobsV3(identity);assert.ok(bounded);assert.deepEqual(Object.keys(result),['jobs']);assert.deepEqual(Object.keys(result.jobs[0]).sort(),['jobId','action','status','appVersion','architecture','createdAt','startedAt','updatedAt'].sort());
 await assert.rejects(admin.getJobsV3({userId:randomUUID(),sessionId:randomUUID()}),e=>e.code==='NO_ACCESS');
});
test('The routed task endpoints and proof canonical use jobs paths exclusively',()=>{
 for(const op of ['start','commit','resume','outcome']){assert.equal(tokens.pathV3(op),'/api/toolbox/office-desktop/v3/jobs/'+op);assert.equal(existsSync('app/api/toolbox/office-desktop/v3/'+op+'/route.ts'),false);assert.ok(readFileSync('app/api/toolbox/office-desktop/v3/jobs/'+op+'/route.ts','utf8').includes("handleV3(request, '"+op+"')"));}
 assert.equal(tokens.pathV3('session'),'/api/toolbox/office-desktop/v3/session');
 assert.equal(tokens.pathV3('admission'),'/api/toolbox/office-desktop/v3/admission');
 assert.ok(readFileSync('app/api/toolbox/office-desktop/v3/admission/route.ts','utf8').includes("handleV3(request, 'admission')"));
});
test('Admission hints bind the instance, architecture, allowed actions and at most sixty seconds without becoming execution permits',()=>{
 const body=proof(),claims={v:3,iss:tokens.v3Origin,aud:'office-v3-admission',sub:body.installationId,keyHash:tokens.hashV3(Buffer.from(publicKey,'base64url')),appVersion:body.appVersion,
  architecture:'win-x64',admissionMode:'candidate',actions:['close','reinstall'],iat:body.timestamp,exp:body.timestamp+60,jti:body.requestId};
 const token=tokens.signV3(claims);assert.deepEqual(Array.from(tokens.readV3(token,'office-v3-admission').actions),claims.actions);
 fails(()=>tokens.readV3(token,'office-v3-session'),'SESSION_INVALID');fails(()=>tokens.readV3(token,'office-v3-start'),'SESSION_INVALID');fails(()=>tokens.readV3(token,'office-v3-permit'),'SESSION_INVALID');
 for(const change of [{exp:body.timestamp+61},{actions:[]},{actions:['close','close']},{actions:['root']},{architecture:'linux'},{admissionMode:'test'},{grantId:randomUUID()}])
  fails(()=>tokens.readV3(tokens.signV3({...claims,...change}),'office-v3-admission'),'SESSION_INVALID');
 fails(()=>tokens.readV3(token,'office-v3-admission',body.timestamp+60),'SESSION_INVALID');
});
test('Candidate execution tokens require grant identity and revision and keep the complete original plan',()=>{
 const body=proof(),normalized=tokens.planV3(plan,'install'),claims={v:3,iss:tokens.v3Origin,aud:'office-v3-start',sub:body.installationId,keyHash:tokens.hashV3(Buffer.from(publicKey,'base64url')),appVersion:'1.4.0',iat:body.timestamp,exp:body.timestamp+300,jti:body.requestId,
  jobId:randomUUID(),action:'install',architecture:'win-x64',plan:normalized,planHash:tokens.hashV3(JSON.stringify(normalized)),controlRevision:'0',admissionMode:'candidate',grantId:randomUUID(),grantRevision:'0'};
 assert.equal(tokens.readV3(tokens.signV3(claims),'office-v3-start').grantId,claims.grantId);
 for(const change of [{grantId:undefined},{grantRevision:undefined},{grantRevision:'-1'},{grantRevision:'9223372036854775808'},{admissionMode:'public'},{actions:['install']},{planHash:'d'.repeat(64)}])
  fails(()=>tokens.readV3(tokens.signV3({...claims,...change}),'office-v3-start'),'SESSION_INVALID');
});

test('OneDrive-only install plans need no Office media while suite plans freeze a version',()=>{
 for(const action of ['install','reinstall']){
  assert.equal(tokens.planV3({...plan,components:['OneDrive'],mediaVersion:''},action).mediaVersion,'');
  fails(()=>tokens.planV3({...plan,mediaVersion:''},action),'PLAN_INVALID');
 }
});
