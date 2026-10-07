import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { BackendError, withDatabase } from "@/lib/backend/database";
import { isSupabaseMode } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPreviewLoginAvailable, PREVIEW_SESSION_COOKIE, PREVIEW_SESSION_VALUE } from "@/lib/preview-auth";
import type { AuthStatus } from "@/lib/auth-status";

export function invalidAuth(error: { status?: number; name?: string; code?: string }) {
  return error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403 ||
    ["refresh_token_not_found", "refresh_token_already_used", "session_not_found", "user_not_found", "bad_jwt"].includes(error.code ?? "");
}

// Display projection only. Every protected read/write retains its own live checks.
// No memberInTransaction: merely reading public navigation must not enroll a store visit.
export async function resolveAuthStatus(client: SupabaseClient, selectedStore?: string, token?: string): Promise<AuthStatus> {
  const status = (state: AuthStatus["state"], scope: string | null = null): AuthStatus => ({ state, scope, formal: true });
  try {
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error) return status(invalidAuth(error) ? "anonymous" : "unavailable");
    if (!user) return status("anonymous");
    if (!user.email_confirmed_at) return status("unverified");
    const { data, error: claimError } = await client.auth.getClaims(token);
    if (claimError) return status(invalidAuth(claimError) ? "anonymous" : "unavailable");
    if (data?.claims.sub !== user.id || typeof data.claims.session_id !== "string") return status("anonymous");
    const identity = { userId: user.id, sessionId: data.claims.session_id };
    const allowed = await withDatabase(identity, null, async tx => {
      const rows = await tx`select m.store_id from chinatech_v2.store_memberships m join chinatech_v2.stores s on s.id=m.store_id where m.user_id=${identity.userId} and m.membership_status='active' order by s.created_at,m.store_id`;
      const store = selectedStore ? rows.find(row => row.store_id === selectedStore)?.store_id : rows[0]?.store_id;
      if (!store) return false;
      const [row] = await tx`select chinatech_v2_private.member_access(${store}) as allowed`;
      return row?.allowed === true;
    });
    const scope = createHmac("sha256", process.env.APP_DATABASE_URL!).update(`chinatech:display:v1\0${identity.userId}\0${identity.sessionId}`).digest("hex");
    return status(allowed ? "workspace" : "account", scope);
  } catch (error) {
    return status(error instanceof BackendError && error.status === 401 ? "anonymous" : "unavailable");
  }
}

export async function getAuthStatus(): Promise<AuthStatus> {
  try {
    const jar = await cookies();
    if (!isSupabaseMode()) return { state: isPreviewLoginAvailable() && jar.get(PREVIEW_SESSION_COOKIE)?.value === PREVIEW_SESSION_VALUE ? "workspace" : "anonymous", scope: null, formal: false };
    if (!jar.getAll().some(cookie => /^ct_rebuild_auth(?:\.\d+)?$/.test(cookie.name) && cookie.value)) return { state: "anonymous", scope: null, formal: true };
    return await resolveAuthStatus(await createSupabaseServerClient(), jar.get("ct_store")?.value);
  } catch { return { state: "unavailable", scope: null, formal: isSupabaseMode() }; }
}
