import 'server-only';
import type { TransactionSql } from 'postgres';
import { withDatabase, type AuthIdentity } from '@/lib/backend/database';
import { DesktopError, desktopUuid } from './office-desktop-token';
import { desktopVersion, compareDesktopVersions } from './office-desktop-public-token';
import { hashV3, signingReadyV3 } from './office-desktop-v3-token';
import { lockV3 } from './office-desktop-v3-database';

type Row = { enabled: boolean; minimum_version: string; release_ready: boolean; verified_version: string | null; revision: string; updated_at: Date | null };
async function adminV3(tx: TransactionSql, identity: AuthIdentity) {
  const [row] = await tx<{ admin_user_id: string | null }[]>`select admin_user_id from chinatech_v2_private.office_command_control where singleton`;
  if (!row || row.admin_user_id !== identity.userId) throw new DesktopError('NO_ACCESS', 403);
}
async function rowV3(tx: TransactionSql) {
  const [row] = await tx<Row[]>`select enabled,minimum_version,release_ready,verified_version,revision::text,updated_at from chinatech_v2_private.office_v3_control where singleton`;
  if (!row) throw new DesktopError('SERVICE_UNAVAILABLE', 503);
  return row;
}
function projectionV3(row: Row, identity: AuthIdentity) {
  return { enabled: row.enabled, minimumVersion: row.minimum_version, currentVersion: row.release_ready ? row.verified_version : null, releaseReady: row.release_ready, signingReady: signingReadyV3(), revision: row.revision, updatedAt: row.updated_at?.toISOString() ?? null, accountId: identity.userId, sessionId: identity.sessionId, eligibleMinimumVersions: row.release_ready && row.verified_version ? [...new Set(['1.4.0', row.minimum_version, row.verified_version])] : [row.minimum_version] };
}
export async function getAdminV3(identity: AuthIdentity) {
  return withDatabase(identity, null, async tx => { await adminV3(tx, identity); return projectionV3(await rowV3(tx), identity); });
}
export async function getJobsV3(identity: AuthIdentity) {
  return withDatabase(identity, null, async tx => {
    await adminV3(tx, identity);
    const rows = await tx<{ job_id: string; action: string; status: string; app_version: string; architecture: string; created_at: Date; started_at: Date | null; updated_at: Date }[]>`
      with recent as (
        select job_id,action,app_version,architecture,created_at,start_before
        from chinatech_v2_private.office_v3_intents order by created_at desc,job_id desc limit 20
      )
      select i.job_id,i.action,i.app_version,i.architecture,i.created_at,c.created_at as started_at,
        coalesce(o.status,case when c.job_id is not null then 'started' when i.start_before<=now() then 'expired' else 'prepared' end) as status,
        coalesce(o.created_at,c.created_at,i.created_at) as updated_at
      from recent i left join chinatech_v2_private.office_v3_commits c on c.job_id=i.job_id
      left join lateral (select status,created_at from chinatech_v2_private.office_v3_outcomes where job_id=i.job_id order by (status='completed') desc,sequence desc limit 1) o on true
      order by i.created_at desc,i.job_id desc`;
    return { jobs: rows.map(row => ({ jobId: row.job_id, action: row.action, status: row.status, appVersion: row.app_version, architecture: row.architecture, createdAt: row.created_at.toISOString(), startedAt: row.started_at?.toISOString() ?? null, updatedAt: row.updated_at.toISOString() })) };
  });
}
export async function changeAdminV3(identity: AuthIdentity, body: Record<string, unknown>) {
  const requestId = desktopUuid(body.requestId), minimum = desktopVersion(body.minimumVersion);
  if (typeof body.enabled !== 'boolean' || typeof body.expectedRevision !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(body.expectedRevision) || BigInt(body.expectedRevision) > BigInt('9223372036854775807')) throw new DesktopError('INVALID_REQUEST');
  const enabled = body.enabled, revision = body.expectedRevision, fingerprint = hashV3(JSON.stringify([enabled, minimum, revision]));
  return withDatabase(identity, null, async tx => {
    await adminV3(tx, identity); await lockV3(tx, 'control');
    const row = await rowV3(tx);
    const [receipt] = await tx<{ fingerprint: string; actor_id: string; session_id: string }[]>`select fingerprint,actor_id,session_id from chinatech_v2_private.office_v3_admin_receipts where request_id=${requestId}`;
    if (receipt) {
      if (receipt.fingerprint !== fingerprint || receipt.actor_id !== identity.userId || receipt.session_id !== identity.sessionId) throw new DesktopError('REQUEST_CONFLICT', 409);
      return projectionV3(row, identity);
    }
    if (row.revision !== revision) throw new DesktopError('REQUEST_CONFLICT', 409);
    if (!projectionV3(row, identity).eligibleMinimumVersions.includes(minimum) || compareDesktopVersions(minimum, '1.4.0') < 0) throw new DesktopError('VERSION_NOT_AVAILABLE');
    if (enabled && (!row.release_ready || !row.verified_version || !signingReadyV3())) throw new DesktopError('SERVICE_UNAVAILABLE', 503);
    let saved = row;
    if (row.enabled !== enabled || row.minimum_version !== minimum) {
      const [updated] = await tx<Row[]>`update chinatech_v2_private.office_v3_control set enabled=${enabled},minimum_version=${minimum},revision=revision+1,updated_by=${identity.userId},updated_at=now() where singleton returning enabled,minimum_version,release_ready,verified_version,revision::text,updated_at`;
      if (!updated) throw new DesktopError('NO_ACCESS', 403);
      saved = updated;
    }
    await tx`insert into chinatech_v2_private.office_v3_admin_receipts(request_id,actor_id,session_id,fingerprint) values(${requestId},${identity.userId},${identity.sessionId},${fingerprint})`;
    return projectionV3(saved, identity);
  });
}
