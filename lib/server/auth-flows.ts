import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { BackendError, withDatabase } from "@/lib/backend/database";
import { authCookieOptions, AuthRequestError, createSupabaseRouteClient, preventAuthCaching } from "@/lib/supabase/server";

const RECOVERY_COOKIE = "ct_rebuild_recovery";
const RECOVERY_SECONDS = 15 * 60;
type RecoveryProof = { userId: string; sessionId: string; expires: number };

function signature(payload: string) {
  // Existing server-only credential provides a stable secret across instances.
  // Credential rotation also invalidates outstanding password recovery proofs.
  const secret = process.env.APP_DATABASE_URL;
  if (!secret) throw new Error("Recovery signing is not configured.");
  return createHmac("sha256", secret).update("chinatech:password-recovery:v1\0").update(payload).digest("base64url");
}

export function clearRecoveryProof(response: NextResponse) {
  response.cookies.set(RECOVERY_COOKIE, "", authCookieOptions({ maxAge: 0 }));
}

export function setRecoveryProof(response: NextResponse, userId: string, sessionId: string) {
  const proof: RecoveryProof = { userId, sessionId, expires: Math.floor(Date.now() / 1000) + RECOVERY_SECONDS };
  const payload = Buffer.from(JSON.stringify(proof)).toString("base64url");
  response.cookies.set(RECOVERY_COOKIE, `${payload}.${signature(payload)}`, authCookieOptions({ maxAge: RECOVERY_SECONDS }));
}

function recoveryProof(request: NextRequest): RecoveryProof {
  const invalid = () => new AuthRequestError("重置链接已失效，请重新申请。", 401);
  const value = request.cookies.get(RECOVERY_COOKIE)?.value;
  if (!value || value.length > 1024) throw invalid();
  const [payload, signed, extra] = value.split(".");
  if (!payload || !signed || extra) throw invalid();
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(signed);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw invalid();
  let proof: RecoveryProof;
  try { proof = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { throw invalid(); }
  const now = Math.floor(Date.now() / 1000);
  if (!proof || typeof proof.userId !== "string" || typeof proof.sessionId !== "string" || !Number.isInteger(proof.expires) || proof.expires <= now || proof.expires > now + RECOVERY_SECONDS) throw invalid();
  return proof;
}

export async function requireRecoverySession(request: NextRequest, response: NextResponse) {
  const proof = recoveryProof(request);
  const supabase = createSupabaseRouteClient(request, response);
  const [{ data, error }, { data: claims, error: claimsError }] = await Promise.all([supabase.auth.getUser(), supabase.auth.getClaims()]);
  if (error || claimsError || !data.user?.email_confirmed_at || data.user.id !== proof.userId || claims?.claims.sub !== proof.userId || claims?.claims.session_id !== proof.sessionId) throw new AuthRequestError("重置链接已失效，请重新申请。", 401);
  try { await withDatabase({ userId: proof.userId, sessionId: proof.sessionId }, null, async () => true); }
  catch (reason) {
    if (reason instanceof BackendError && reason.status === 401) throw new AuthRequestError("重置链接已失效，请重新申请。", 401);
    throw reason;
  }
  return supabase;
}

export function copyAuthCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(cookie => target.cookies.set(cookie));
  return preventAuthCaching(target);
}

export function emailDeliveryFailure(error: { status?: number; code?: string } | null) {
  if (!error) return;
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") throw new AuthRequestError("操作过于频繁，请稍后再试。", 429);
  // A valid address always gets the same response when the account cannot use this flow.
  if (["user_not_found", "email_not_confirmed", "email_exists", "user_already_exists"].includes(error.code ?? "")) return;
  throw new AuthRequestError("邮件服务暂不可用，请稍后重试。", 503);
}
