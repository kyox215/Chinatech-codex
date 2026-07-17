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

export function isSameOriginRequest(request: Request, requestOrigin: string) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  return origin === requestOrigin && (!fetchSite || fetchSite === "same-origin");
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
