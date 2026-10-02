import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { AccountOverview, AccountProvider } from "@/lib/account";
import { BackendError, withDatabase } from "@/lib/backend/database";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { authCookieOptions, AuthRequestError, createSupabaseRouteClient, preventAuthCaching } from "@/lib/supabase/server";

export async function requireAccountSession(request: NextRequest, response: NextResponse, expectedAccount = false) {
  const supabase = createSupabaseRouteClient(request, response);
  const [{ data, error }, { data: claims, error: claimsError }] = await Promise.all([supabase.auth.getUser(), supabase.auth.getClaims()]);
  if (error || claimsError || !data.user?.email_confirmed_at || claims?.claims.sub !== data.user.id || typeof claims.claims.session_id !== "string") throw new AuthRequestError("请重新登录后管理账号。", 401);
  const identity = { userId: data.user.id, sessionId: claims.claims.session_id };
  if (expectedAccount && request.headers.get("x-ct-account-id") !== identity.userId) throw new AuthRequestError("登录账号已变化，请刷新账号资料后重试。", 409);
  try { await withDatabase(identity, null, async () => true); }
  catch (reason) { if (reason instanceof BackendError && reason.status === 401) throw new AuthRequestError("请重新登录后管理账号。", 401); throw reason; }
  return { supabase, user: data.user, identity };
}

export async function accountAvailability(): Promise<AccountOverview["availability"]> {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/auth/v1/settings`, { headers: { apikey: config.publishableKey }, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new AuthRequestError("暂时无法读取登录服务，请稍后重试。", 503);
  const settings = await response.json();
  if (!settings || !settings.external || typeof settings.external !== "object" || Array.isArray(settings.external)) throw new AuthRequestError("暂时无法读取登录服务，请稍后重试。", 503);
  return { google: settings.external.google === true, apple: settings.external.apple === true, phone: settings.external.phone === true && typeof settings.sms_provider === "string" && settings.sms_provider.length > 0 };
}

export function storedAccountPhone(phone: unknown): string {
  if (typeof phone !== "string" || !/^\+?[1-9]\d{5,14}$/.test(phone)) return "";
  return phone.startsWith("+") ? phone : "+" + phone;
}

export function accountProjection(user: User): AccountOverview["account"] {
  const provider = (name: AccountProvider) => {
    const identity = user.identities?.find(identity => identity.provider === name);
    return { linked: Boolean(identity), email: typeof identity?.identity_data?.email === "string" ? identity.identity_data.email : "" };
  };
  return {
    id: user.id, email: user.email ?? "", emailVerified: Boolean(user.email_confirmed_at), pendingEmail: user.new_email ?? "",
    phone: storedAccountPhone(user.phone), phoneVerified: Boolean(user.phone && user.phone_confirmed_at), pendingPhone: storedAccountPhone(user.new_phone),
    providers: { google: provider("google"), apple: provider("apple") },
  };
}

export function accountActionError(error: { status?: number; code?: string } | null, fallback: string) {
  if (!error) return;
  if (error.status === 429) throw new AuthRequestError("操作过于频繁，请稍后再试。", 429);
  if (error.code === "manual_linking_disabled" || error.code === "provider_disabled" || error.code === "phone_provider_disabled") throw new AuthRequestError("此绑定服务尚未开放，请稍后重试。", 503);
  // Never disclose whether another account owns the requested address or identity.
  throw new AuthRequestError(fallback, error.status && error.status >= 500 ? 503 : 400);
}

const INTENT_COOKIE = "ct_rebuild_account_intent";
const INTENT_SECONDS = 60 * 60;
export type AccountIntent = { userId: string; sessionId: string; kind: "email" | AccountProvider; target: string; nonce: string; expires: number };
function intentSignature(payload: string) {
  const secret = process.env.APP_DATABASE_URL;
  if (!secret) throw new Error("Account intent signing is not configured.");
  return createHmac("sha256", secret).update("chinatech:account-intent:v1\0").update(payload).digest("base64url");
}
export function issueAccountIntent(response: NextResponse, identity: { userId: string; sessionId: string }, kind: AccountIntent["kind"], target = "") {
  const intent: AccountIntent = { ...identity, kind, target, nonce: randomBytes(24).toString("base64url"), expires: Math.floor(Date.now() / 1000) + INTENT_SECONDS };
  const payload = Buffer.from(JSON.stringify(intent)).toString("base64url");
  response.cookies.set(INTENT_COOKIE, `${payload}.${intentSignature(payload)}`, authCookieOptions({ maxAge: INTENT_SECONDS }));
  return intent;
}
export function clearAccountIntent(response: NextResponse) { response.cookies.set(INTENT_COOKIE, "", authCookieOptions({ maxAge: 0 })); }
export function readAccountIntent(request: NextRequest): AccountIntent {
  const invalid = () => new AuthRequestError("账号确认已失效，请重新发起。", 400);
  const value = request.cookies.get(INTENT_COOKIE)?.value;
  if (!value || value.length > 2048) throw invalid();
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) throw invalid();
  const expected = Buffer.from(intentSignature(payload)), actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw invalid();
  let intent: AccountIntent;
  try { intent = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { throw invalid(); }
  const now = Math.floor(Date.now() / 1000);
  if (!intent || typeof intent.userId !== "string" || typeof intent.sessionId !== "string" || !["email", "google", "apple"].includes(intent.kind) || typeof intent.target !== "string" || typeof intent.nonce !== "string" || !Number.isInteger(intent.expires) || intent.expires <= now || intent.expires > now + INTENT_SECONDS || request.nextUrl.searchParams.get("intent") !== intent.nonce) throw invalid();
  return intent;
}

// Exchanges may replace identity cookies. Stage writes until the returned user
// matches the authenticated initiator, leaving the original browser untouched.
export function stagedAccountClient(request: NextRequest) {
  const headers = new Headers(request.headers); headers.set("cookie", request.cookies.toString());
  const stagedRequest = new NextRequest(request.url, { headers });
  const response = preventAuthCaching(NextResponse.json({}));
  return { request: stagedRequest, response, supabase: createSupabaseRouteClient(stagedRequest, response) };
}
