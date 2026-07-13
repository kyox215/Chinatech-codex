import { NextResponse, type NextRequest } from "next/server";

import {
  kioskRequestForbiddenError,
  kioskServiceUnavailableError,
} from "@/features/kiosk/model/kiosk-public-error";

import { isKioskEndToEndEnabled } from "./kiosk-review-gate";

export const KIOSK_PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  Vary: "Origin, Sec-Fetch-Site, x-kiosk-token",
} as const;

export function assertKioskPublicRequest(request: NextRequest) {
  if (!isKioskEndToEndEnabled()) throw kioskServiceUnavailableError();

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw kioskRequestForbiddenError();
  }

  const origin = request.headers.get("origin");
  if (origin && safeOrigin(origin) !== request.nextUrl.origin) {
    throw kioskRequestForbiddenError();
  }
}

export function kioskPublicJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: KIOSK_PRIVATE_NO_STORE_HEADERS,
  });
}

function safeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}
