import assert from'node:assert/strict';import{randomUUID,randomBytes,sign,verify,generateKeyPairSync}from'node:crypto';import{createRequire}from'node:module';import{load,env,keys,publicKey}from'./office-desktop-v3.test.mjs';
const{NextRequest,NextResponse}=createRequire(import.meta.url)('next/server');
export async function toolboxClientChecks({owner,db,pass}){
 const before={VERCEL:env.VERCEL,rate:env.OFFICE_DESKTOP_V3_RATE_SECRET};env.VERCEL='1';env.OFFICE_DESKTOP_V3_RATE_SECRET='a'.repeat(64);
 const source=load('lib/toolbox/tool-client-server.ts',{'./office-desktop-v3-database':db,'./office-server':{officeResponse:r=>r},'./office-desktop-server':{desktopBody:r=>r.json(),desktopFailure:e=>NextResponse.json({code:e.code??'SERVICE_UNAVAILABLE'},{status:e.status??503})}},env);
 const manifest={releaseId:'windows-check-fixture-1',version:'non-semver-display',authenticodeSigned:false,prerelease:true,files:[{architecture:'any',href:'https://www.chinatech.in/toolbox/windows-current/fixture.zip',bytes:100,sha256:'a'.repeat(64)}]};
 await owner.begin(async tx=>{await db.lockV3(tx,'control');await tx`insert into chinatech_v2_private.toolbox_releases(tool_id,release_id,manifest,ready) values('windows-check',${manifest.releaseId},${tx.json(manifest)},true)`;await tx`update chinatech_v2_private.toolbox_tools set active_release_id=${manifest.releaseId},enabled=true where tool_id='windows-check'`;});
 const body={requestId:randomUUID(),installationId:randomUUID(),appVersion:manifest.version,releaseId:manifest.releaseId,timestamp:Math.floor(Date.now()/1000),nonce:randomBytes(32).toString('base64url'),publicKey,jobId:randomUUID(),action:'detect',scopeHash:'b'.repeat(64)};
 const request=async(b,op='start',tool='windows-check',key=keys.privateKey)=>{const path=`/api/toolbox/client/v1/${tool}/jobs/${op}`,payload=Buffer.from(JSON.stringify(b)).toString('base64url'),signature=sign('sha256',Buffer.from(source.toolProofCanonical(path,payload,b)),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');return source.toolOperation(new NextRequest('https://www.chinatech.in'+path,{method:'POST',headers:{'content-type':'application/json','x-vercel-forwarded-for':'203.0.113.111'},body:JSON.stringify({payload,signature})}),tool,op);};
 try{
  const response=await request(body);assert.equal(response.status,200,await response.clone().text());const permit=(await response.json()).permit;
  assert.ok(verify('sha256',Buffer.from('CT-OFFICE-V3-UPDATE\n'+permit.payload),{key:keys.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(permit.signature,'base64url')));
  const claims=JSON.parse(Buffer.from(permit.payload,'base64url'));for(const name of ['releaseId','installationId','jobId','action','scopeHash'])assert.equal(claims[name],body[name]);assert.equal(claims.aud,'toolbox-v1-task');
  assert.deepEqual((await(await request(body)).json()).permit,permit);
  const another=()=>({...body,requestId:randomUUID(),nonce:randomBytes(32).toString('base64url')});
  assert.equal((await request({...body,scopeHash:'c'.repeat(64)})).status,409);
  assert.equal((await request(another(),'resume')).status,200);
  assert.equal((await request({...another(),jobId:randomUUID()},'resume')).status,401);
  assert.equal((await request({...another(),publicKey:generateKeyPairSync('ec',{namedCurve:'prime256v1'}).publicKey.export({type:'spki',format:'der'}).toString('base64url')})).status,401);
  assert.equal((await request({...another(),releaseId:'retired',jobId:randomUUID()})).status,426);
  assert.equal((await request(another(),'start','phone-assistant')).status,400);
  await owner`update chinatech_v2_private.toolbox_tools set enabled=false where tool_id='windows-check'`;
  assert.equal((await request({...another(),jobId:randomUUID()})).status,403);
  assert.equal((await request(another(),'resume')).status,200);
  const update=await source.toolUpdate('windows-check'),metadata=JSON.parse(Buffer.from(update.payload,'base64url'));assert.equal(metadata.activeReleaseId,manifest.releaseId);assert.equal(metadata.aud,'toolbox-v1-update');
  const finish={...another(),checkpointHash:'d'.repeat(64)};assert.equal((await request(finish,'outcome')).status,200);assert.equal((await request(finish,'outcome')).status,200);assert.equal((await request(another(),'resume')).status,409);
  await owner`update chinatech_v2_private.toolbox_tools set enabled=true where tool_id='windows-check'`;
  assert.equal((await request({...finish,status:null},'outcome')).status,400);
  const cancelled={...another(),jobId:randomUUID()};assert.equal((await request(cancelled)).status,200);
  const cancelledOutcome={...cancelled,requestId:randomUUID(),nonce:randomBytes(32).toString('base64url'),checkpointHash:'f'.repeat(64),status:'cancelled'};
  const cancelledResponse=await request(cancelledOutcome,'outcome');assert.equal(cancelledResponse.status,200);assert.deepEqual(await cancelledResponse.json(),{completed:false,status:'cancelled'});
  assert.equal((await request(cancelledOutcome,'outcome')).status,200);
  assert.equal((await request({...cancelledOutcome,status:'completed'},'outcome')).status,409);
  assert.equal((await request({...cancelled,requestId:randomUUID(),nonce:randomBytes(32).toString('base64url')},'resume')).status,409);
  pass('Generic task real HTTP proof/signature, non-semver identity, idempotency, frozen scope, forged/cross-tool denial and paused recovery; completed/cancelled terminal states; signed update stays available');
 }finally{env.VERCEL=before.VERCEL;env.OFFICE_DESKTOP_V3_RATE_SECRET=before.rate;}
}
