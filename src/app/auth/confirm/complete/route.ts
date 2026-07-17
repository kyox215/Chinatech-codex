import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";

const allowedTypes = new Set<EmailOtpType>(["invite", "magiclink"]);

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  if (!isSameOriginRequest(request, requestUrl.origin)) {
    return redirectError(requestUrl, "origin");
  }

  const form = await request.formData();
  const tokenHash = stringField(form, "token_hash");
  const type = stringField(form, "type") as EmailOtpType;
  const next = safeInviteCompletionPath(stringField(form, "next"), requestUrl.origin);

  if (!/^[a-f0-9]{64}$/i.test(tokenHash) || !allowedTypes.has(type) || !next) {
    return redirectError(requestUrl, "invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return redirectError(requestUrl, "expired");

  return noStoreRedirect(new URL(next, requestUrl.origin));
}

export function safeInviteCompletionPath(value: string, requestOrigin: string) {
  try {
    const configuredOrigin = trustedSiteOrigin() ?? requestOrigin;
    const url = new URL(value, configuredOrigin);
    if (url.origin !== configuredOrigin || url.pathname !== "/invite/complete") return undefined;
    const invitationId = url.searchParams.get("id") ?? "";
    const mode = url.searchParams.get("mode");
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        invitationId,
      )
    ) {
      return undefined;
    }
    if (mode !== "new" && mode !== "existing") return undefined;
    return `${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

function trustedSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return undefined;
  try {
    return new URL(configured).origin;
  } catch {
    return undefined;
  }
}

export function isSameOriginRequest(request: Request, requestOrigin: string) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  return origin === requestOrigin && (!fetchSite || fetchSite === "same-origin");
}

function stringField(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function redirectError(requestUrl: URL, reason: string) {
  const url = new URL("/login", requestUrl.origin);
  url.searchParams.set("auth_error", "invite");
  url.searchParams.set("reason", reason);
  return noStoreRedirect(url);
}

function noStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url, { status: 303 });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
