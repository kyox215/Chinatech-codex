import 'server-only';
import type { TransactionSql } from 'postgres';
import type { NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withOfficePublicDatabase } from '@/lib/backend/database';
import { DesktopError, desktopKey, desktopUuid, desktopAction, desktopActions, encryptDesktopPackage } from './office-desktop-token';
import { lockDesktopAdmission, readDesktopAdmission } from './office-desktop-admission';
import { currentVersion } from './office-desktop-release-catalog';
import { desktopVersion, compareDesktopVersions, readPublicDesktopSession, signPublicDesktopSession } from './office-desktop-public-token';
import type { OfficeAction } from './office-commands';

type GrantRow = { id: string; installation_id: string; app_version: string; actions: OfficeAction[]; epoch: string; expires_at: Date };
async function lockGrant(tx: TransactionSql, id: string) { await tx`select pg_advisory_xact_lock(hashtextextended(${id},714))`; }
async function globalControl(tx: TransactionSql) {
  const [row] = await tx<{ enabled: boolean; epoch: string }[]>`select enabled,command_version::text as epoch from chinatech_v2_private.office_command_control where singleton`;
  if (!row) throw new DesktopError('SERVICE_UNAVAILABLE', 503);
  if (!row.enabled) throw new DesktopError('TOOLBOX_DISABLED', 403);
  return row;
}
function projection(grant: GrantRow) {
  const sessionToken = signPublicDesktopSession({ v: 2, mode: 'public', grantId: grant.id, installationId: grant.installation_id, appVersion: grant.app_version, epoch: grant.epoch, exp: grant.expires_at.getTime() });
  return { sessionToken, expiresAt: grant.expires_at.toISOString(), actions: grant.actions, grantId: grant.id, epoch: grant.epoch };
}
export async function openPublicDesktopSession(body: Record<string, unknown>) {
  desktopKey();
  if (body.mode !== 'public' || typeof body.language !== 'string' || !['zh-CN', 'it', 'en'].includes(body.language) || Object.hasOwn(body, 'key')) throw new DesktopError('INVALID_REQUEST');
  const id = desktopUuid(body.requestId), installation = desktopUuid(body.installationId), version = desktopVersion(body.appVersion);
  return withOfficePublicDatabase(id, installation, true, async tx => {
    await lockDesktopAdmission(tx); await lockGrant(tx, id);
    const [existing] = await tx<GrantRow[]>`select id,installation_id,app_version,actions,epoch::text as epoch,expires_at from chinatech_v2_private.office_desktop_public_grants where id=${id}`;
    const global = await globalControl(tx);
    if (existing) {
      if (existing.installation_id !== installation || existing.app_version !== version) throw new DesktopError('REQUEST_CONFLICT', 409);
      if (existing.expires_at.getTime() <= Date.now()) throw new DesktopError('SESSION_EXPIRED', 401);
      if (existing.epoch !== global.epoch) throw new DesktopError('SESSION_REVOKED', 401);
      return projection(existing);
    }
    const admission = await readDesktopAdmission(tx);
    if (compareDesktopVersions(version, currentVersion) > 0) throw new DesktopError('CLIENT_UNSUPPORTED', 426);
    if (compareDesktopVersions(version, admission.minimum_version) < 0) throw new DesktopError('UPDATE_REQUIRED', 426);
    if (!admission.enabled) throw new DesktopError('DESKTOP_PAUSED', 403);
    // Admission's shared transaction lock serializes this count and insert across
    // every issuance. Read committed sees the previous committed registration.
    const [rate] = await tx<{ count: number }[]>`select count(*)::integer as count from chinatech_v2_private.office_desktop_public_grants where installation_id=${installation} and created_at>now()-interval '1 minute'`;
    if (rate.count >= 10) throw new DesktopError('RATE_LIMITED', 429);
    const issued = new Date(), expires = new Date(issued.getTime() + 3600000);
    const [created] = await tx<GrantRow[]>`insert into chinatech_v2_private.office_desktop_public_grants(id,installation_id,app_version,actions,epoch,expires_at,created_at) values(${id},${installation},${version},${tx.array(desktopActions)},${global.epoch},${expires},${issued}) returning id,installation_id,app_version,actions,epoch::text as epoch,expires_at`;
    return projection(created);
  });
}
export async function publicDesktopPackage(request: NextRequest, body: Record<string, unknown>, token: string) {
  const session = readPublicDesktopSession(token), action = desktopAction(body.action), id = desktopUuid(body.requestId);
  if (desktopUuid(request.headers.get('x-ct-installation-id')) !== session.installationId) throw new DesktopError('SESSION_INVALID', 401);
  const runner = await readFile(join(process.cwd(), 'server-assets/office-desktop/runner.ps1.txt'));
  return withOfficePublicDatabase(session.grantId, session.installationId, false, async tx => {
    await lockGrant(tx, session.grantId); readPublicDesktopSession(token);
    const [grant] = await tx<GrantRow[]>`select id,installation_id,app_version,actions,epoch::text as epoch,expires_at from chinatech_v2_private.office_desktop_public_grants where id=${session.grantId}`;
    if (!grant || grant.installation_id !== session.installationId || grant.app_version !== session.appVersion || grant.expires_at.getTime() !== session.exp) throw new DesktopError('SESSION_INVALID', 401);
    if (grant.expires_at.getTime() <= Date.now()) throw new DesktopError('SESSION_EXPIRED', 401);
    const global = await globalControl(tx);
    if (grant.epoch !== session.epoch || global.epoch !== session.epoch) throw new DesktopError('SESSION_REVOKED', 401);
    if (!grant.actions.includes(action)) throw new DesktopError('ACTION_NOT_ALLOWED', 403);
    let [job] = await tx<{ grant_id: string; installation_id: string; action: OfficeAction; epoch: string; expires_at: Date }[]>`select grant_id,installation_id,action,epoch::text as epoch,expires_at from chinatech_v2_private.office_desktop_public_jobs where id=${id}`;
    if (job) {
      if (job.grant_id !== grant.id || job.installation_id !== session.installationId || job.action !== action || job.epoch !== session.epoch || job.expires_at.getTime() <= Date.now()) throw new DesktopError('REQUEST_CONFLICT', 409);
    } else {
      const issued = new Date(), expires = new Date(Math.min(issued.getTime() + 300000, session.exp));
      await tx`insert into chinatech_v2_private.office_desktop_public_jobs(id,grant_id,installation_id,action,epoch,expires_at,created_at) values(${id},${grant.id},${session.installationId},${action},${session.epoch},${expires},${issued})`;
      job = { grant_id: grant.id, installation_id: session.installationId, action, epoch: session.epoch, expires_at: expires };
    }
    return encryptDesktopPackage(runner, token, action, session.epoch, id, job.expires_at.toISOString());
  });
}
