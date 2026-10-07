import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { BackendError, withDatabase } from "@/lib/backend/database";
import { isSupabaseMode } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPreviewLoginAvailable, PREVIEW_SESSION_COOKIE, PREVIEW_SESSION_VALUE, PREVIEW_EMAIL } from "@/lib/preview-auth";
import type { AuthStatus } from "@/lib/auth-status";
import { staffRoles, type StaffRole } from "@/lib/staff";

export function invalidAuth(error: { status?: number; name?: string; code?: string }) {
  return error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403 ||
    ["refresh_token_not_found", "refresh_token_already_used", "session_not_found", "user_not_found", "bad_jwt"].includes(error.code ?? "");
}

// Display projection only. Every protected read/write retains its own live checks.
// No memberInTransaction: merely reading public navigation must not enroll a store visit.
export async function resolveAuthStatus(client: SupabaseClient, selectedStore?: string, token?: string): Promise<AuthStatus> {
  const status = (state: AuthStatus["state"], scope: string | null = null, account: AuthStatus["account"] = null, store: AuthStatus["store"] = null): AuthStatus => ({ state, scope, formal: true, account, store });
  try {
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error) return status(invalidAuth(error) ? "anonymous" : "unavailable");
    if (!user) return status("anonymous");
    if (!user.email_confirmed_at) return status("unverified");
    const { data, error: claimError } = await client.auth.getClaims(token);
    if (claimError) return status(invalidAuth(claimError) ? "anonymous" : "unavailable");
    if (data?.claims.sub !== user.id || typeof data.claims.session_id !== "string") return status("anonymous");
    const identity = { userId: user.id, sessionId: data.claims.session_id };
    const projection = await withDatabase(identity, null, async tx => {
      const [account] = await tx`select display_name from chinatech_v2.accounts where id=${identity.userId}`;
      const name = typeof account?.display_name === "string" && account.display_name.trim() ? account.display_name : user.email ?? "";
      const rows = await tx`select m.store_id,s.name,m.role from chinatech_v2.store_memberships m join chinatech_v2.stores s on s.id=m.store_id where m.user_id=${identity.userId} and m.membership_status='active' order by s.created_at,m.store_id`;
      const selected = selectedStore ? rows.find(row => row.store_id === selectedStore) : rows[0];
      const ownAccount = { name, email: user.email ?? "" };
      if (!selected) return { account: ownAccount, store: null };
      const [row] = await tx`select chinatech_v2_private.member_access(${selected.store_id}) as allowed`;
      return { account: ownAccount, store: row?.allowed === true ? { name: selected.name as string, role: Object.hasOwn(staffRoles, selected.role) ? selected.role as StaffRole : null } : null };
    });
    const scope = createHmac("sha256", process.env.APP_DATABASE_URL!).update(`chinatech:display:v1\0${identity.userId}\0${identity.sessionId}`).digest("hex");
    return status(projection.store ? "workspace" : "account", scope, projection.account, projection.store);
  } catch (error) {
    return status(error instanceof BackendError && error.status === 401 ? "anonymous" : "unavailable");
  }
}

export async function getAuthStatus(): Promise<AuthStatus> {
  try {
    const jar = await cookies();
    if (!isSupabaseMode()) {
      const preview = isPreviewLoginAvailable() && jar.get(PREVIEW_SESSION_COOKIE)?.value === PREVIEW_SESSION_VALUE;
      return { state: preview ? "workspace" : "anonymous", scope: null, formal: false, account: preview ? { name: "本地预览", email: PREVIEW_EMAIL } : null, store: null };
    }
    if (!jar.getAll().some(cookie => /^ct_rebuild_auth(?:\.\d+)?$/.test(cookie.name) && cookie.value)) return { state: "anonymous", scope: null, formal: true, account: null, store: null };
    return await resolveAuthStatus(await createSupabaseServerClient(), jar.get("ct_store")?.value);
  } catch { return { state: "unavailable", scope: null, formal: isSupabaseMode(), account: null, store: null }; }
}
