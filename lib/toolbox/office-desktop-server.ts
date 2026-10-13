import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { TransactionSql } from 'postgres';
import { NextRequest, NextResponse } from 'next/server';
import { BackendError, withDatabase, withOfficeDesktopDatabase, type AuthIdentity } from '@/lib/backend/database';
import { AuthRequestError, readAuthBody, requireSameOrigin } from '@/lib/supabase/server';
import { officeResponse } from './office-server';
import { DesktopError, desktopKey, desktopUuid, desktopAction, desktopActions, licenseHash, mintDesktopLicense, signDesktopSession, readDesktopSession, assertDesktopLicense, encryptDesktopPackage } from './office-desktop-token';
import type { OfficeAction } from './office-commands';
import { lockDesktopAdmission, readDesktopAdmission } from './office-desktop-admission';
import { openPublicDesktopSession, publicDesktopPackage } from './office-desktop-public';
import { isPublicDesktopToken } from './office-desktop-public-token';

type LicenseRow = { id: string; label: string; enabled: boolean; expires_at: Date; max_devices: number; actions: OfficeAction[]; revision: string; device_count?: number; key_hash: string };
type ControlRow = { enabled: boolean; epoch: string; admin_user_id: string | null };
function projection(l: LicenseRow) { return { id: l.id, label: l.label, enabled: l.enabled, expiresAt: l.expires_at.toISOString(), maxDevices: l.max_devices, actions: l.actions, revision: l.revision, deviceCount: l.device_count ?? 0 }; }
async function control(tx: TransactionSql) {
  const [row] = await tx<ControlRow[]>`select enabled,command_version::text as epoch,admin_user_id from chinatech_v2_private.office_command_control where singleton`;
  if (!row) throw new DesktopError('SERVICE_UNAVAILABLE', 503);
  return row;
}
async function admin(tx: TransactionSql, identity: AuthIdentity) {
  if ((await control(tx)).admin_user_id !== identity.userId) throw new DesktopError('NO_ACCESS', 403);
}
async function lockLicense(tx: TransactionSql, id: string) { await tx`select pg_advisory_xact_lock(hashtextextended(${id},413))`; }
async function readLicense(tx: TransactionSql, id?: string) {
  const rows = id ? await tx<LicenseRow[]>`select l.*,l.revision::text as revision,(select count(*)::integer from chinatech_v2_private.office_desktop_devices d where d.license_id=l.id) as device_count from chinatech_v2_private.office_desktop_licenses l where l.id=${id}` : await tx<LicenseRow[]>`select *,revision::text as revision from chinatech_v2_private.office_desktop_licenses`;
  if (rows.length !== 1) throw new DesktopError('KEY_INVALID', 403);
  return rows[0];
}
function available(l: LicenseRow, c: ControlRow) {
  if (!c.enabled) throw new DesktopError('TOOLBOX_DISABLED', 403);
  if (!l.enabled || l.expires_at.getTime() <= Date.now()) throw new DesktopError('KEY_INVALID', 403);
}
export async function desktopBody(request: NextRequest, fields: string[]) {
  if (request.headers.has('origin')) requireSameOrigin(request);
  if (request.nextUrl.search) throw new DesktopError('INVALID_REQUEST');
  return readAuthBody(request, fields);
}
export function desktopFailure(error: unknown) {
  // Never reflect database errors, keys, bearer tokens, request bodies or paths.
  const known = error instanceof DesktopError;
  const auth = error instanceof AuthRequestError || error instanceof BackendError;
  const conflict = typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
  if (!known && !auth) {
    const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' && /^[A-Z0-9]{5}$/.test(error.code) ? error.code : 'INTERNAL';
    console.error('[office-desktop]', code);
  }
  const status = known || auth ? error.status : conflict ? 409 : 503;
  const code = known ? error.code : status === 401 ? 'SESSION_EXPIRED' : status === 403 ? 'NO_ACCESS' : status === 409 ? 'REQUEST_CONFLICT' : status === 400 ? 'INVALID_REQUEST' : 'SERVICE_UNAVAILABLE';
  return officeResponse(NextResponse.json({ code }, { status }));
}
export async function openDesktopSession(body: Record<string, unknown>) {
  if (body.mode !== undefined) return openPublicDesktopSession(body);
  desktopKey();
  const keyHash = licenseHash(body.key), installationId = desktopUuid(body.installationId);
  if (typeof body.language !== 'string' || !['zh-CN', 'it', 'en'].includes(body.language)) throw new DesktopError('INVALID_REQUEST');
  return withOfficeDesktopDatabase(keyHash, installationId, async tx => {
    await lockDesktopAdmission(tx);
    const admission = await readDesktopAdmission(tx);
    if (admission.minimum_version !== '0.0.0') throw new DesktopError('UPDATE_REQUIRED', 426);
    if (!admission.enabled) throw new DesktopError('DESKTOP_PAUSED', 403);
    const first = await readLicense(tx); await lockLicense(tx, first.id);
    const l = await readLicense(tx, first.id), c = await control(tx); available(l, c);
    const devices = await tx<{ installation_id: string }[]>`select installation_id from chinatech_v2_private.office_desktop_devices where license_id=${l.id}`;
    if (!devices.some(d => d.installation_id === installationId)) {
      if (devices.length >= l.max_devices) throw new DesktopError('DEVICE_LIMIT', 403);
      await tx`insert into chinatech_v2_private.office_desktop_devices(license_id,installation_id) values(${l.id},${installationId})`;
    }
    const exp = Math.min(Date.now() + 3600000, l.expires_at.getTime());
    const sessionToken = signDesktopSession({ v: 1, licenseId: l.id, keyHash, installationId, revision: l.revision, epoch: c.epoch, exp });
    return { sessionToken, expiresAt: new Date(exp).toISOString(), actions: l.actions, licenseId: l.id, epoch: c.epoch };
  });
}
export async function desktopPackage(request: NextRequest, body: Record<string, unknown>) {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) throw new DesktopError('SESSION_INVALID', 401);
  const token = header.slice(7);
  if (isPublicDesktopToken(token)) return publicDesktopPackage(request, body, token);
  const session = readDesktopSession(token), action = desktopAction(body.action), id = desktopUuid(body.requestId);
  if (desktopUuid(request.headers.get('x-ct-installation-id')) !== session.installationId) throw new DesktopError('SESSION_INVALID', 401);
  const runner = await readFile(join(process.cwd(), 'server-assets/office-desktop/runner.ps1.txt'));
  return withOfficeDesktopDatabase(session.keyHash, session.installationId, async tx => {
    await lockLicense(tx, session.licenseId);
    readDesktopSession(token);
    const l = await readLicense(tx, session.licenseId), c = await control(tx); available(l, c);
    assertDesktopLicense({ enabled: l.enabled, expiresAt: l.expires_at.toISOString(), revision: l.revision, actions: l.actions }, session, c.epoch, action);
    const [device] = await tx`select installation_id from chinatech_v2_private.office_desktop_devices where license_id=${l.id} and installation_id=${session.installationId}`;
    if (!device) throw new DesktopError('SESSION_INVALID', 401);
    let [job] = await tx<{ license_id: string; installation_id: string; action: OfficeAction; epoch: string; license_revision: string; expires_at: Date }[]>`select *,epoch::text as epoch,license_revision::text as license_revision from chinatech_v2_private.office_desktop_jobs where id=${id}`;
    if (job) {
      if (job.license_id !== l.id || job.installation_id !== session.installationId || job.action !== action || job.epoch !== c.epoch || job.license_revision !== l.revision || job.expires_at.getTime() <= Date.now()) throw new DesktopError('REQUEST_CONFLICT', 409);
    } else {
      const expires = new Date(Math.min(Date.now() + 300000, session.exp));
      await tx`insert into chinatech_v2_private.office_desktop_jobs(id,license_id,installation_id,action,epoch,license_revision,expires_at) values(${id},${l.id},${session.installationId},${action},${c.epoch},${l.revision},${expires})`;
      job = { license_id: l.id, installation_id: session.installationId, action, epoch: c.epoch, license_revision: l.revision, expires_at: expires };
    }
    return encryptDesktopPackage(runner, token, action, c.epoch, id, job.expires_at.toISOString());
  });
}
function signingReady() { try { desktopKey(); return true; } catch { return false; } }
export async function getDesktopLicenses(identity: AuthIdentity) {
  return withDatabase(identity, null, async tx => {
    await admin(tx, identity);
    const rows = await tx<LicenseRow[]>`select l.*,l.revision::text as revision,(select count(*)::integer from chinatech_v2_private.office_desktop_devices d where d.license_id=l.id) as device_count from chinatech_v2_private.office_desktop_licenses l order by l.created_at desc limit 100`;
    const [count] = await tx<{ count: number }[]>`select count(*)::integer as count from chinatech_v2_private.office_desktop_licenses`;
    return { licenses: rows.map(projection), total: count.count, signingReady: signingReady(), accountId: identity.userId, sessionId: identity.sessionId };
  });
}
export async function createDesktopLicense(identity: AuthIdentity, body: Record<string, unknown>) {
  const id = desktopUuid(body.requestId), key = mintDesktopLicense(identity.userId, id), hash = licenseHash(key);
  if (typeof body.label !== 'string' || !body.label.trim() || body.label.trim().length > 80 || /[\u0000-\u001f]/.test(body.label) || typeof body.expiresAt !== 'string' || !Number.isInteger(body.maxDevices) || Number(body.maxDevices) < 1 || Number(body.maxDevices) > 100 || !Array.isArray(body.actions) || body.actions.length < 1 || body.actions.length > 4) throw new DesktopError('INVALID_REQUEST');
  const actions = [...new Set(body.actions.map(desktopAction))].sort();
  if (actions.length !== body.actions.length) throw new DesktopError('INVALID_REQUEST');
  const expires = new Date(body.expiresAt), label = body.label.trim(), max = Number(body.maxDevices);
  if (!Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now() || expires.getTime() > Date.now() + 366 * 86400000) throw new DesktopError('INVALID_REQUEST');
  return withDatabase(identity, null, async tx => {
    await admin(tx, identity); await lockLicense(tx, id);
    const [existing] = await tx<LicenseRow[]>`select l.*,l.revision::text as revision,(select count(*)::integer from chinatech_v2_private.office_desktop_devices d where d.license_id=l.id) as device_count from chinatech_v2_private.office_desktop_licenses l where l.id=${id}`;
    if (existing) {
      if (existing.key_hash !== hash || existing.label !== label || existing.expires_at.getTime() !== expires.getTime() || existing.max_devices !== max || [...existing.actions].sort().join() !== actions.join()) throw new DesktopError('REQUEST_CONFLICT', 409);
      return { license: projection(existing), key, accountId: identity.userId, sessionId: identity.sessionId };
    }
    const [created] = await tx<LicenseRow[]>`insert into chinatech_v2_private.office_desktop_licenses(id,key_hash,label,expires_at,max_devices,actions,created_by,updated_by) values(${id},${hash},${label},${expires},${max},${tx.array(actions)},${identity.userId},${identity.userId}) returning *,revision::text as revision`;
    return { license: projection(created), key, accountId: identity.userId, sessionId: identity.sessionId };
  });
}
export async function changeDesktopLicense(identity: AuthIdentity, body: Record<string, unknown>) {
  const id = desktopUuid(body.licenseId), requestId = desktopUuid(body.requestId);
  if (typeof body.enabled !== 'boolean' || typeof body.expectedRevision !== 'string' || !/^[1-9][0-9]{0,18}$/.test(body.expectedRevision)) throw new DesktopError('INVALID_REQUEST');
  const enabled = body.enabled, revision = body.expectedRevision;
  const fingerprint = createHash('sha256').update(JSON.stringify([id, enabled, revision])).digest('hex');
  return withDatabase(identity, null, async tx => {
    await admin(tx, identity); await lockLicense(tx, id);
    const l = await readLicense(tx, id);
    const [receipt] = await tx<{ fingerprint: string; session_id: string }[]>`select fingerprint,session_id from chinatech_v2_private.office_desktop_receipts where id=${requestId}`;
    if (receipt) {
      if (receipt.fingerprint !== fingerprint || receipt.session_id !== identity.sessionId) throw new DesktopError('REQUEST_CONFLICT', 409);
      return { license: projection(l), accountId: identity.userId, sessionId: identity.sessionId };
    }
    if (l.revision !== revision) throw new DesktopError('REQUEST_CONFLICT', 409);
    let changed = l;
    if (l.enabled !== enabled) {
      const [saved] = await tx<LicenseRow[]>`update chinatech_v2_private.office_desktop_licenses set enabled=${enabled},revision=revision+1,updated_by=${identity.userId},updated_at=now() where id=${id} returning *,revision::text as revision`;
      changed = { ...saved, device_count: l.device_count };
    }
    await tx`insert into chinatech_v2_private.office_desktop_receipts(id,actor_id,session_id,fingerprint) values(${requestId},${identity.userId},${identity.sessionId},${fingerprint})`;
    return { license: projection(changed), accountId: identity.userId, sessionId: identity.sessionId };
  });
}

export { desktopActions };
