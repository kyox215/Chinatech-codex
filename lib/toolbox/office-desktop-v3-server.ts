import 'server-only';
import {readTool} from './tool-registry-server';
import {acceptsRelease} from './tool-registry';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { TransactionSql } from 'postgres';
import { NextRequest, NextResponse } from 'next/server';
import { desktopBody, desktopFailure } from './office-desktop-server';
import { DesktopError, desktopUuid } from './office-desktop-token';
import { officeResponse } from './office-server';
import { compareDesktopVersions } from './office-desktop-public-token';
import { lockV3, requestRateV3, transactionV3 } from './office-desktop-v3-database';
import { activityV3, base64V3, hashV3, objectV3, pathV3, planV3, proofV3, publicKeysV3, publicKeyV3, readV3, signV3, signedUpdateV3, signingReadyV3, verifyProofV3, v3Actions, v3Origin, type V3Claims, type V3Proof, type V3Plan } from './office-desktop-v3-token';

type Control = { enabled: boolean; minimum_version: string; verified_version: string | null; release_ready: boolean; revision: string };
type Intent = { job_id: string; token: string; plan_hash: string; start_before: Date; admission_mode: 'public' | 'candidate'; candidate_grant_id: string | null; candidate_revision: string | null };
type Commit = { job_id: string; permit_token: string; plan_hash: string; resume_until: Date };
type Candidate = { id: string; revision: string; action: string; admit_until: Date };
const fields = { session: ['publicKey'], admission: ['architecture'], start: ['jobId', 'action', 'architecture', 'plan'], commit: ['jobId', 'planHash'], resume: ['jobId', 'planHash'], activity: ['jobId', 'planHash', 'stage', 'errorCode'], outcome: ['jobId', 'planHash', 'status', 'checkpointHash'] } as const;
export type V3Operation = keyof typeof fields;
const equalV3 = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
export function sourceHashV3(request: NextRequest): string {
  // Only the platform-overwritten header is accepted on Vercel. A self-hosted
  // deployment needs a separately audited trusted-source adapter, not client XFF.
  const secret = process.env.OFFICE_DESKTOP_V3_RATE_SECRET;
  const ip = process.env.VERCEL === '1' ? request.headers.get('x-vercel-forwarded-for') : null;
  if (!secret || !/^[a-f0-9]{64}$/.test(secret) || !ip || !isIP(ip)) throw new DesktopError('SERVICE_UNAVAILABLE', 503);
  return createHmac('sha256', Buffer.from(secret, 'hex')).update('office-v3:source\0' + ip.toLowerCase()).digest('hex');
}
async function controlV3(tx: TransactionSql) {
  const [row] = await tx<Control[]>`select enabled,minimum_version,verified_version,release_ready,revision::text from chinatech_v2_private.office_v3_control where singleton`;
  if (!row) throw new DesktopError('SERVICE_UNAVAILABLE', 503);
  return row;
}
function admissionBaseV3(row: Control, version: string) {
  if (!row.enabled) throw new DesktopError('DESKTOP_PAUSED', 403);
  if (!signingReadyV3()) throw new DesktopError('SERVICE_UNAVAILABLE', 503);
  if (compareDesktopVersions(version, row.minimum_version) < 0) throw new DesktopError('UPDATE_REQUIRED', 426);
}
function publicV3(row: Control, version: string) { return row.release_ready && row.verified_version !== null && compareDesktopVersions(version, row.verified_version) <= 0; }
async function candidatesV3(tx: TransactionSql, body: V3Proof, keyHash: string, architecture: string, action?: string, plan?: V3Plan, grantId?: string) {
  return tx<Candidate[]>`select distinct on(g.action) g.id,g.revision::text,g.action,g.admit_until from chinatech_v2_private.office_v3_candidate_grants g
   where g.installation_id=${body.installationId} and g.key_hash=${keyHash} and g.app_version=${body.appVersion} and g.architecture=${architecture}
   and g.active and g.created_at<=now() and g.admit_until>now()
   and (${action ?? null}::text is null or g.action=${action ?? null})
   and (${plan ? hashV3(JSON.stringify(plan)) : null}::text is null or (g.plan_hash=${plan ? hashV3(JSON.stringify(plan)) : null} and g.plan=${plan ? tx.json(plan) : null}))
   and (${grantId ?? null}::uuid is null or g.id=${grantId ?? null})
   and not exists(select 1 from chinatech_v2_private.office_v3_commits c where c.candidate_grant_id=g.id)
   order by g.action,g.admit_until,g.id limit 5`;
}
async function latestReleaseV3(tx:TransactionSql,body:V3Proof){
 const tool=await readTool(tx,'office');
 if(!tool.enabled)throw new DesktopError('DESKTOP_PAUSED',403);
 if(!tool.ready||!tool.release)throw new DesktopError('SERVICE_UNAVAILABLE',503);
 if(tool.activeReleaseId!=='office-1.4.0' && (body.appVersion!==tool.release.version || !acceptsRelease(tool,body.releaseId)))throw new DesktopError('UPDATE_REQUIRED',426);
}
async function snapshotV3(tx:TransactionSql) {
  await lockV3(tx,'control');
  const row=await controlV3(tx),tool=await readTool(tx,'office');
  const sourceReady=process.env.VERCEL==='1'&&/^[a-f0-9]{64}$/.test(process.env.OFFICE_DESKTOP_V3_RATE_SECRET??'');
  const signingReady=signingReadyV3(),accepting=tool.enabled&&tool.ready&&tool.release?.version===row.verified_version&&row.minimum_version===row.verified_version&&row.enabled&&row.release_ready&&signingReady&&sourceReady;
  return {tool,status:{v:3,activeReleaseId:tool.activeReleaseId,acceptingNewSessions:accepting,acceptingNewJobs:accepting,signingReady,minimumVersion:row.minimum_version,currentVersion:row.release_ready?row.verified_version:null,origin:v3Origin}};
}
export async function statusV3(){return transactionV3(null,'','status','',async tx=>(await snapshotV3(tx)).status);}
export async function updateV3(){
  const {tool,status}=await transactionV3(null,'','update','',snapshotV3),now=Math.floor(Date.now()/1000);
  const release=tool.release;
  if(!release||!tool.ready||release.releaseId!==tool.activeReleaseId)throw new DesktopError('SERVICE_UNAVAILABLE',503);
  const publisherCertificateSha256=release.publisherCertificateSha256??null;
  if(publisherCertificateSha256!==null&&!/^[a-f0-9]{64}$/.test(publisherCertificateSha256)||release.authenticodeSigned&&publisherCertificateSha256===null)throw new DesktopError('SERVICE_UNAVAILABLE',503);
  if(release.files.length!==2||new Set(release.files.map(file=>file.architecture)).size!==2||release.files.some(file=>!['x64','ARM64'].includes(file.architecture)||!/^[a-f0-9]{64}$/.test(file.sha256)||!Number.isSafeInteger(file.bytes)||file.bytes<=0||file.href!==`https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v${release.version}/ChinaTech-Office-Assistant-${file.architecture}.exe`))throw new DesktopError('SERVICE_UNAVAILABLE',503);
  return signedUpdateV3({v:3,iss:v3Origin,aud:'office-v3-update',issuedAt:now,expiresAt:now+300,releaseId:release.releaseId,version:release.version,websiteControlProtocol:release.websiteControlProtocol??3,authenticodeSigned:release.authenticodeSigned,publisherCertificateSha256,prerelease:release.prerelease,files:release.files,control:status,trustedKeys:publicKeysV3(),trustPolicy:'embedded-keyring-only'});
}
export function fingerprintV3(body: V3Proof, op: V3Operation, bearer: string): string {
  const business = op === 'session' ? [body.publicKey] : op === 'admission' ? [body.architecture] : op === 'start' ? [body.jobId, body.action, body.architecture, planV3(body.plan, String(body.action))] : op === 'activity' ? [body.jobId, body.planHash, activityV3(body.stage, body.errorCode)] : op === 'outcome' ? [body.jobId, body.planHash, body.status, body.checkpointHash] : [body.jobId, body.planHash];
  const original = [op, body.installationId, body.appVersion, hashV3(bearer), ...business];
  return hashV3(JSON.stringify(body.releaseId === undefined ? original : [...original,['releaseId',body.releaseId]]));
}
async function rateV3(tx: TransactionSql, body: V3Proof, source: string, op: V3Operation) {
  if (!['session', 'admission', 'start'].includes(op)) return;
  // Per-source lock prevents unlimited new installation UUIDs bypassing IP rate.
  await lockV3(tx, 'source:' + source);
  const [r] = await tx<{ source_count: number; instance_count: number }[]>`select count(*) filter(where source_hash=${source})::integer as source_count,count(*) filter(where installation_id=${body.installationId})::integer as instance_count from chinatech_v2_private.office_v3_receipts where endpoint in('session','admission','start') and created_at>now()-interval '1 minute'`;
  if (r.source_count >= 30 || r.instance_count >= 10) throw new DesktopError('RATE_LIMITED', 429);
}
async function latestV3(tx: TransactionSql, jobId: string) {
  const [row] = await tx<{ status: string; sequence: number }[]>`select status,sequence from chinatech_v2_private.office_v3_outcomes where job_id=${jobId} order by (status='completed') desc,sequence desc limit 1`;
  return row;
}
export async function operationV3(tx: TransactionSql, body: V3Proof, op: V3Operation, bearer: string, source: string, payload: string, signature: unknown): Promise<Record<string, unknown>> {
  await lockV3(tx, 'installation:' + body.installationId);
  let keyHash: string;
  if (op === 'session') {
    const key = publicKeyV3(body.publicKey); keyHash = hashV3(base64V3(body.publicKey));
    verifyProofV3(pathV3(op), payload, body, signature, key, bearer);
    const [known] = await tx<{ key_hash: string; public_key: string }[]>`select key_hash,public_key from chinatech_v2_private.office_v3_devices where installation_id=${body.installationId}`;
    if (known && (!equalV3(known.key_hash, keyHash) || !equalV3(known.public_key, String(body.publicKey)))) throw new DesktopError('DEVICE_KEY_CONFLICT', 409);
    if (!known) await tx`insert into chinatech_v2_private.office_v3_devices(installation_id,key_hash,public_key) values(${body.installationId},${keyHash},${String(body.publicKey)})`;
  } else {
    const [device] = await tx<{ key_hash: string; public_key: string }[]>`select key_hash,public_key from chinatech_v2_private.office_v3_devices where installation_id=${body.installationId}`;
    if (!device) throw new DesktopError('DEVICE_PROOF_INVALID', 401);
    keyHash = device.key_hash;
    verifyProofV3(pathV3(op), payload, body, signature, publicKeyV3(device.public_key), bearer);
  }
  const fingerprint = fingerprintV3(body, op, bearer);
  if (['commit', 'resume', 'activity'].includes(op) && typeof body.jobId === 'string' && (await latestV3(tx, desktopUuid(body.jobId)))?.status === 'completed') throw new DesktopError('JOB_COMPLETED', 409);
  const prior = await tx<{ request_id: string; nonce: string; endpoint: string; fingerprint: string; response: Record<string, unknown> }[]>`select request_id,nonce,endpoint,fingerprint,response from chinatech_v2_private.office_v3_receipts where installation_id=${body.installationId} and (request_id=${body.requestId} or nonce=${String(body.nonce)})`;
  if (prior.length) {
    const row = prior[0];
    if (prior.length !== 1 || row.request_id !== body.requestId || row.nonce !== body.nonce || row.endpoint !== op || !equalV3(row.fingerprint, fingerprint)) throw new DesktopError('REQUEST_CONFLICT', 409);
    if (op === 'admission') throw new DesktopError('REQUEST_CONFLICT', 409);
    return row.response;
  }
  await rateV3(tx, body, source, op);
  let response: Record<string, unknown>;
  const now = Math.floor(Date.now() / 1000);
  if (op === 'session') {
    // A session is only transport identity. Admission is enforced at start so an
    // expired session can be refreshed to recover an already started job.
    const sessionToken = signV3({ v: 3, iss: v3Origin, aud: 'office-v3-session', sub: body.installationId, keyHash, appVersion: body.appVersion, iat: now, exp: now + 3600, jti: body.requestId });
    await tx`insert into chinatech_v2_private.office_v3_sessions(id,installation_id,key_hash,app_version,token,created_at,expires_at) values(${body.requestId},${body.installationId},${keyHash},${body.appVersion},${sessionToken},${new Date(now * 1000)},${new Date((now + 3600) * 1000)})`;
    response = { sessionToken, expiresAt: new Date((now + 3600) * 1000).toISOString(), installationId: body.installationId, keyHash };
  } else if (op === 'start' || op === 'admission') {
    const session = readV3(bearer, 'office-v3-session');
    if (session.sub !== body.installationId || !equalV3(session.keyHash, keyHash) || session.appVersion !== body.appVersion) throw new DesktopError('SESSION_INVALID', 401);
    const [stored] = await tx<{ token: string; expires_at: Date }[]>`select token,expires_at from chinatech_v2_private.office_v3_sessions where id=${session.jti}`;
    if (!stored || !equalV3(stored.token, bearer) || stored.expires_at.getTime() <= Date.now()) throw new DesktopError('SESSION_INVALID', 401);
    const architecture = String(body.architecture);
    if (!['win-x64', 'win-arm64'].includes(architecture)) throw new DesktopError('PLAN_INVALID');
    if (op === 'admission') {
      await lockV3(tx, 'control'); const control = await controlV3(tx); await latestReleaseV3(tx,body); admissionBaseV3(control, body.appVersion);
      const publicAdmission = publicV3(control, body.appVersion);
      const grants = publicAdmission ? [] : await candidatesV3(tx, body, keyHash, architecture);
      const actions = publicAdmission ? [...v3Actions] : v3Actions.filter(action => grants.some(grant => grant.action === action));
      const exp = publicAdmission ? now + 60 : Math.min(now + 60, ...grants.map(grant => Math.floor(grant.admit_until.getTime() / 1000)));
      if (!actions.length || exp <= now) throw new DesktopError('CANDIDATE_DENIED', 403);
      response = { admissionToken: signV3({ v: 3, iss: v3Origin, aud: 'office-v3-admission', sub: body.installationId, keyHash,
        appVersion: body.appVersion, architecture, admissionMode: publicAdmission ? 'public' : 'candidate', actions, iat: now, exp, jti: body.requestId }), expiresAt: new Date(exp * 1000).toISOString() };
    } else {
      const jobId = desktopUuid(body.jobId), action = String(body.action);
      if (!v3Actions.includes(action as typeof v3Actions[number]) || !['win-x64', 'win-arm64'].includes(architecture)) throw new DesktopError('PLAN_INVALID');
      const plan = planV3(body.plan, action), planHash = hashV3(JSON.stringify(plan));
      const [existing] = await tx`select job_id from chinatech_v2_private.office_v3_intents where job_id=${jobId}`;
      if (existing) throw new DesktopError('REQUEST_CONFLICT', 409);
      await lockV3(tx, 'control'); const control = await controlV3(tx); await latestReleaseV3(tx,body); admissionBaseV3(control, body.appVersion);
      let grant: Candidate | undefined;
      if (!publicV3(control, body.appVersion)) {
        [grant] = await candidatesV3(tx, body, keyHash, architecture, action, plan);
        if (!grant) throw new DesktopError('CANDIDATE_DENIED', 403);
        await lockV3(tx, 'grant:' + grant.id);
        [grant] = await candidatesV3(tx, body, keyHash, architecture, action, plan, grant.id);
        if (!grant) throw new DesktopError('CANDIDATE_DENIED', 403);
      }
      const exp = grant ? Math.min(now + 300, Math.floor(grant.admit_until.getTime() / 1000)) : now + 300;
      if (exp <= now) throw new DesktopError('CANDIDATE_DENIED', 403);
      const claims: V3Claims = { v: 3, iss: v3Origin, aud: 'office-v3-start', sub: body.installationId, keyHash, appVersion: body.appVersion, iat: now, exp, jti: body.requestId, jobId, action, architecture, plan, planHash, controlRevision: control.revision,
        admissionMode: grant ? 'candidate' : 'public', ...(grant ? { grantId: grant.id, grantRevision: grant.revision } : {}) };
      const startToken = signV3(claims), startBefore = new Date(exp * 1000);
      await tx`insert into chinatech_v2_private.office_v3_intents(job_id,installation_id,key_hash,session_id,action,architecture,app_version,plan,plan_hash,control_revision,token,created_at,start_before,admission_mode,candidate_grant_id,candidate_revision) values(${jobId},${body.installationId},${keyHash},${session.jti},${action},${architecture},${body.appVersion},${tx.json(plan)},${planHash},${control.revision},${startToken},${new Date(now * 1000)},${startBefore},${claims.admissionMode!},${grant?.id ?? null},${grant?.revision ?? null})`;
      response = { jobId, startToken, startBefore: startBefore.toISOString(), planHash };
    }
  } else {
    const claims = readV3(bearer, op === 'commit' ? 'office-v3-start' : 'office-v3-permit', now, op === 'commit');
    const jobId = desktopUuid(body.jobId);
    if (claims.sub !== body.installationId || !equalV3(claims.keyHash, keyHash) || claims.jobId !== jobId || claims.planHash !== body.planHash || claims.appVersion !== body.appVersion) throw new DesktopError('SESSION_INVALID', 401);
    await lockV3(tx, 'job:' + jobId);
    const [intent] = await tx<Intent[]>`select job_id,token,plan_hash,start_before,admission_mode,candidate_grant_id,candidate_revision::text from chinatech_v2_private.office_v3_intents where job_id=${jobId}`;
    if (!intent || intent.plan_hash !== body.planHash) throw new DesktopError('SESSION_INVALID', 401);
    let [commit] = await tx<Commit[]>`select job_id,permit_token,plan_hash,resume_until from chinatech_v2_private.office_v3_commits where job_id=${jobId}`;
    if (op === 'commit') {
      if (!equalV3(intent.token, bearer)) throw new DesktopError('SESSION_INVALID', 401);
      if (!commit) {
        if (claims.exp <= now || intent.start_before.getTime() <= Date.now()) throw new DesktopError('START_EXPIRED', 401);
        await lockV3(tx, 'control'); const control = await controlV3(tx); await latestReleaseV3(tx,body); admissionBaseV3(control, body.appVersion);
        if (intent.admission_mode !== (claims.admissionMode ?? 'public')) throw new DesktopError('SESSION_INVALID', 401);
        if (intent.admission_mode === 'candidate') {
          if (intent.candidate_grant_id !== claims.grantId || intent.candidate_revision !== claims.grantRevision) throw new DesktopError('SESSION_INVALID', 401);
          await lockV3(tx, 'grant:' + claims.grantId);
          const [grant] = await candidatesV3(tx, body, keyHash, claims.architecture!, claims.action, claims.plan, claims.grantId);
          if (!grant || grant.revision !== claims.grantRevision) throw new DesktopError('CANDIDATE_DENIED', 403);
        } else if (!publicV3(control, body.appVersion)) throw new DesktopError('SERVICE_UNAVAILABLE', 503);
        const days = intent.admission_mode === 'candidate' ? 7 : 30;
        const resumeUntil = new Date((now + days * 86400) * 1000), permitToken = signV3({ ...claims, aud: 'office-v3-permit', iat: now, exp: now + days * 86400, jti: body.requestId });
        await tx`insert into chinatech_v2_private.office_v3_commits(job_id,installation_id,key_hash,plan_hash,permit_token,created_at,resume_until,admission_mode,candidate_grant_id,candidate_revision) values(${jobId},${body.installationId},${keyHash},${intent.plan_hash},${permitToken},${new Date(now * 1000)},${resumeUntil},${intent.admission_mode},${intent.candidate_grant_id},${intent.candidate_revision})`;
        commit = { job_id: jobId, permit_token: permitToken, plan_hash: intent.plan_hash, resume_until: resumeUntil };
      }
      if ((await latestV3(tx, jobId))?.status === 'completed') throw new DesktopError('JOB_COMPLETED', 409);
      if (commit.resume_until.getTime() <= Date.now()) throw new DesktopError('RESUME_EXPIRED', 401);
      response = { jobId, permitToken: commit.permit_token, resumeUntil: commit.resume_until.toISOString(), planHash: commit.plan_hash };
    } else {
      if (!commit || !equalV3(commit.permit_token, bearer)) throw new DesktopError('JOB_NOT_STARTED', 403);
      const latest = await latestV3(tx, jobId);
      if (latest?.status === 'completed') throw new DesktopError('JOB_COMPLETED', 409);
      if (commit.resume_until.getTime() <= Date.now()) throw new DesktopError('RESUME_EXPIRED', 401);
      if (op === 'resume') response = { jobId, permitToken: commit.permit_token, resumeUntil: commit.resume_until.toISOString(), planHash: commit.plan_hash };
      else if (op === 'activity') {
        const activity = activityV3(body.stage, body.errorCode);
        const [prior] = await tx<{ stage: string; error_code: string | null; last_activity_at: Date }[]>`select stage,error_code,last_activity_at from chinatech_v2_private.office_v3_activity where job_id=${jobId}`;
        const coalesced = !!prior && Date.now() - prior.last_activity_at.getTime() < 60000;
        const recordedAt = coalesced ? prior.last_activity_at : new Date();
        if (!coalesced) await tx`insert into chinatech_v2_private.office_v3_activity(job_id,installation_id,key_hash,plan_hash,stage,error_code,last_activity_at)
          values(${jobId},${body.installationId},${keyHash},${String(body.planHash)},${activity.stage},${activity.errorCode},${recordedAt})
          on conflict(job_id) do update set stage=excluded.stage,error_code=excluded.error_code,last_activity_at=excluded.last_activity_at`;
        response = { jobId, stage: coalesced ? prior.stage : activity.stage, errorCode: coalesced ? prior.error_code : activity.errorCode, lastActivityAt: recordedAt.toISOString(), coalesced, nextReportAfterSeconds: 60 };
      }
      else {
        if (!['completed', 'failed', 'cancelled', 'paused'].includes(String(body.status)) || typeof body.checkpointHash !== 'string' || !/^[a-f0-9]{64}$/.test(body.checkpointHash)) throw new DesktopError('INVALID_REQUEST');
        const recordedAt = new Date();
        await tx`insert into chinatech_v2_private.office_v3_outcomes(job_id,sequence,installation_id,key_hash,status,checkpoint_hash,created_at) values(${jobId},${(latest?.sequence ?? 0) + 1},${body.installationId},${keyHash},${String(body.status)},${body.checkpointHash},${recordedAt})`;
        response = { jobId, status: body.status, recordedAt: recordedAt.toISOString() };
      }
    }
  }
  await tx`insert into chinatech_v2_private.office_v3_receipts(installation_id,key_hash,request_id,nonce,endpoint,fingerprint,source_hash,response) values(${body.installationId},${keyHash},${body.requestId},${String(body.nonce)},${op},${fingerprint},${source},${tx.json(JSON.parse(JSON.stringify(response)))})`;
  return response;
}
export async function handleV3(request: NextRequest, op: V3Operation, unified = false) {
  try {
    const source = sourceHashV3(request);
    await requestRateV3('source', source, 180);
    if (request.nextUrl.origin !== v3Origin || request.nextUrl.pathname !== (unified ? pathV3(op).replace('/api/toolbox/office-desktop/v3/','/api/toolbox/client/v1/office/') : pathV3(op))) throw new DesktopError('INVALID_REQUEST');
    const envelope = objectV3(await desktopBody(request, ['payload', 'signature']), ['payload', 'signature']);
    if (typeof envelope.payload !== 'string') throw new DesktopError('INVALID_REQUEST');
    const body = proofV3(envelope.payload, [...fields[op],'releaseId']), auth = request.headers.get('authorization');
    if (op === 'session' && auth || op !== 'session' && (!auth?.startsWith('Bearer ') || auth.length > 16007)) throw new DesktopError('SESSION_INVALID', 401);
    const bearer = auth?.slice(7) ?? '';
    const claims = op === 'session' ? null : readV3(bearer, op === 'start' || op === 'admission' ? 'office-v3-session' : op === 'commit' ? 'office-v3-start' : 'office-v3-permit', undefined, op === 'commit');
    if (claims && (claims.sub !== body.installationId || claims.appVersion !== body.appVersion)) throw new DesktopError('SESSION_INVALID', 401);
    const keyHash = op === 'session' ? hashV3(base64V3(body.publicKey)) : claims!.keyHash;
    if (op === 'session') verifyProofV3(pathV3(op), envelope.payload, body, envelope.signature, publicKeyV3(body.publicKey), bearer);
    else await transactionV3(body, keyHash, op, source, async tx => {
      const [device] = await tx<{ public_key: string }[]>`select public_key from chinatech_v2_private.office_v3_devices where installation_id=${body.installationId}`;
      if (!device) throw new DesktopError('DEVICE_PROOF_INVALID', 401);
      verifyProofV3(pathV3(op), envelope.payload as string, body, envelope.signature, publicKeyV3(device.public_key), bearer);
    });
    await requestRateV3('instance', hashV3('office-v3:instance:' + body.installationId + ':' + keyHash), 60);
    return officeResponse(NextResponse.json(await transactionV3(body, keyHash, op, source, tx => operationV3(tx, body, op, bearer, source, envelope.payload as string, envelope.signature))));
  } catch (error) { return desktopFailure(error); }
}
