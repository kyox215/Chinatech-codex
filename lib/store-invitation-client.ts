import {readStoreJson} from './store-request';
// The candidate remains in the original hash until an HttpOnly cookie roundtrip
// succeeds. Neither a bearer token nor private application data is put in a query.
export function invitationToken(value: string, origin: string) {
  if (/^[A-Za-z0-9_-]{43}$/.test(value)) return value;
  try { const url = new URL(value); if (url.origin !== origin || url.pathname !== '/join' || url.search) return ''; const token = new URLSearchParams(url.hash.slice(1)).get('invite') ?? ''; return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : ''; } catch { return ''; }
}
export async function persistInvitation(token: string, signal?: AbortSignal) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('邀请无效或已过期。');
  for (let attempt = 0; attempt < 2; attempt++) {
    const {response,data} = await readStoreJson('/api/auth/store-invitation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ token }), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }, '邀请暂未保存，请保留原邀请链接并重试。');
    if (!response.ok) throw new Error(typeof data?.message === 'string' ? data.message : '邀请暂未保存，请保留原邀请链接并重试。');
    if (data?.stored === true) return;
  }
  throw new Error('邀请暂未保存，请保留原邀请链接并重试。');
}
export function forgetInvitationHash(originalHash: string) {
  if (window.location.hash === originalHash) history.replaceState(null, '', window.location.pathname + window.location.search);
  try { sessionStorage.removeItem('ct-pending-invite'); } catch { /* A verified cookie already owns recovery. */ }
}
