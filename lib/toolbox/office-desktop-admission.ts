import 'server-only';
import type { TransactionSql } from 'postgres';
import { withDatabase, type AuthIdentity } from '@/lib/backend/database';
import { DesktopError, desktopUuid } from './office-desktop-token';
import { desktopVersion, compareDesktopVersions } from './office-desktop-public-token';
import { previousPublishedVersion, eligibleMinimumVersions } from './office-desktop-release-catalog';

export type DesktopAdmissionState = {
  enabled: boolean;
  revision: string;
  updatedAt: string | null;
  accountId: string;
  sessionId: string;
  minimumVersion: string;
  currentVersion: string;
  eligibleMinimumVersions: string[];
};
type AdmissionRow = { enabled: boolean; revision: string; updated_at: Date | null; minimum_version: string; release_ready: boolean; verified_version: string | null };

// Every new session and admission change takes this same transaction lock.
// Existing sessions/packages deliberately do not: pausing only controls new unlocks.
export async function lockDesktopAdmission(tx: TransactionSql) {
  await tx`select pg_advisory_xact_lock(hashtextextended('chinatech:office-desktop:admission:v1',413))`;
}
export async function readDesktopAdmission(tx: TransactionSql) {
  const [row] = await tx<AdmissionRow[]>`select enabled,revision::text as revision,updated_at,minimum_version,release_ready,verified_version from chinatech_v2_private.office_desktop_control where singleton`;
  if (!row) throw new DesktopError('SERVICE_UNAVAILABLE', 503);
  return row;
}
async function requireAdmin(tx: TransactionSql, identity: AuthIdentity) {
  const [row] = await tx<{ admin_user_id: string | null }[]>`select admin_user_id from chinatech_v2_private.office_command_control where singleton`;
  if (!row) throw new DesktopError('SERVICE_UNAVAILABLE', 503);
  if (row.admin_user_id !== identity.userId) throw new DesktopError('NO_ACCESS', 403);
}
function projection(row: AdmissionRow, identity: AuthIdentity): DesktopAdmissionState {
  const verified = row.release_ready && typeof row.verified_version === 'string' ? row.verified_version : null;
  return { enabled: row.enabled, revision: row.revision, updatedAt: row.updated_at?.toISOString() ?? null, accountId: identity.userId, sessionId: identity.sessionId, minimumVersion: row.minimum_version, currentVersion: verified ?? previousPublishedVersion, eligibleMinimumVersions: verified ? [...new Set([...eligibleMinimumVersions.filter(version => compareDesktopVersions(version, verified) <= 0), verified])] : ['0.0.0'] };
}
export async function getDesktopAdmission(identity: AuthIdentity): Promise<DesktopAdmissionState> {
  return withDatabase(identity, null, async tx => {
    await requireAdmin(tx, identity);
    return projection(await readDesktopAdmission(tx), identity);
  });
}
export async function changeDesktopAdmission(identity: AuthIdentity, body: Record<string, unknown>): Promise<DesktopAdmissionState> {
  const requestId = desktopUuid(body.requestId);
  if (typeof body.enabled !== 'boolean' || typeof body.expectedRevision !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(body.expectedRevision) || BigInt(body.expectedRevision) > BigInt('9223372036854775807')) throw new DesktopError('INVALID_REQUEST');
  const enabled = body.enabled, revision = body.expectedRevision;
  const requestedMinimum = body.minimumVersion === undefined ? null : desktopVersion(body.minimumVersion);
  return withDatabase(identity, null, async tx => {
    await requireAdmin(tx, identity);
    await lockDesktopAdmission(tx);
    const row = await readDesktopAdmission(tx);
    const [receipt] = await tx<{ actor_id: string; session_id: string; requested_enabled: boolean; expected_revision: string; requested_minimum_version: string | null }[]>`select actor_id,session_id,requested_enabled,expected_revision::text as expected_revision,requested_minimum_version from chinatech_v2_private.office_desktop_control_receipts where request_id=${requestId}`;
    if (receipt) {
      if (receipt.actor_id !== identity.userId || receipt.session_id !== identity.sessionId || receipt.requested_enabled !== enabled || receipt.expected_revision !== revision || receipt.requested_minimum_version !== requestedMinimum) throw new DesktopError('REQUEST_CONFLICT', 409);
      return projection(row, identity);
    }
    if (row.revision !== revision) throw new DesktopError('REQUEST_CONFLICT', 409);
    const minimum = requestedMinimum ?? row.minimum_version;
    if (!projection(row, identity).eligibleMinimumVersions.includes(minimum)) throw new DesktopError('VERSION_NOT_AVAILABLE', 400);
    let saved = row;
    if (row.enabled !== enabled || row.minimum_version !== minimum) {
      const [updated] = await tx<AdmissionRow[]>`update chinatech_v2_private.office_desktop_control set enabled=${enabled},minimum_version=${minimum},revision=revision+1,updated_at=now(),updated_by=${identity.userId} where singleton returning enabled,revision::text as revision,updated_at,minimum_version,release_ready,verified_version`;
      if (!updated) throw new DesktopError('NO_ACCESS', 403);
      saved = updated;
    }
    await tx`insert into chinatech_v2_private.office_desktop_control_receipts(request_id,actor_id,session_id,requested_enabled,expected_revision,requested_minimum_version) values(${requestId},${identity.userId},${identity.sessionId},${enabled},${revision},${requestedMinimum})`;
    return projection(saved, identity);
  });
}
