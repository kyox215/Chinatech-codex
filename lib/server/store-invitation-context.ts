import 'server-only';
import type { NextRequest, NextResponse } from 'next/server';
import { readStoreValue, signStoreValue } from './store-tokens';

export const STORE_INVITATION_COOKIE = 'ct_rebuild_store_invitation';
const seconds = 7 * 24 * 60 * 60;
type InvitationContext = { token: string; issuedAt: number; expiresAt: number; accountId?: string };
export const validInvitationToken = (token: unknown): token is string => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);

export function readInvitationContext(request: NextRequest): InvitationContext | null {
  const value = readStoreValue('store-invitation', request.cookies.get(STORE_INVITATION_COOKIE)?.value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const context = value as InvitationContext, now = Math.floor(Date.now() / 1000);
  if (Object.keys(value).some(key => !['token', 'issuedAt', 'expiresAt', 'accountId'].includes(key)) || !validInvitationToken(context.token) || !Number.isSafeInteger(context.issuedAt) || !Number.isSafeInteger(context.expiresAt) || context.issuedAt > now || context.expiresAt <= now || context.expiresAt > context.issuedAt + seconds || (context.accountId !== undefined && !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(context.accountId))) return null;
  return context;
}

export function clearInvitationContext(response: NextResponse) {
  response.cookies.set(STORE_INVITATION_COOKIE, '', { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 0 });
}

export function setInvitationContext(response: NextResponse, token: string, previous: InvitationContext | null, accountId?: string, invitationExpiresAt?: string) {
  if (!validInvitationToken(token)) throw new Error('请求格式无效。');
  const now = Math.floor(Date.now() / 1000);
  // Reopening the same candidate never renews its original device lifetime.
  const original = previous?.token === token ? previous : null;
  const expiry = invitationExpiresAt ? Math.floor(Date.parse(invitationExpiresAt) / 1000) : now + seconds;
  if (!Number.isFinite(expiry) || expiry <= now) { clearInvitationContext(response); return; }
  const context: InvitationContext = { token, issuedAt: original?.issuedAt ?? now, expiresAt: Math.min(original?.expiresAt ?? now + seconds, expiry, now + seconds), ...(accountId ? { accountId } : original?.accountId ? { accountId: original.accountId } : {}) };
  response.cookies.set(STORE_INVITATION_COOKIE, signStoreValue('store-invitation', context), { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: context.expiresAt - now });
}
