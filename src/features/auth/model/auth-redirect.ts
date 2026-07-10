export const REGISTRATION_COMPLETE_PATH = "/register/complete";

export function buildAuthCallbackUrl(nextPath: string, origin?: string) {
  const url = new URL("/auth/callback", resolveAuthRedirectOrigin(origin));
  url.searchParams.set("next", safeAuthNextPath(nextPath));
  return url.toString();
}

export function resolveAuthRedirectOrigin(origin?: string) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const candidate =
    configured ||
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:3000");

  try {
    return new URL(candidate).origin;
  } catch {
    return "http://127.0.0.1:3000";
  }
}

export function safeAuthNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
