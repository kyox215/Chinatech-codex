import type { getSupabaseAdmin } from "@/server/supabase";

export type StoreInvitationDeliveryMethod = "supabase_invite" | "supabase_magic_link";
export type StoreInvitationDeliveryResult =
  | { ok: true; method: StoreInvitationDeliveryMethod }
  | { ok: false; errorCode: string };

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

export async function deliverStoreInvitationEmail({
  admin,
  email,
  invitationId,
}: {
  admin: SupabaseAdmin;
  email: string;
  invitationId: string;
}): Promise<StoreInvitationDeliveryResult> {
  if (process.env.REPAIRDESK_EMAIL_INVITES_ENABLED === "false") {
    return { ok: false, errorCode: "feature_disabled" };
  }

  const siteOrigin = resolveInviteSiteOrigin();
  if (!siteOrigin) return { ok: false, errorCode: "site_url_missing" };

  const newAccountRedirect = buildInviteCompletionUrl(siteOrigin, invitationId, "new");
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: newAccountRedirect,
  });

  if (!inviteError) return { ok: true, method: "supabase_invite" };
  if (!isExistingAuthUserInviteError(inviteError)) {
    return { ok: false, errorCode: classifyAuthDeliveryError(inviteError) };
  }

  const existingAccountRedirect = buildInviteCompletionUrl(siteOrigin, invitationId, "existing");
  const { error: magicLinkError } = await admin.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: existingAccountRedirect,
    },
  });

  if (magicLinkError) {
    return { ok: false, errorCode: classifyAuthDeliveryError(magicLinkError) };
  }
  return { ok: true, method: "supabase_magic_link" };
}

export function buildInviteCompletionUrl(
  siteOrigin: string,
  invitationId: string,
  mode: "new" | "existing",
) {
  const url = new URL("/invite/complete", siteOrigin);
  url.searchParams.set("id", invitationId);
  url.searchParams.set("mode", mode);
  return url.toString();
}

export function resolveInviteSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return undefined;
  try {
    const url = new URL(configured);
    const isLocal = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    if (url.protocol !== "https:" && !isLocal) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export function isExistingAuthUserInviteError(error: {
  code?: string;
  status?: number;
  message?: string;
}) {
  if (error.code === "email_exists" || error.code === "user_already_exists") return true;
  if (error.status !== 400 && error.status !== 422) return false;
  return /already (?:been )?registered|already exists/i.test(error.message ?? "");
}

export function classifyAuthDeliveryError(error: {
  code?: string;
  status?: number;
  message?: string;
}) {
  const code = error.code?.toLowerCase();
  if (code && /^[a-z0-9_]{1,64}$/.test(code)) return code;
  if (error.status === 429 || /rate limit|too many/i.test(error.message ?? "")) {
    return "rate_limited";
  }
  if (error.status && error.status >= 500) return "provider_unavailable";
  return "delivery_failed";
}
