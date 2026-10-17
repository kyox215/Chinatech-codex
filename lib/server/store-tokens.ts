import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

function digest(purpose: string, payload: string) {
  const secret = process.env.STORE_ADMISSION_SIGNING_KEY;
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) throw new Error('认证服务暂不可用。');
  return createHmac('sha256', Buffer.from(secret, 'hex')).update('chinatech:' + purpose + ':v1\0').update(payload).digest('base64url');
}

export function signStoreValue(purpose: string, value: unknown) {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return payload + '.' + digest(purpose, payload);
}

export function readStoreValue(purpose: string, value: unknown): unknown {
  if (typeof value !== 'string' || value.length > 4096) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) return null;
  const expected = Buffer.from(digest(purpose, payload)), actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
}
