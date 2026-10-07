import { NextResponse, type NextRequest } from "next/server";
import { getAuthStatus, resolveAuthStatus } from "@/lib/server/auth-status";
import { getSupabaseConfig, isSupabaseMode } from "@/lib/supabase/config";
import { preventAuthCaching } from "@/lib/supabase/server";
import { readAuthAccessToken } from "@/lib/server/login-policy";
import { createClient } from "@supabase/supabase-js";
export async function GET(request: NextRequest) {
  let status;
  try {
    if (!isSupabaseMode()) status = await getAuthStatus();
    else {
      const token = readAuthAccessToken(request.cookies.getAll());
      if (!token) status = { state: "anonymous", scope: null, formal: true };
      else {
        // An expiry hint can only request an explicit document refresh. It grants
        // no identity and never writes cookies from a background request.
        try {
          const hint = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
          if (typeof hint.exp === "number" && hint.exp <= Date.now()/1000) return preventAuthCaching(NextResponse.json({ code: "SESSION_REFRESH_REQUIRED" }, { status: 409 }));
        } catch { /* The identity verifier rejects malformed JWTs below. */ }
        const { url, publishableKey } = getSupabaseConfig();
        const client = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(8000) }) } });
        status = await resolveAuthStatus(client, request.cookies.get("ct_store")?.value, token);
      }
    }
  }
  catch { status = { state: "unavailable", scope: null, formal: isSupabaseMode() }; }
  return preventAuthCaching(NextResponse.json(status, { status: status.state === "unavailable" ? 503 : 200 }));
}
