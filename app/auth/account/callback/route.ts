import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseMode } from "@/lib/supabase/config";
import { preventAuthCaching, trustedAuthOrigin } from "@/lib/supabase/server";
import { copyAuthCookies } from "@/lib/server/auth-flows";
import { clearAccountIntent, readAccountIntent, requireAccountSession, stagedAccountClient } from "@/lib/server/account-auth";

export async function GET(request: NextRequest) {
  const origin = trustedAuthOrigin(request);
  const redirect = (notice: "linked" | "email-pending" | "email-updated" | "account-failed") => preventAuthCaching(NextResponse.redirect(new URL(`/account/settings?notice=${notice}`, origin)));
  const response = redirect("account-failed");
  try {
    if (!isSupabaseMode() || request.nextUrl.searchParams.has("error")) return response;
    const intent = readAccountIntent(request);
    const original = await requireAccountSession(request, response);
    if (original.identity.userId !== intent.userId || original.identity.sessionId !== intent.sessionId) return response;
    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
      // The first of the two email confirmations has no authorization code.
      // Keep the intent for the second link, without asserting success.
      return intent.kind === "email" ? copyAuthCookies(response, redirect("email-pending")) : response;
    }
    if (!/^[a-z\d._~-]{8,1024}$/i.test(code)) return response;
    const staged = stagedAccountClient(request);
    const flowId = request.nextUrl.searchParams.get("sb_flow_id");
    const { data, error } = await staged.supabase.auth.exchangeCodeForSession(code, flowId !== null ? { flowId } : undefined);
    if (error || data.user?.id !== intent.userId) return response;
    const verified = await requireAccountSession(staged.request, staged.response);
    if (verified.identity.userId !== intent.userId) return response;
    const success = intent.kind === "email"
      ? verified.user.email?.toLowerCase() === intent.target && !verified.user.new_email
      : verified.user.identities?.some(identity => identity.provider === intent.kind);
    if (!success) return response;
    const result = copyAuthCookies(staged.response, redirect(intent.kind === "email" ? "email-updated" : "linked"));
    clearAccountIntent(result);
    return result;
  } catch { return response; }
}
