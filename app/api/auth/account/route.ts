import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseMode } from "@/lib/supabase/config";
import { authFailure, preventAuthCaching } from "@/lib/supabase/server";
import { copyAuthCookies } from "@/lib/server/auth-flows";
import { getOfficeAdmin } from "@/lib/toolbox/office-server";
import { accountAvailability, accountProjection, requireAccountSession } from "@/lib/server/account-auth";

export async function GET(request: NextRequest) {
  if (!isSupabaseMode()) return authFailure(null, "账号管理未开放。", 404);
  const response = preventAuthCaching(NextResponse.json({}));
  try {
    const { user, identity } = await requireAccountSession(request, response);
    const availability = await accountAvailability();
    let canManageOffice=false;
    try { await getOfficeAdmin(identity); canManageOffice=true; } catch { /* Account management remains usable when Office control is unavailable. */ }
    return copyAuthCookies(response, NextResponse.json({ account: accountProjection(user), availability, capabilities: { canManageOffice } }));
  } catch (reason) { return copyAuthCookies(response, authFailure(reason, "账号资料暂不可用，请稍后重试。")); }
}
