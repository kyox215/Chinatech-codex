import { createHash, createHmac, randomBytes, timingSafeEqual, createCipheriv } from 'node:crypto';
import type { OfficeAction } from './office-commands';

export const desktopActions: OfficeAction[] = ['install', 'activate', 'uninstall', 'reinstall'];
export class DesktopError extends Error {
  constructor(readonly code: string, readonly status = 400) { super(code); }
}
export function desktopKey(value = process.env.OFFICE_DESKTOP_SIGNING_KEY): Buffer {
  if (!value || !/^[a-f0-9]{64}$/.test(value)) throw new DesktopError('SERVICE_UNAVAILABLE', 503);
  return Buffer.from(value, 'hex');
}
export function desktopUuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) throw new DesktopError('INVALID_REQUEST');
  return value.toLowerCase();
}
export function desktopAction(value: unknown): OfficeAction {
  if (typeof value !== 'string' || !desktopActions.includes(value as OfficeAction)) throw new DesktopError('INVALID_REQUEST');
  return value as OfficeAction;
}
export function licenseHash(value: unknown): string {
  if (typeof value !== 'string' || !/^CTO-[A-Za-z0-9_-]{43}$/.test(value.trim())) throw new DesktopError('KEY_INVALID', 403);
  return createHash('sha256').update(value.trim()).digest('hex');
}
export function mintDesktopLicense(actorId: string, requestId: string, key = desktopKey()): string {
  return 'CTO-' + createHmac('sha256', key).update('chinatech:office-desktop:license:v1\0' + actorId + ':' + requestId).digest('base64url');
}
export type DesktopSession = { v: 1; licenseId: string; keyHash: string; installationId: string; revision: string; epoch: string; exp: number };
function mac(value: string, key: Buffer) { return createHmac('sha256', key).update('chinatech:office-desktop:session:v1\0' + value).digest(); }
export function signDesktopSession(payload: DesktopSession, key = desktopKey()): string {
  const value = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return value + '.' + mac(value, key).toString('base64url');
}
export function readDesktopSession(token: unknown, key = desktopKey(), now = Date.now()): DesktopSession {
  if (typeof token !== 'string' || token.length > 1500) throw new DesktopError('SESSION_INVALID', 401);
  const [value, signature, extra] = token.split('.');
  if (!value || !signature || extra || !/^[A-Za-z0-9_-]+$/.test(value) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) throw new DesktopError('SESSION_INVALID', 401);
  const actual = Buffer.from(signature, 'base64url'), expected = mac(value, key);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || actual.toString('base64url') !== signature) throw new DesktopError('SESSION_INVALID', 401);
  let p: DesktopSession;
  try {
    if (Buffer.from(value, 'base64url').toString('base64url') !== value) throw new Error();
    p = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (Object.keys(p).sort().join(',') !== 'epoch,exp,installationId,keyHash,licenseId,revision,v' || p.v !== 1 || !/^[a-f0-9]{64}$/.test(p.keyHash) || desktopUuid(p.licenseId) !== p.licenseId || desktopUuid(p.installationId) !== p.installationId || typeof p.revision !== 'string' || !/^[1-9][0-9]{0,18}$/.test(p.revision) || typeof p.epoch !== 'string' || !/^[1-9][0-9]{0,18}$/.test(p.epoch) || !Number.isSafeInteger(p.exp)) throw new Error();
  } catch { throw new DesktopError('SESSION_INVALID', 401); }
  if (p.exp <= now || p.exp > now + 3600000) throw new DesktopError('SESSION_EXPIRED', 401);
  return p;
}
export function assertDesktopLicense(license: { enabled: boolean; expiresAt: string; revision: string; actions: OfficeAction[] }, session: DesktopSession, epoch: string, action?: OfficeAction, now = Date.now()) {
  if (!license.enabled || !Number.isFinite(Date.parse(license.expiresAt)) || Date.parse(license.expiresAt) <= now) throw new DesktopError('KEY_INVALID', 403);
  if (license.revision !== session.revision || epoch !== session.epoch) throw new DesktopError('SESSION_REVOKED', 401);
  if (action && !license.actions.includes(action)) throw new DesktopError('ACTION_NOT_ALLOWED', 403);
}
export function encryptDesktopPackage(body: Buffer, token: string, action: OfficeAction, version: string, jobId: string, expiresAt: string) {
  const digest = createHash('sha256').update(body).digest('hex'), nonce = randomBytes(12);
  const key = createHash('sha256').update('chinatech-office-desktop:payload:v1\0' + token).digest();
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(JSON.stringify([1, action, version, digest, expiresAt, jobId])));
  const ciphertext = Buffer.concat([cipher.update(body), cipher.final()]);
  return { v: 1 as const, action, version, digest, expiresAt, jobId, nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
}
