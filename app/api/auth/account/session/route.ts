import { NextResponse, type NextRequest } from "next/server";
import { requireAccountSession } from "@/lib/server/account-auth";
import { copyAuthCookies } from "@/lib/server/auth-flows";
import { authFailure, preventAuthCaching } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const response = preventAuthCaching(NextResponse.json({}));
  try {
    const { identity } = await requireAccountSession(request, response);
    return copyAuthCookies(response, NextResponse.json({ accountId: identity.userId, sessionId: identity.sessionId }));
  } catch (reason) { return copyAuthCookies(response, authFailure(reason, "无法核对登录状态，请稍后重试。")); }
}
