import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { env,load,tokens,publicKey,plan,proof,signed } from './office-desktop-v3.test.mjs';
const {NextRequest,NextResponse}=createRequire(import.meta.url)('next/server');

export async function requestRateChecks({owner,runtime,db,call,pass}) {
 const fail=(fn,code)=>assert.rejects(fn,error=>error.code===code);
 const [clock]=await owner`select extract(second from clock_timestamp()) as second`;
 if(Number(clock.second)>45)await new Promise(resolve=>setTimeout(resolve,(61-Number(clock.second))*1000));
 const key=tokens.hashV3(randomUUID());
 const attempts=await Promise.allSettled(Array.from({length:12},()=>db.requestRateV3('source',key,5)));
 assert.equal(attempts.filter(x=>x.status==='fulfilled').length,5);assert.equal(attempts.filter(x=>x.status==='rejected'&&x.reason.code==='RATE_LIMITED').length,7);
 assert.equal((await owner`select requests from chinatech_v2_private.office_v3_rate_buckets where kind='source' and key_hash=${key}`)[0].requests,12);
 await owner`update chinatech_v2_private.office_v3_rate_buckets set minute=minute-1,requests=1000 where kind='source' and key_hash=${key}`;
 await db.requestRateV3('source',key,5);
 const [reset]=await owner`select count(*)::integer as n,max(requests)::integer as requests from chinatech_v2_private.office_v3_rate_buckets where kind='source' and key_hash=${key}`;assert.equal(reset.n,1);assert.equal(reset.requests,1);
 assert.equal((await runtime`select count(*)::integer as n from chinatech_v2_private.office_v3_rate_buckets`)[0].n,0);
 await fail(()=>runtime`delete from chinatech_v2_private.office_v3_rate_buckets`,'42501');
 await fail(()=>runtime`update chinatech_v2_private.office_v3_rate_buckets set key_hash=${'f'.repeat(64)}`,'42501');
 pass('Independent request buckets atomically count accepted and denied attempts, reset the same row each minute and remain scoped by FORCE RLS');

 const [control]=await owner`select enabled,minimum_version,release_ready,verified_version from chinatech_v2_private.office_v3_control`;
 const oldVercel=env.VERCEL,oldRate=env.OFFICE_DESKTOP_V3_RATE_SECRET;env.VERCEL='1';env.OFFICE_DESKTOP_V3_RATE_SECRET='a'.repeat(64);
 const bodyAdapter={desktopBody:async request=>request.json(),desktopFailure:error=>NextResponse.json({code:error.code??'INVALID_REQUEST'},{status:error.status??400})};
 const responseAdapter={officeResponse:response=>response};
 const overrides={'./tool-registry-server':{readTool:async()=>({toolId:'office',activeReleaseId:'office-1.4.0',enabled:true,ready:true,release:{version:'1.4.0'}})},'./office-desktop-v3-database':db,'./office-desktop-server':bodyAdapter,'./office-server':responseAdapter};
 const http=load('lib/toolbox/office-desktop-v3-server.ts',overrides,env);
 const route=load('app/api/toolbox/office-desktop/v3/status/route.ts',{
  '@/lib/toolbox/office-desktop-v3-server':http,'@/lib/toolbox/office-desktop-v3-database':db,'@/lib/toolbox/office-desktop-server':bodyAdapter,'@/lib/toolbox/office-server':responseAdapter},env);
 const ip='203.0.113.77',installationId=randomUUID(),source=tokens.hashV3(installationId),keyHash=tokens.hashV3(Buffer.from(publicKey,'base64url'));
 const instanceHash=tokens.hashV3('office-v3:instance:'+installationId+':'+keyHash);
 const request=(op,wire,bearer='',address=ip)=>new NextRequest(tokens.v3Origin+tokens.pathV3(op),{method:'POST',headers:{'content-type':'application/json','x-vercel-forwarded-for':address,...(bearer?{authorization:'Bearer '+bearer}:{})},body:typeof wire==='string'?wire:JSON.stringify(wire)});
 const invoke=(op,body,bearer='',wire=signed(body,op,bearer))=>http.handleV3(request(op,wire,bearer),op);
 const count=async(kind,key)=>Number((await owner`select requests from chinatech_v2_private.office_v3_rate_buckets where kind=${kind} and key_hash=${key}`)[0]?.requests??0);
 const sourceHash=http.sourceHashV3(request('session','{}'));
 try {
  await owner`update chinatech_v2_private.office_v3_control set enabled=true,minimum_version='1.4.0',release_ready=true,verified_version='1.4.0'`;
  const body=fields=>proof({installationId,...fields}),session=await call(body({publicKey}),'session','',source);
  const start=await call(body({jobId:randomUUID(),action:'install',architecture:'win-x64',plan}),'start',session.sessionToken,source);
  const commit=await call(body({jobId:start.jobId,planHash:start.planHash}),'commit',start.startToken,source);
  assert.ok((await http.handleV3(request('outcome','{'),'outcome')).status>=400);assert.equal(await count('source',sourceHash),1);assert.equal(await count('instance',instanceHash),0);
  const invalid=body({jobId:start.jobId,planHash:start.planHash,status:'bad',checkpointHash:'a'.repeat(64)}),wire=signed(invalid,'outcome',commit.permitToken);wire.signature='a'.repeat(86);
  assert.equal((await invoke('outcome',invalid,commit.permitToken,wire)).status,401);assert.equal(await count('source',sourceHash),2);assert.equal(await count('instance',instanceHash),0);
  const retried=body({jobId:start.jobId,planHash:start.planHash}),first=await invoke('commit',retried,start.startToken),again=await invoke('commit',retried,start.startToken);
  assert.equal(first.status,200,await first.clone().text());assert.equal(again.status,200);assert.deepEqual(await first.json(),await again.json());
  assert.equal((await invoke('resume',body({jobId:start.jobId,planHash:start.planHash}),commit.permitToken)).status,200);
  assert.equal((await invoke('outcome',invalid,commit.permitToken)).status,400);
  const hintBody=body({architecture:'win-x64'});const hintResponse=await invoke('admission',hintBody,session.sessionToken);assert.equal(hintResponse.status,200,await hintResponse.clone().text());assert.equal((await invoke('admission',hintBody,session.sessionToken)).status,409);
  assert.equal(await count('instance',instanceHash),6);assert.equal(await count('source',sourceHash),8);
  pass('Actual HTTP handler counts malformed, invalid-signature and rolled-back business refusals; valid commit/resume/outcome/admission use instance counts and idempotent retries retain their response');
  const statuses=[];
  for(let i=0;i<55;i++)statuses.push((await invoke('outcome',body({jobId:start.jobId,planHash:start.planHash,status:'bad',checkpointHash:'b'.repeat(64)}),commit.permitToken)).status);
  assert.equal(statuses.filter(status=>status===400).length,54);assert.equal(statuses.at(-1),429);assert.equal(await count('instance',instanceHash),61);
  assert.equal((await owner`select count(*)::integer as n from chinatech_v2_private.office_v3_outcomes where job_id=${start.jobId}`)[0].n,0);
  const otherIp='203.0.113.78',otherHash=http.sourceHashV3(request('outcome','{','',otherIp));
  await owner`insert into chinatech_v2_private.office_v3_rate_buckets(kind,key_hash,minute,requests) values('source',${otherHash},floor(extract(epoch from statement_timestamp())/60)::bigint,179)`;
  assert.ok((await http.handleV3(request('outcome','{','',otherIp),'outcome')).status>=400);
  const limited=await http.handleV3(request('outcome','{','',otherIp),'outcome');assert.equal(limited.status,429);assert.equal((await limited.json()).code,'RATE_LIMITED');assert.equal(await count('source',otherHash),181);
  const statusRequest=new NextRequest(tokens.v3Origin+'/api/toolbox/office-desktop/v3/status',{headers:{'x-vercel-forwarded-for':otherIp}});assert.equal((await route.GET(statusRequest)).status,429);
  const columns=await owner`select column_name from information_schema.columns where table_schema='chinatech_v2_private' and table_name='office_v3_rate_buckets' order by ordinal_position`;
  assert.deepEqual(columns.map(row=>row.column_name),['kind','key_hash','minute','requests']);
  pass('HTTP recovery/outcome floods stop at sixty verified-instance requests; source limits apply before parsing and to GET status, with no raw IP or payload stored');
 } finally {
  if(oldVercel===undefined)delete env.VERCEL;else env.VERCEL=oldVercel;
  if(oldRate===undefined)delete env.OFFICE_DESKTOP_V3_RATE_SECRET;else env.OFFICE_DESKTOP_V3_RATE_SECRET=oldRate;
  await owner`update chinatech_v2_private.office_v3_control set enabled=${control.enabled},minimum_version=${control.minimum_version},release_ready=${control.release_ready},verified_version=${control.verified_version}`;
 }
}
