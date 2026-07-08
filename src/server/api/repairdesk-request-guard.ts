import { ForbiddenError } from "@/server/auth-context";

const allowedFetchSites = new Set(["same-origin", "none"]);

export function assertRepairDeskPostRequestAllowed({
  headers,
  requestOrigin,
}: {
  headers: Headers;
  requestOrigin: string;
}) {
  const fetchSite = headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && !allowedFetchSites.has(fetchSite)) {
    throw new ForbiddenError("请求来源无效，请刷新页面后重试");
  }

  const origin = headers.get("origin");
  if (origin && origin !== requestOrigin) {
    throw new ForbiddenError("请求来源无效，请刷新页面后重试");
  }

  const contentType = headers.get("content-type")?.toLowerCase();
  if (contentType && !contentType.includes("application/json")) {
    throw new ForbiddenError("请求格式无效，请刷新页面后重试");
  }
}
