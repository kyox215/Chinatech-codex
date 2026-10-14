import assert from 'node:assert/strict';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { tokens, publicKey, plan, proof } from './office-desktop-v3.test.mjs';

// Imported only by the existing fresh, explicitly named loopback PostgreSQL harness.
export async function candidateChecks({owner,runtime,db,server,call,pass}) {
 const [control]=await owner`select enabled,minimum_version,release_ready,verified_version from chinatech_v2_private.office_v3_control`;
 const creator=randomUUID();await owner`insert into chinatech_v2.accounts(id) values(${creator})`;
 const normalized=tokens.planV3(plan,'install'),planHash=tokens.hashV3(JSON.stringify(normalized));
 const fail=(fn,code)=>assert.rejects(fn,error=>error.code===code);
 async function device(extra={}) {
  const installationId=randomUUID(),source=tokens.hashV3(installationId),version=extra.appVersion??'1.4.0';
  const session=await call(proof({installationId,appVersion:version,publicKey}),'session','',source);
  const keyHash=tokens.hashV3(Buffer.from(publicKey,'base64url'));
  const body=fields=>proof({installationId,appVersion:version,...fields});
  const invoke=(fields,op,bearer=session.sessionToken)=>call(body(fields),op,bearer,source);
  return{installationId,source,keyHash,session,body,invoke,version};
 }
 async function grant(d,extra={}) {
  const createdAt=extra.createdAt??new Date(),until=extra.admitUntil??new Date(createdAt.getTime()+4*3600000),id=randomUUID();
  const scope=extra.plan??normalized,hash=extra.planHash??tokens.hashV3(JSON.stringify(scope));
  await owner`insert into chinatech_v2_private.office_v3_candidate_grants(id,installation_id,key_hash,app_version,architecture,action,plan,plan_hash,binary_sha,source_commit,created_by,created_at,admit_until)
   values(${id},${d.installationId},${d.keyHash},${extra.appVersion??d.version},${extra.architecture??'win-x64'},${extra.action??'install'},${owner.json(scope)},${hash},${'b'.repeat(64)},${'c'.repeat(40)},${creator},${createdAt},${until})`;
  return id;
 }
 const start=(d,extra={})=>d.invoke({jobId:randomUUID(),action:'install',architecture:'win-x64',plan,...extra},'start');
 const commit=(d,s)=>d.invoke({jobId:s.jobId,planHash:s.planHash},'commit',s.startToken);
 const revoke=id=>owner`update chinatech_v2_private.office_v3_candidate_grants set active=false,revision=revision+1,revoked_at=now() where id=${id}`;
 try {
  await owner`update chinatech_v2_private.office_v3_control set enabled=true,minimum_version='1.4.0',release_ready=false,verified_version=null`;
  const d=await device(),g=await grant(d);
  assert.equal((await server.statusV3()).acceptingNewJobs,false);assert.equal((await server.statusV3()).currentVersion,null);
  const probe=d.body({architecture:'win-x64'}),hint=await call(probe,'admission',d.session.sessionToken,d.source),h=tokens.readV3(hint.admissionToken,'office-v3-admission');
  assert.equal(h.sub,d.installationId);assert.equal(h.keyHash,d.keyHash);assert.equal(h.admissionMode,'candidate');assert.equal(h.architecture,'win-x64');assert.deepEqual(Array.from(h.actions),['install']);assert.ok(h.exp-h.iat<=60);
  await fail(()=>call(probe,'admission',d.session.sessionToken,d.source),'REQUEST_CONFLICT');
  await fail(()=>d.invoke({jobId:randomUUID(),action:'install',architecture:'win-x64',plan},'start',hint.admissionToken),'SESSION_INVALID');
  await fail(()=>d.invoke({architecture:'win-arm64'},'admission'),'CANDIDATE_DENIED');
  const ordinary=await device();await fail(()=>ordinary.invoke({architecture:'win-x64'},'admission'),'CANDIDATE_DENIED');await fail(()=>start(ordinary),'CANDIDATE_DENIED');
  pass('Unreleased public status remains closed; only the exact candidate device receives a fresh sixty-second hint, never an execution permit');

  for(const change of [{action:'activate'},{architecture:'win-arm64'},{plan:{...plan,components:['Word']}},{plan:{...plan,language:'it-it'}},{plan:{...plan,expectedFingerprint:'d'.repeat(64)}},{plan:{...plan,mediaVersion:'16.0.17932.21001'}}])await fail(()=>start(d,change),'CANDIDATE_DENIED');
  const newer=await device({appVersion:'1.4.1'});await grant(newer,{appVersion:'1.4.0'});await fail(()=>start(newer),'CANDIDATE_DENIED');
  const alien=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),alienKey=alien.publicKey.export({type:'spki',format:'der'}).toString('base64url');
  await fail(()=>call(d.body({publicKey:alienKey}),'session','',d.source,alien),'23505');
  assert.equal((await runtime`select count(*)::integer as n from chinatech_v2_private.office_v3_candidate_grants`)[0].n,0);
  for(const name of ['anon','authenticated'])await assert.rejects(owner.begin(async tx=>{await tx.unsafe('set local role '+name);await tx`select * from chinatech_v2_private.office_v3_candidate_grants`;}),error=>error.code==='42501');
  await fail(()=>runtime`update chinatech_v2_private.office_v3_candidate_grants set active=false`,'42501');
  await fail(()=>runtime`delete from chinatech_v2_private.office_v3_candidate_grants`,'42501');
  await fail(()=>runtime`insert into chinatech_v2_private.office_v3_candidate_grants select * from chinatech_v2_private.office_v3_candidate_grants`,'42501');
  await fail(()=>owner`update chinatech_v2_private.office_v3_candidate_grants set plan_hash=${'e'.repeat(64)} where id=${g}`,'23514');
  await fail(()=>owner`delete from chinatech_v2_private.office_v3_candidate_grants where id=${g}`,'23514');
  pass('Candidate UUID/key/version/architecture/action/full plan are exact; FORCE RLS hides foreign grants and runtime has no grant writes');

  const bad=d.body({jobId:randomUUID()});
  const sessionId=tokens.readV3(d.session.sessionToken,'office-v3-session').jti;
  await fail(()=>db.transactionV3(bad,d.keyHash,'start',d.source,tx=>tx`insert into chinatech_v2_private.office_v3_intents
   (job_id,installation_id,key_hash,session_id,action,architecture,app_version,plan,plan_hash,control_revision,token,created_at,start_before,admission_mode,candidate_grant_id,candidate_revision)
   values(${bad.jobId},${d.installationId},${d.keyHash},${sessionId},'install','win-x64','1.4.0',${tx.json(normalized)},${'e'.repeat(64)},(select revision from chinatech_v2_private.office_v3_control),'synthetic',now(),now()+interval '5 minutes','candidate',${g},0)`),'42501');
  pass('Direct runtime INSERT cannot bypass the exact candidate plan hash through transaction context');

  const sqlOnly=await device(),sqlGrant=await grant(sqlOnly),sqlA=await start(sqlOnly),sqlB=await start(sqlOnly);
  await fail(()=>db.transactionV3(sqlOnly.body({jobId:sqlA.jobId}),sqlOnly.keyHash,'commit',sqlOnly.source,tx=>tx`insert into chinatech_v2_private.office_v3_commits
   (job_id,installation_id,key_hash,plan_hash,permit_token,created_at,resume_until,admission_mode,candidate_grant_id,candidate_revision)
   values(${sqlA.jobId},${sqlOnly.installationId},${sqlOnly.keyHash},${sqlA.planHash},'synthetic-unusable-token',now(),now()+interval '30 days','candidate',${sqlGrant},0)`),'23514');
  const rawCommit=s=>db.transactionV3(sqlOnly.body({jobId:s.jobId}),sqlOnly.keyHash,'commit',sqlOnly.source,tx=>tx`insert into chinatech_v2_private.office_v3_commits
   (job_id,installation_id,key_hash,plan_hash,permit_token,created_at,resume_until,admission_mode,candidate_grant_id,candidate_revision)
   values(${s.jobId},${sqlOnly.installationId},${sqlOnly.keyHash},${s.planHash},'synthetic-unusable-token',now(),now()+interval '7 days','candidate',${sqlGrant},0)`);
  const directRace=await Promise.allSettled([rawCommit(sqlA),rawCommit(sqlB)]);
  assert.equal(directRace.filter(x=>x.status==='fulfilled').length,1);assert.equal(directRace.filter(x=>x.status==='rejected'&&['23505','42501'].includes(x.reason.code)).length,1);
  assert.equal((await owner`select count(*)::integer as n from chinatech_v2_private.office_v3_commits where candidate_grant_id=${sqlGrant}`)[0].n,1);
  pass('Database RLS and the unique candidate grant constraint independently enforce one commit even when runtime bypasses application locks');

  const a=await start(d),b=await start(d);
  const started=tokens.readV3(a.startToken,'office-v3-start');assert.equal(started.admissionMode,'candidate');assert.equal(started.grantId,g);assert.equal(started.grantRevision,'0');assert.equal(started.planHash,planHash);
  const attempts=await Promise.allSettled([commit(d,a),commit(d,b)]);assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.equal(attempts.filter(x=>x.status==='rejected'&&x.reason.code==='CANDIDATE_DENIED').length,1);
  const index=attempts.findIndex(x=>x.status==='fulfilled'),s=index===0?a:b,c=attempts[index].value;
  const permit=tokens.readV3(c.permitToken,'office-v3-permit');assert.equal(permit.exp-permit.iat,7*86400);assert.equal(permit.grantId,g);
  const [storedCommit]=await owner`select count(*)::integer as n from chinatech_v2_private.office_v3_commits where candidate_grant_id=${g}`;assert.equal(storedCommit.n,1);
  await fail(()=>start(d),'CANDIDATE_DENIED');
  pass('Two prepared candidate jobs race for one grant; exactly one commits with a fixed seven-day permit and no second task can start');

  await revoke(g);await owner`update chinatech_v2_private.office_v3_control set enabled=false,minimum_version='1.5.0',revision=revision+1`;
  const retryBody=d.body({jobId:s.jobId,planHash:s.planHash}),retry=await call(retryBody,'commit',s.startToken,d.source);assert.deepEqual(retry,c);
  const realNow=Date.now;Date.now=()=>realNow()+301000;
  try{assert.deepEqual(await call({...retryBody,timestamp:Math.floor(Date.now()/1000)},'commit',s.startToken,d.source),c);}finally{Date.now=realNow;}
  assert.deepEqual(await d.invoke({jobId:s.jobId,planHash:s.planHash},'resume',c.permitToken),c);
  await fail(()=>d.invoke({jobId:s.jobId,planHash:'f'.repeat(64)},'resume',c.permitToken),'SESSION_INVALID');
  await d.invoke({jobId:s.jobId,planHash:s.planHash,status:'failed',checkpointHash:'a'.repeat(64)},'outcome',c.permitToken);
  assert.deepEqual(await d.invoke({jobId:s.jobId,planHash:s.planHash},'resume',c.permitToken),c);
  Date.now=()=>realNow()+7*86400000+1000;
  try{await fail(()=>d.invoke({jobId:s.jobId,planHash:s.planHash},'resume',c.permitToken),'SESSION_INVALID');}finally{Date.now=realNow;}
  const completed=d.body({jobId:s.jobId,planHash:s.planHash,status:'completed',checkpointHash:'b'.repeat(64)}),outcome=await call(completed,'outcome',c.permitToken,d.source);
  assert.deepEqual(await call(completed,'outcome',c.permitToken,d.source),outcome);await fail(()=>d.invoke({jobId:s.jobId,planHash:s.planHash},'resume',c.permitToken),'JOB_COMPLETED');
  await fail(()=>owner`update chinatech_v2_private.office_v3_candidate_grants set active=true,revision=revision+1,revoked_at=null where id=${g}`,'23514');
  pass('Committed candidate recovery and lost-response commit retries survive revocation/pause/minimum changes; altered scope, seven-day expiry and completed replay stay closed');

  await owner`update chinatech_v2_private.office_v3_control set enabled=true,minimum_version='1.4.0',revision=revision+1`;
  const unstarted=await device(),revocable=await grant(unstarted),prepared=await start(unstarted);
  await revoke(revocable);await fail(()=>commit(unstarted,prepared),'CANDIDATE_DENIED');await fail(()=>unstarted.invoke({architecture:'win-x64'},'admission'),'CANDIDATE_DENIED');
  const expired=await device();await grant(expired,{createdAt:new Date(Date.now()-5*3600000),admitUntil:new Date(Date.now()-3600000)});await fail(()=>start(expired),'CANDIDATE_DENIED');
  const fast=await device(),fastUntil=new Date(Date.now()+3500);await grant(fast,{admitUntil:fastUntil});const fastStart=await start(fast);
  assert.ok(new Date(fastStart.startBefore).getTime()<=fastUntil.getTime());await new Promise(resolve=>setTimeout(resolve,3600));await fail(()=>commit(fast,fastStart),'START_EXPIRED');
  const paused=await device();await grant(paused);const pauseStart=await start(paused);
  await owner`update chinatech_v2_private.office_v3_control set minimum_version='1.5.0',revision=revision+1`;
  await fail(()=>commit(paused,pauseStart),'UPDATE_REQUIRED');await fail(()=>paused.invoke({architecture:'win-x64'},'admission'),'UPDATE_REQUIRED');
  await owner`update chinatech_v2_private.office_v3_control set minimum_version='1.4.0',revision=revision+1`;
  await owner`update chinatech_v2_private.office_v3_control set enabled=false,revision=revision+1`;
  await fail(()=>commit(paused,pauseStart),'DESKTOP_PAUSED');await fail(()=>start(paused),'DESKTOP_PAUSED');await fail(()=>paused.invoke({architecture:'win-x64'},'admission'),'DESKTOP_PAUSED');
  pass('Uncommitted candidate revocation, admission expiry and global pause prevent every first execution, including a previously prepared ticket');

  await owner`update chinatech_v2_private.office_v3_control set enabled=true,release_ready=true,verified_version='1.4.0',minimum_version='1.4.0',revision=revision+1`;
  const publicDevice=await device(),publicHint=await publicDevice.invoke({architecture:'win-x64'},'admission'),publicClaims=tokens.readV3(publicHint.admissionToken,'office-v3-admission');
  assert.equal(publicClaims.admissionMode,'public');assert.deepEqual(Array.from(publicClaims.actions),Array.from(tokens.v3Actions));
  const publicStart=await start(publicDevice);
  await owner`update chinatech_v2_private.office_v3_control set release_ready=false,verified_version=null`;
  await fail(()=>publicDevice.invoke({architecture:'win-x64'},'admission'),'CANDIDATE_DENIED');await fail(()=>start(publicDevice),'CANDIDATE_DENIED');
  await fail(()=>commit(publicDevice,publicStart),'SERVICE_UNAVAILABLE');
  await owner`update chinatech_v2_private.office_v3_control set release_ready=true,verified_version='1.4.0'`;
  const publicCommit=await commit(publicDevice,publicStart),publicPermit=tokens.readV3(publicCommit.permitToken,'office-v3-permit');
  assert.equal(publicPermit.admissionMode,'public');assert.equal(publicPermit.exp-publicPermit.iat,30*86400);assert.equal(publicPermit.grantId,undefined);
  pass('The existing verified public admission remains independent and retains its original thirty-day recovery scope');
 } finally {
  await owner`update chinatech_v2_private.office_v3_control set enabled=${control.enabled},minimum_version=${control.minimum_version},release_ready=${control.release_ready},verified_version=${control.verified_version}`;
 }
}
