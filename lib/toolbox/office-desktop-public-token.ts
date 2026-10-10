import { createHmac, timingSafeEqual } from 'node:crypto';
import { DesktopError, desktopKey, desktopUuid } from './office-desktop-token';

export function desktopVersion(value: unknown): string {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})$/.test(value) || value.split('.').some(part => Number(part) > 65535)) throw new DesktopError('INVALID_REQUEST');
  return value;
}
export function compareDesktopVersions(left: string, right: string): number {
  const a = desktopVersion(left).split('.').map(Number), b = desktopVersion(right).split('.').map(Number);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  return 0;
}
export type PublicDesktopSession = { v: 2; mode: 'public'; grantId: string; installationId: string; appVersion: string; epoch: string; exp: number };
function mac(value: string, key: Buffer) { return createHmac('sha256', key).update('chinatech:office-desktop:session:v2\0' + value).digest(); }
export function signPublicDesktopSession(payload: PublicDesktopSession, key = desktopKey()): string {
  const value = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return value + '.' + mac(value, key).toString('base64url');
}
export function readPublicDesktopSession(token: unknown, key = desktopKey(), now = Date.now()): PublicDesktopSession {
  if (typeof token !== 'string' || token.length > 1500) throw new DesktopError('SESSION_INVALID', 401);
  const [value, signature, extra] = token.split('.');
  if (!value || !signature || extra || !/^[A-Za-z0-9_-]+$/.test(value) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) throw new DesktopError('SESSION_INVALID', 401);
  const actual = Buffer.from(signature, 'base64url'), expected = mac(value, key);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || actual.toString('base64url') !== signature) throw new DesktopError('SESSION_INVALID', 401);
  let payload: PublicDesktopSession;
  try {
    if (Buffer.from(value, 'base64url').toString('base64url') !== value) throw new Error();
    payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (Object.keys(payload).sort().join(',') !== 'appVersion,epoch,exp,grantId,installationId,mode,v' || payload.v !== 2 || payload.mode !== 'public' || desktopUuid(payload.grantId) !== payload.grantId || desktopUuid(payload.installationId) !== payload.installationId || desktopVersion(payload.appVersion) !== payload.appVersion || typeof payload.epoch !== 'string' || !/^[1-9][0-9]{0,18}$/.test(payload.epoch) || !Number.isSafeInteger(payload.exp)) throw new Error();
  } catch { throw new DesktopError('SESSION_INVALID', 401); }
  if (payload.exp <= now || payload.exp > now + 3600000) throw new DesktopError('SESSION_EXPIRED', 401);
  return payload;
}
// This is only a dispatch hint. The chosen reader always verifies its own MAC and schema.
export function isPublicDesktopToken(token: string): boolean {
  if (token.length > 1500) throw new DesktopError('SESSION_INVALID', 401);
  try { return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')).v === 2; }
  catch { throw new DesktopError('SESSION_INVALID', 401); }
}
