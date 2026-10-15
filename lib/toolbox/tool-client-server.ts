import 'server-only';
import {verify} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {DesktopError,desktopUuid} from './office-desktop-token';
import {desktopBody,desktopFailure} from './office-desktop-server';
import {officeResponse} from './office-server';
import {transactionV3,lockV3,requestRateV3} from './office-desktop-v3-database';
import {hashV3,base64V3,objectV3,publicKeyV3,signedUpdateV3,type V3Proof} from './office-desktop-v3-token';
import {sourceHashV3} from './office-desktop-v3-server';
import {readTool} from './tool-registry-server';
import {acceptsRelease,type ToolId} from './tool-registry';
const origin='https://www.chinatech.in';
export function toolProofCanonical(path:string,payload:string,body:V3Proof){return ['CT-TOOLBOX-V1','POST',path,body.requestId,body.installationId,body.timestamp,body.nonce,hashV3(base64V3(payload)),hashV3('')].join('\n');}
export async function toolUpdate(toolId:ToolId){return transactionV3(null,'','tool-update','',async tx=>{
 await lockV3(tx,'control');const tool=await readTool(tx,toolId);if(!tool.ready||!tool.release)throw new DesktopError('SERVICE_UNAVAILABLE',503);
 const release=tool.release;
 if(release.releaseId!==tool.activeReleaseId||release.files.length<1||release.files.length>4||release.files.some(file=>{try{const url=new URL(file.href);return !/^[a-f0-9]{64}$/.test(file.sha256)||!Number.isSafeInteger(file.bytes)||file.bytes<=0||file.bytes>1024*1024*1024||url.origin!==origin||url.search!==''||url.hash!==''||url.username!==''||url.password!==''||!url.pathname.startsWith(toolId==='windows-check'?'/toolbox/windows-current/':'/toolbox/phone-current/');}catch{return true;}}))throw new DesktopError('SERVICE_UNAVAILABLE',503);
 const now=Math.floor(Date.now()/1000);return signedUpdateV3({v:1,iss:origin,aud:'toolbox-v1-update',toolId,activeReleaseId:tool.activeReleaseId,releaseId:release.releaseId,version:release.version,files:release.files,prerelease:release.prerelease,authenticodeSigned:release.authenticodeSigned,issuedAt:now,expiresAt:now+300});
});}
export async function toolOperation(request:NextRequest,toolId:ToolId,op:'start'|'resume'|'outcome'){
 try{
  const source=sourceHashV3(request);await requestRateV3('source',source,180);
  if(op==='start')await requestRateV3('source',hashV3('toolbox-v1-new-task:'+source),30);
  const path=`/api/toolbox/client/v1/${toolId}/jobs/${op}`;
  if(request.nextUrl.origin!==origin||request.nextUrl.pathname!==path||request.headers.has('authorization'))throw new DesktopError('INVALID_REQUEST');
  const wire=await desktopBody(request,['payload','signature']);if(typeof wire.payload!=='string')throw new DesktopError('INVALID_REQUEST');
  let body:V3Proof;try{body=objectV3(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(base64V3(wire.payload))),['requestId','installationId','appVersion','releaseId','timestamp','nonce','publicKey','jobId','action','scopeHash',...(op==='outcome'?['checkpointHash']:[])]) as V3Proof;}catch{throw new DesktopError('INVALID_REQUEST');}
  desktopUuid(body.requestId);desktopUuid(body.installationId);desktopUuid(body.jobId);base64V3(body.nonce,32);
  if(typeof body.appVersion!=='string'||body.appVersion.length<1||body.appVersion.length>96||typeof body.releaseId!=='string'||!/^[a-z0-9][a-z0-9.-]{0,95}$/.test(body.releaseId)||typeof body.scopeHash!=='string'||!/^[a-f0-9]{64}$/.test(body.scopeHash)||!Number.isSafeInteger(body.timestamp)||Math.abs(Number(body.timestamp)-Date.now()/1000)>300)throw new DesktopError('INVALID_REQUEST');
  if(!(toolId==='windows-check'?body.action==='detect':toolId==='phone-assistant'&&['send','receive'].includes(String(body.action))))throw new DesktopError('INVALID_REQUEST');
  const key=publicKeyV3(body.publicKey),keyHash=hashV3(base64V3(body.publicKey));
  // Reuse the audited P256 verifier with its fixed framing changed only for this protocol.
  if(!verify('sha256',Buffer.from(toolProofCanonical(path,wire.payload,body)),{key,dsaEncoding:'ieee-p1363'},base64V3(wire.signature,64)))throw new DesktopError('DEVICE_PROOF_INVALID',401);
  await requestRateV3('instance',hashV3('toolbox-v1:'+toolId+':'+body.installationId+':'+keyHash),60);
  if(op==='start')await requestRateV3('instance',hashV3('toolbox-v1-new-task:'+toolId+':'+body.installationId+':'+keyHash),10);
  const fingerprint=hashV3(JSON.stringify([toolId,body.releaseId,body.appVersion,body.jobId,body.action,body.scopeHash,body.publicKey]));
  const result=await transactionV3(body,keyHash,'tool-'+op,source,async tx=>{
   await lockV3(tx,'control');await lockV3(tx,'tool-instance:'+body.installationId);
   const [known]=await tx<{key_hash:string;public_key:string}[]>`select key_hash,public_key from chinatech_v2_private.toolbox_devices where installation_id=${body.installationId}`;
   if(known&&(known.key_hash!==keyHash||known.public_key!==body.publicKey))throw new DesktopError('DEVICE_KEY_CONFLICT',409);
   const existing=await tx<{job_id:string;fingerprint:string;request_id:string;nonce:string;permit:Record<string,unknown>;expires_at:Date;completed_at:Date|null;completion_hash:string|null}[]>`select job_id,fingerprint,request_id,nonce,permit,expires_at,completed_at,completion_hash from chinatech_v2_private.toolbox_jobs where installation_id=${body.installationId} and (job_id=${String(body.jobId)} or request_id=${body.requestId} or nonce=${String(body.nonce)})`;
   if(existing.length){const row=existing[0];if(existing.length!==1||row.job_id!==body.jobId||row.fingerprint!==fingerprint||(op==='start'&&(row.request_id!==body.requestId||row.nonce!==body.nonce)))throw new DesktopError('REQUEST_CONFLICT',409);if(row.expires_at.getTime()<=Date.now())throw new DesktopError('RESUME_EXPIRED',403);
    if(op==='outcome'){
     if(typeof body.checkpointHash!=='string'||!/^[a-f0-9]{64}$/.test(body.checkpointHash))throw new DesktopError('INVALID_REQUEST');
     if(row.completed_at&&row.completion_hash!==body.checkpointHash)throw new DesktopError('REQUEST_CONFLICT',409);
     if(!row.completed_at)await tx`update chinatech_v2_private.toolbox_jobs set completed_at=now(),completion_hash=${body.checkpointHash} where job_id=${String(body.jobId)}`;
     return {completed:true};
    }
    if(row.completed_at)throw new DesktopError('JOB_COMPLETED',409);return {permit:row.permit};}
   if(op!=='start')throw new DesktopError('SESSION_INVALID',401);
   const tool=await readTool(tx,toolId);if(!tool.enabled)throw new DesktopError('DESKTOP_PAUSED',403);if(!acceptsRelease(tool,body.releaseId)||tool.release?.version!==body.appVersion)throw new DesktopError('UPDATE_REQUIRED',426);
   if(!known)await tx`insert into chinatech_v2_private.toolbox_devices(installation_id,key_hash,public_key) values(${body.installationId},${keyHash},${String(body.publicKey)})`;
   const now=Math.floor(Date.now()/1000),expires=now+30*86400;
   const permit=signedUpdateV3({v:1,iss:origin,aud:'toolbox-v1-task',toolId,releaseId:body.releaseId,installationId:body.installationId,jobId:body.jobId,action:body.action,scopeHash:body.scopeHash,keyHash,issuedAt:now,expiresAt:expires});
   await tx`insert into chinatech_v2_private.toolbox_jobs(job_id,tool_id,release_id,app_version,installation_id,key_hash,action,scope_hash,request_id,nonce,fingerprint,permit,created_at,expires_at) values(${String(body.jobId)},${toolId},${String(body.releaseId)},${body.appVersion},${body.installationId},${keyHash},${String(body.action)},${String(body.scopeHash)},${body.requestId},${String(body.nonce)},${fingerprint},${tx.json(permit)},${new Date(now*1000)},${new Date(expires*1000)})`;
   return {permit};
  });return officeResponse(NextResponse.json(result));
 }catch(error){return desktopFailure(error);}
}
