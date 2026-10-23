import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/proxy";
import { isSupabaseMode } from "@/lib/supabase/config";
import { preventAuthCaching, trustedAuthOrigin } from "@/lib/supabase/server";

export async function proxy(request: NextRequest) {
  const publicPath = request.nextUrl.pathname;
  if (publicPath === "/api/device-directory/manifest" || /^\/api\/device-directory\/[a-f0-9]{64}\/(package|(phone|tablet|laptop|desktop|console|other)-[a-f0-9]{64})$/.test(publicPath)) return NextResponse.next();
  // Discard spoofed document scope; server components use only URL scope.
  request.headers.delete("x-ct-document-store");
  const selected=request.nextUrl.searchParams.get("storeId");
  if(selected) request.headers.set("x-ct-document-store",selected);
  const path=request.nextUrl.pathname;
  const code=request.nextUrl.searchParams.get("code");
  // Existing Supabase projects may return PKCE to their site URL or legacy login route.
  if(isSupabaseMode() && ["/","/login"].includes(path) && code && /^[a-z\d._~-]{8,1024}$/i.test(code)) {
    const target=new URL("/auth/confirm",trustedAuthOrigin(request));target.searchParams.set("code",code);
    const flowId=request.nextUrl.searchParams.get("sb_flow_id");
    if(flowId !== null) target.searchParams.set("sb_flow_id",flowId);
    return preventAuthCaching(NextResponse.redirect(target));
  }
  return updateSupabaseSession(request);
}
export const config = { matcher: ["/", "/repair", "/cinema", "/toolbox/:path*", "/app/:path*", "/account/:path*", "/api/:path*", "/auth/:path*", "/login", "/register"] };
