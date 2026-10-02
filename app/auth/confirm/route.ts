import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseMode } from "@/lib/supabase/config";
import { createSupabaseRouteClient, preventAuthCaching, trustedAuthOrigin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const origin = trustedAuthOrigin(request);
  const failure = () => preventAuthCaching(NextResponse.redirect(new URL("/login?notice=confirmation-failed", origin)));
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const code=request.nextUrl.searchParams.get("code");
  const pkce=Boolean(code && /^[a-z\d._~-]{8,1024}$/i.test(code));
  const hashed=Boolean(request.nextUrl.searchParams.get("type")==="signup" && tokenHash && /^[a-f\d]{32,256}$/i.test(tokenHash));
  if (!isSupabaseMode() || (!pkce && !hashed)) return failure();
  try {
    const response = preventAuthCaching(NextResponse.redirect(new URL("/account/pending", origin)));
    const supabase = createSupabaseRouteClient(request, response);
    const { error } = pkce ? await supabase.auth.exchangeCodeForSession(code!) : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: "signup" });
    if (error) return failure();
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user?.email_confirmed_at) return failure();
    return response;
  } catch { return failure(); }
}
