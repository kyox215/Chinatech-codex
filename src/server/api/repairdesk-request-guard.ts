import { ForbiddenError } from "@/server/auth-context";

const allowedFetchSites = new Set(["same-origin", "none"]);
const allowedForwardedProtocols = new Set(["http", "https"]);

export function resolveRepairDeskRequestOrigin({
  headers,
  fallbackOrigin,
}: {
  headers: Headers;
  fallbackOrigin: string;
}) {
  const host = firstHeaderValue(headers.get("host") ?? headers.get("x-forwarded-host"));
  if (!host) return fallbackOrigin;
  if (!/^[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(host)) {
    throw new ForbiddenError("请求来源无效，请刷新页面后重试");
  }

  const forwardedProtocol = firstHeaderValue(headers.get("x-forwarded-proto"))?.toLowerCase();
  const fallbackProtocol = safeProtocol(fallbackOrigin);
  const protocol =
    forwardedProtocol && allowedForwardedProtocols.has(forwardedProtocol)
      ? forwardedProtocol
      : fallbackProtocol;

  return new URL(`${protocol}://${host}`).origin;
}

export function assertRepairDeskPostRequestAllowed({
  headers,
  requestOrigin,
  allowedContentTypes = ["application/json"],
  requireOrigin = false,
}: {
  headers: Headers;
  requestOrigin: string;
  allowedContentTypes?: readonly string[];
  requireOrigin?: boolean;
}) {
  const fetchSite = headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && !allowedFetchSites.has(fetchSite)) {
    throw new ForbiddenError("请求来源无效，请刷新页面后重试");
  }

  const origin = headers.get("origin");
  if (requireOrigin && !origin) {
    throw new ForbiddenError("请求来源无效，请刷新页面后重试");
  }
  if (origin && origin !== requestOrigin) {
    throw new ForbiddenError("请求来源无效，请刷新页面后重试");
  }

  const contentType = headers.get("content-type")?.toLowerCase();
  if (requireOrigin && !contentType) {
    throw new ForbiddenError("请求格式无效，请刷新页面后重试");
  }
  const mediaType = contentType?.split(";", 1)[0]?.trim();
  if (
    mediaType &&
    !allowedContentTypes.some((allowed) => mediaType === allowed.trim().toLowerCase())
  ) {
    throw new ForbiddenError("请求格式无效，请刷新页面后重试");
  }
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || undefined;
}

function safeProtocol(origin: string) {
  try {
    const protocol = new URL(origin).protocol.replace(":", "").toLowerCase();
    return allowedForwardedProtocols.has(protocol) ? protocol : "https";
  } catch {
    return "https";
  }
}
