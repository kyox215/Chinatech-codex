import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseMode } from "@/lib/supabase/config";
import { authFailure, preventAuthCaching } from "@/lib/supabase/server";
import { copyAuthCookies } from "@/lib/server/auth-flows";
import { accountAvailability, accountProjection, requireAccountSession } from "@/lib/server/account-auth";

export async function GET(request: NextRequest) {
  if (!isSupabaseMode()) return authFailure(null, "账号管理未开放。", 404);
  const response = preventAuthCaching(NextResponse.json({}));
  try {
    const { user, identity } = await requireAccountSession(request, response);
    const availability = await accountAvailability();
    return copyAuthCookies(response, NextResponse.json({ sessionId: identity.sessionId, account: accountProjection(user), availability }));
  } catch (reason) { return copyAuthCookies(response, authFailure(reason, "账号资料暂不可用，请稍后重试。")); }
}
