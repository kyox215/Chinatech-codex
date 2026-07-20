import { NextResponse, type NextRequest } from "next/server";

export const CUSTOMER_STATUS_PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  Vary: "Origin, Sec-Fetch-Site",
} as const;

export class CustomerStatusRequestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "CustomerStatusRequestError";
  }
}

export function assertCustomerStatusPublicRequest(request: NextRequest) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new CustomerStatusRequestError("Richiesta non consentita.", 403);
  }
  const origin = request.headers.get("origin");
  if (origin && safeOrigin(origin) !== request.nextUrl.origin) {
    throw new CustomerStatusRequestError("Richiesta non consentita.", 403);
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== "application/json") {
    throw new CustomerStatusRequestError("Formato richiesta non valido.", 415);
  }
}

export async function readCustomerStatusJson(request: NextRequest, maxBytes = 1024) {
  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new CustomerStatusRequestError("Richiesta troppo grande.", 413);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new CustomerStatusRequestError("Richiesta troppo grande.", 413);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CustomerStatusRequestError("Formato richiesta non valido.", 400);
  }
}

export function customerStatusJson(body: unknown, status = 200, retryAfter?: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...CUSTOMER_STATUS_PRIVATE_NO_STORE_HEADERS,
      ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
    },
  });
}

export function getCustomerStatusClientAddress(request: NextRequest) {
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for")?.split(",", 1)[0]?.trim();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const direct = request.headers.get("x-real-ip")?.trim();
  const trusted = process.env.VERCEL === "1" ? vercelForwarded : direct || forwarded;
  return (trusted || "unknown").slice(0, 128);
}

function safeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}
