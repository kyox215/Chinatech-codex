import type { NextRequest, NextResponse } from "next/server";
import { enrollLogin, withDatabase } from "@/lib/backend/database";
import { AuthRequestError } from "@/lib/supabase/server";
import { browserDescription, IDLE_SECONDS, setLoginPolicy } from "./login-policy";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthIdentity } from "@/lib/backend/database";

export async function sessionRemember(identity: AuthIdentity): Promise<boolean> {
  return withDatabase(identity, null, async tx => {
    const [row] = await tx`select remember from chinatech_v2_private.login_sessions where session_id=${identity.sessionId} and user_id=${identity.userId}`;
    if (typeof row?.remember !== "boolean") throw new AuthRequestError("会话已失效，请重新登录。", 401);
    return row.remember;
  });
}

export async function establishLogin(request: NextRequest, response: NextResponse, supabase: SupabaseClient, remember: boolean) {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || typeof claims?.sub !== "string" || typeof claims.session_id !== "string") throw new AuthRequestError("无法完成登录，请稍后重试。", 401);
  const identity = { userId: claims.sub, sessionId: claims.session_id };
  const { browser, os } = browserDescription(request.headers.get("user-agent") || "");
  await enrollLogin(identity, remember, browser, os);
  const policy = await withDatabase(identity, null, async tx => {
    const [row] = await tx`select remember,last_active_at from chinatech_v2_private.login_sessions where session_id=${identity.sessionId}`;
    return { sessionId: identity.sessionId, remember: row.remember as boolean, expires: Math.floor(new Date(row.last_active_at).getTime() / 1000) + IDLE_SECONDS };
  });
  setLoginPolicy(request, response, policy);
}
