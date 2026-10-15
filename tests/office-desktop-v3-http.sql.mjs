import assert from 'node:assert/strict';
import { randomUUID, verify } from 'node:crypto';
import { createRequire } from 'node:module';
import { env, load, keys, tokens, publicKey, plan, proof, signed } from './office-desktop-v3.test.mjs';
const { NextRequest, NextResponse } = createRequire(import.meta.url)('next/server');

export async function httpLifecycleChecks({ owner, db, call, admin, identity, otherIdentity, pass }) {
 const previous={VERCEL:env.VERCEL,APP_ORIGIN:env.APP_ORIGIN,rate:env.OFFICE_DESKTOP_V3_RATE_SECRET};
 env.VERCEL='1';env.APP_ORIGIN=tokens.v3Origin;env.OFFICE_DESKTOP_V3_RATE_SECRET='a'.repeat(64);
 const office={officeResponse:response=>response};
 const desktop=load('lib/toolbox/office-desktop-server.ts',{'./office-server':office},env);
 // Error serialization is injected to preserve one VM error class identity;
 // body parsing, proofs, transactions, services and the route exports are real.
 const adapter={...desktop,desktopFailure:error=>NextResponse.json({code:error.code??(error.status===403?'NO_ACCESS':'INVALID_REQUEST')},{status:error.status??503})};
 const server=load('lib/toolbox/office-desktop-v3-server.ts',{'./office-desktop-server':adapter,'./office-server':office,'./office-desktop-v3-database':db,'./tool-registry-server':{readTool:async()=>({toolId:'office',activeReleaseId:'office-1.4.0',enabled:true,ready:true,release:{releaseId:'office-1.4.0',...load('lib/toolbox/office-desktop-release.ts',{},env).officeDesktopRelease}})}},env);
 const common={'@/lib/toolbox/office-desktop-v3-server':server,'@/lib/toolbox/office-desktop-v3-database':db,'@/lib/toolbox/office-desktop-server':adapter,'@/lib/toolbox/office-server':office};
 const activity=load('app/api/toolbox/office-desktop/v3/jobs/activity/route.ts',common,env);
 const update=load('app/api/toolbox/office-desktop/v3/update/route.ts',common,env);
 const auth={requireAccountSession:async(request,response,expectedAccount)=>{
  const actor=request.headers.get('x-test-identity')==='other'?otherIdentity:request.headers.get('x-test-identity')==='admin'?identity:null;
  if(!actor)throw Object.assign(Error('synthetic anonymous'),{code:'SESSION_EXPIRED',status:401});
  assert.equal(expectedAccount,true);
  if(request.headers.get('x-ct-account-id')!==actor.userId)throw Object.assign(Error('identity mismatch'),{code:'SESSION_INVALID',status:409});
  return {identity:actor};
 }};
 const accountCommon={...common,'@/lib/server/account-auth':auth,'@/lib/server/auth-flows':{copyAuthCookies:(cookies,response)=>response},'@/lib/toolbox/office-desktop-v3-admin':admin};
 const control=load('app/api/account/toolbox/office-desktop/v3/control/route.ts',accountCommon,env);
 const cleanup=load('app/api/account/toolbox/office-desktop/v3/cleanup/route.ts',accountCommon,env);
 const installationId=randomUUID(),source=tokens.hashV3(installationId);
 const invoke=(fields,op,bearer)=>call(proof({installationId,...fields}),op,bearer,source);
 try{
  const session=await invoke({publicKey},'session',''),start=await invoke({jobId:randomUUID(),action:'install',architecture:'win-x64',plan},'start',session.sessionToken),permit=await invoke({jobId:start.jobId,planHash:start.planHash},'commit',start.startToken);
  const post=(body,bearer=permit.permitToken)=>activity.POST(new NextRequest(tokens.v3Origin+tokens.pathV3('activity'),{method:'POST',headers:{'content-type':'application/json','x-vercel-forwarded-for':'203.0.113.102',authorization:'Bearer '+bearer},body:JSON.stringify(signed(body,'activity',bearer))}));
  const body=proof({installationId,jobId:start.jobId,planHash:start.planHash,stage:'Install',errorCode:null});
  const response=await post(body);assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).stage,'Install');
  assert.equal((await post({...body,requestId:randomUUID(),output:'private output'})).status,400);
  assert.equal((await post(proof({...body,timestamp:Math.floor(Date.now()/1000)-301}))).status,401);
  assert.equal((await post(proof({...body,requestId:randomUUID(),nonce:proof().nonce,planHash:'b'.repeat(64)}))).status,401);
  const metadata=await update.GET(new NextRequest(tokens.v3Origin+'/api/toolbox/office-desktop/v3/update',{headers:{'x-vercel-forwarded-for':'203.0.113.103'}}));assert.equal(metadata.status,200);
  const envelope=await metadata.json(),payload=JSON.parse(Buffer.from(envelope.payload,'base64url'));assert.ok(Object.hasOwn(payload,'publisherCertificateSha256'));if(payload.authenticodeSigned)assert.match(payload.publisherCertificateSha256,/^[a-f0-9]{64}$/);assert.equal(payload.aud,'office-v3-update');assert.equal(payload.iss,tokens.v3Origin);assert.equal(payload.expiresAt-payload.issuedAt,300);assert.equal(payload.files.length,2);assert.equal(payload.trustPolicy,'embedded-keyring-only');
  assert.ok(verify('sha256',Buffer.from('CT-OFFICE-V3-UPDATE\n'+envelope.payload),{key:keys.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(envelope.signature,'base64url')));
  for(const file of payload.files){assert.match(file.sha256,/^[a-f0-9]{64}$/);assert.ok(file.bytes>0);assert.equal(new URL(file.href).hostname,'github.com');}
  const accountRequest=(path,actor='admin',method='GET',body,changes={})=>new NextRequest(tokens.v3Origin+'/api/account/toolbox/office-desktop/v3/'+path,{method,headers:{'x-test-identity':actor,'x-ct-account-id':actor==='other'?otherIdentity.userId:identity.userId,'x-ct-session-id':actor==='other'?otherIdentity.sessionId:identity.sessionId,...(method==='POST'?{'content-type':'application/json',origin:tokens.v3Origin}:{}),...changes},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await control.GET(accountRequest('control','anon'))).status,401);
  assert.equal((await control.GET(accountRequest('control','other'))).status,403);
  assert.equal((await control.GET(accountRequest('control','admin','GET',undefined,{'x-ct-session-id':randomUUID()}))).status,409);
  assert.equal((await control.GET(accountRequest('control'))).status,200);
  const preview=await cleanup.GET(accountRequest('cleanup'));assert.equal(preview.status,200);assert.equal((await preview.json()).dryRun,true);
  assert.equal((await cleanup.GET(accountRequest('cleanup','other'))).status,403);
  assert.equal((await cleanup.POST(accountRequest('cleanup','admin','POST',{requestId:randomUUID(),expectedDigest:'a'.repeat(64)}))).status,403);
  assert.equal((await cleanup.POST(accountRequest('cleanup','admin','POST',{requestId:randomUUID(),expectedDigest:'a'.repeat(64)},{origin:'https://other.test'}))).status,403);
  assert.equal((await owner`select count(*)::integer as n from chinatech_v2_private.office_v3_activity where job_id=${start.jobId}`)[0].n,1);
  pass('Real activity/update/account/cleanup route exports with actual PostgreSQL validate signed metadata, proof privacy, identity/session hints, admin denial, CSRF and default dry-run');
 }finally{
  for(const [key,value] of Object.entries({VERCEL:previous.VERCEL,APP_ORIGIN:previous.APP_ORIGIN,OFFICE_DESKTOP_V3_RATE_SECRET:previous.rate}))if(value===undefined)delete env[key];else env[key]=value;
 }
}
