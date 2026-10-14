import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import { desktopUuid, DesktopError } from './office-desktop-token';
import { desktopVersion } from './office-desktop-public-token';

export const v3Origin = 'https://www.chinatech.in';
export const v3Actions = ['install', 'activate', 'uninstall', 'close', 'reinstall'] as const;
export const v3Components = ['Access', 'Excel', 'OneDrive', 'OneNote', 'Outlook', 'PowerPoint', 'Lync', 'Word'];
export const v3Stages = ['Detect', 'Download', 'Remove', 'Install', 'Components', 'Activate', 'Finished', 'CloseApps', 'RestoreApps'] as const;
export function activityV3(stage: unknown, errorCode: unknown) {
  if (!v3Stages.includes(stage as typeof v3Stages[number]) || !(errorCode === null || typeof errorCode === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(errorCode))) throw new DesktopError('INVALID_REQUEST');
  return { stage: stage as typeof v3Stages[number], errorCode: errorCode as string | null };
}
export const v3Prefix = '/api/toolbox/office-desktop/v3/';
export const pathV3 = (operation: string) => v3Prefix + (['session', 'admission'].includes(operation) ? '' : 'jobs/') + operation;
export const hashV3 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export type V3Plan = { target: 'LTSC2024'; bitness: 64; language: string; components: string[]; server: string; expectedFingerprint: string; removalMode: 'selected' | 'all'; removalTargets: string[]; mediaVersion: string };
export type V3Proof = { requestId: string; installationId: string; appVersion: string; timestamp: number; nonce: string; [key: string]: unknown };
export type V3Claims = { v: 3; iss: string; aud: 'office-v3-session' | 'office-v3-admission' | 'office-v3-start' | 'office-v3-permit'; sub: string; keyHash: string; appVersion: string; iat: number; exp: number; jti: string; jobId?: string; action?: string; architecture?: string; plan?: V3Plan; planHash?: string; controlRevision?: string; admissionMode?: 'public' | 'candidate'; grantId?: string; grantRevision?: string; actions?: string[] };
export function objectV3(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) throw new DesktopError('INVALID_REQUEST');
  return value as Record<string, unknown>;
}
export function base64V3(value: unknown, length?: number): Buffer {
  if (typeof value !== 'string' || value.length > 12000 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new DesktopError('INVALID_REQUEST');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.toString('base64url') !== value || (length !== undefined && bytes.length !== length)) throw new DesktopError('INVALID_REQUEST');
  return bytes;
}
export function publicKeyV3(value: unknown): KeyObject {
  try {
    const bytes = base64V3(value);
    if (bytes.length !== 91) throw new Error();
    const key = createPublicKey({ key: bytes, format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1' || !key.export({ format: 'der', type: 'spki' }).equals(bytes)) throw new Error();
    return key;
  } catch { throw new DesktopError('DEVICE_PROOF_INVALID', 401); }
}
export function proofV3(payload: string, fields: readonly string[], now = Math.floor(Date.now() / 1000)): V3Proof {
  const bytes = base64V3(payload);
  let body: Record<string, unknown>;
  try { body = objectV3(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), ['requestId', 'installationId', 'appVersion', 'timestamp', 'nonce', ...fields]); }
  catch { throw new DesktopError('INVALID_REQUEST'); }
  if (desktopUuid(body.requestId) !== body.requestId || desktopUuid(body.installationId) !== body.installationId || desktopVersion(body.appVersion) !== body.appVersion || !Number.isSafeInteger(body.timestamp) || Math.abs(Number(body.timestamp) - now) > 300) throw new DesktopError('DEVICE_PROOF_EXPIRED', 401);
  base64V3(body.nonce, 32);
  return body as V3Proof;
}
export function canonicalV3(path: string, payload: string, body: V3Proof, bearer = ''): string {
  return ['CT-OFFICE-V3', 'POST', path, body.requestId, body.installationId, String(body.timestamp), body.nonce, hashV3(base64V3(payload)), hashV3(bearer)].join('\n');
}
export function verifyProofV3(path: string, payload: string, body: V3Proof, signature: unknown, key: KeyObject, bearer = '') {
  let valid = false;
  try { valid = verify('sha256', Buffer.from(canonicalV3(path, payload, body, bearer)), { key, dsaEncoding: 'ieee-p1363' }, base64V3(signature, 64)); } catch { /* fail closed */ }
  if (!valid) throw new DesktopError('DEVICE_PROOF_INVALID', 401);
}
export function planV3(value: unknown, action: string): V3Plan {
  const p = objectV3(value, ['target', 'bitness', 'language', 'components', 'server', 'expectedFingerprint', 'removalMode', 'removalTargets', 'mediaVersion']);
  if (p.target !== 'LTSC2024' || p.bitness !== 64 || !['zh-cn', 'it-it', 'en-us'].includes(String(p.language)) || !Array.isArray(p.components) || p.components.length > 8 || p.components.some(item => typeof item !== 'string' || !v3Components.includes(item)) || new Set(p.components).size !== p.components.length || !['selected', 'all'].includes(String(p.removalMode)) || !Array.isArray(p.removalTargets) || p.removalTargets.length > 512 || new Set(p.removalTargets).size !== p.removalTargets.length) throw new DesktopError('PLAN_INVALID');
  if (p.removalTargets.some(item => typeof item !== 'string' || item.length > 160 || !(/^(?:c2r-product:[A-Za-z][A-Za-z0-9]{1,100}|c2r-app:ProPlus2024Volume:(?:Access|Excel|OneNote|Outlook|PowerPoint|Word)|onedrive:(?:user|machine):[A-F0-9]{64})$/.test(item) || /^msi:\{[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}\}$/.test(item) && !item.includes('00000000-0000-0000-0000-000000000000')))) throw new DesktopError('PLAN_INVALID');
  if (typeof p.expectedFingerprint !== 'string' || !/^[a-fA-F0-9]{64}$/.test(p.expectedFingerprint)) throw new DesktopError('PLAN_INVALID');
  if (typeof p.server !== 'string' || p.server.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*kms\.cx(?::[0-9]{1,5})?$|^k\.302\.pub(?::[0-9]{1,5})?$/i.test(p.server)) throw new DesktopError('PLAN_INVALID');
  const port = p.server.split(':')[1]; if (port && (Number(port) < 1 || Number(port) > 65535)) throw new DesktopError('PLAN_INVALID');
  if (['install', 'reinstall'].includes(action) && p.components.length === 0 || action === 'uninstall' && p.removalTargets.length === 0) throw new DesktopError('PLAN_INVALID');
  if (action === 'uninstall' && p.removalTargets.some(target => target.startsWith('c2r-app:')) && p.mediaVersion === '') throw new DesktopError('PLAN_INVALID');
  if (typeof p.mediaVersion !== 'string' || (p.mediaVersion === '' ? ['install', 'reinstall'].includes(action) && p.components.some(component => component !== 'OneDrive')
    : !/^16\.0\.(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})$/.test(p.mediaVersion) || p.mediaVersion.split('.').slice(2).some(part => Number(part) > 65535))) throw new DesktopError('PLAN_INVALID');
  return { target: 'LTSC2024', bitness: 64, language: String(p.language), components: [...p.components].sort(), server: p.server.toLowerCase(), expectedFingerprint: p.expectedFingerprint.toLowerCase(), removalTargets: [...p.removalTargets].sort(), removalMode: p.removalMode as 'selected' | 'all', mediaVersion: p.mediaVersion };
}
function signingV3() {
  try {
    const kid = process.env.OFFICE_DESKTOP_V3_KID, pem = process.env.OFFICE_DESKTOP_V3_PRIVATE_KEY;
    if (!kid || !/^[A-Za-z0-9_-]{1,64}$/.test(kid) || !pem?.startsWith('-----BEGIN PRIVATE KEY-----')) throw new Error();
    const key = createPrivateKey(pem);
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error();
    return { key, kid };
  } catch { throw new DesktopError('SERVICE_UNAVAILABLE', 503); }
}
export function signV3(claims: V3Claims): string {
  const { key, kid } = signingV3();
  const input = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid })).toString('base64url') + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url');
  return input + '.' + sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
}
export function signingReadyV3(): boolean { try { publicKeysV3(); return true; } catch { return false; } }
// Metadata is descriptive. Clients continue to verify with their embedded
// keyring; an advertised key must never become a new root of trust.
export function publicKeysV3() {
  const current = signingV3();
  const ring: Record<string, string> = process.env.OFFICE_DESKTOP_V3_PUBLIC_KEYS ? JSON.parse(process.env.OFFICE_DESKTOP_V3_PUBLIC_KEYS) : {};
  if (!ring || typeof ring !== 'object' || Array.isArray(ring) || Object.keys(ring).length > 16) throw new DesktopError('SERVICE_UNAVAILABLE', 503);
  const keys = new Map<string, KeyObject>();
  for (const [kid, pem] of Object.entries(ring)) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(kid) || typeof pem !== 'string') throw new DesktopError('SERVICE_UNAVAILABLE', 503);
    const key = createPublicKey(pem);
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new DesktopError('SERVICE_UNAVAILABLE', 503);
    keys.set(kid, key);
  }
  const currentPublic = createPublicKey(current.key);
  if (keys.has(current.kid) && !keys.get(current.kid)!.export({ format: 'der', type: 'spki' }).equals(currentPublic.export({ format: 'der', type: 'spki' }))) throw new DesktopError('SERVICE_UNAVAILABLE', 503);
  keys.set(current.kid, currentPublic);
  return [...keys.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([kid, key]) => {
    const spki = key.export({ format: 'der', type: 'spki' }) as Buffer;
    return { kid, algorithm: 'ES256', publicKey: spki.toString('base64url'), sha256: hashV3(spki), current: kid === current.kid };
  });
}
export function signedUpdateV3(metadata: Record<string, unknown>) {
  const { key, kid } = signingV3();
  const payload = Buffer.from(JSON.stringify(metadata)).toString('base64url');
  const signature = sign('sha256', Buffer.from('CT-OFFICE-V3-UPDATE\n' + payload), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return { payload, signature, kid, algorithm: 'ES256' };
}
export function readV3(token: string, audience: V3Claims['aud'], now = Math.floor(Date.now() / 1000), allowExpired = false): V3Claims {
  try {
    if (token.length > 16000) throw new Error();
    const [header, payload, signature, extra] = token.split('.'); if (extra) throw new Error();
    const h = objectV3(JSON.parse(base64V3(header).toString('utf8')), ['alg', 'typ', 'kid']);
    const current = signingV3();
    const ring = process.env.OFFICE_DESKTOP_V3_PUBLIC_KEYS ? JSON.parse(process.env.OFFICE_DESKTOP_V3_PUBLIC_KEYS) as Record<string, string> : {};
    const key = h.kid === current.kid ? createPublicKey(current.key) : typeof h.kid === 'string' && Object.hasOwn(ring, h.kid) ? createPublicKey(ring[h.kid]) : null;
    if (h.alg !== 'ES256' || h.typ !== 'JWT' || !key || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1' || !verify('sha256', Buffer.from(header + '.' + payload), { key, dsaEncoding: 'ieee-p1363' }, base64V3(signature, 64))) throw new Error();
    const p = objectV3(JSON.parse(base64V3(payload).toString('utf8')), ['v', 'iss', 'aud', 'sub', 'keyHash', 'appVersion', 'iat', 'exp', 'jti', 'jobId', 'action', 'architecture', 'plan', 'planHash', 'controlRevision', 'admissionMode', 'grantId', 'grantRevision', 'actions']);
    if (p.v !== 3 || p.iss !== v3Origin || p.aud !== audience || desktopUuid(p.sub) !== p.sub || desktopUuid(p.jti) !== p.jti || typeof p.keyHash !== 'string' || !/^[a-f0-9]{64}$/.test(p.keyHash) || desktopVersion(p.appVersion) !== p.appVersion || !Number.isSafeInteger(p.iat) || !Number.isSafeInteger(p.exp) || Number(p.iat) > now + 300 || (!allowExpired && Number(p.exp) <= now) || Number(p.exp) <= Number(p.iat)) throw new Error();
    if (audience === 'office-v3-admission') {
      if (!['candidate', 'public'].includes(String(p.admissionMode)) || !['win-x64', 'win-arm64'].includes(String(p.architecture))
        || !Array.isArray(p.actions) || !p.actions.length || p.actions.some(action => !v3Actions.includes(action as typeof v3Actions[number])) || new Set(p.actions).size !== p.actions.length
        || Number(p.exp) > Number(p.iat) + 60 || ['jobId', 'action', 'plan', 'planHash', 'controlRevision', 'grantId', 'grantRevision'].some(field => Object.hasOwn(p, field))) throw new Error();
    } else if (audience !== 'office-v3-session') {
      if (desktopUuid(p.jobId) !== p.jobId || !v3Actions.includes(p.action as typeof v3Actions[number]) || !['win-x64', 'win-arm64'].includes(String(p.architecture)) || hashV3(JSON.stringify(planV3(p.plan, String(p.action)))) !== p.planHash || Object.hasOwn(p, 'actions')) throw new Error();
      // Previously issued v3 jobs without a mode retain their public scope.
      if (p.admissionMode === 'candidate') {
        if (desktopUuid(p.grantId) !== p.grantId || typeof p.grantRevision !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(p.grantRevision) || BigInt(p.grantRevision) > BigInt('9223372036854775807')) throw new Error();
      } else if (p.admissionMode !== undefined && p.admissionMode !== 'public' || Object.hasOwn(p, 'grantId') || Object.hasOwn(p, 'grantRevision')) throw new Error();
    }
    return p as V3Claims;
  } catch { throw new DesktopError('SESSION_INVALID', 401); }
}
