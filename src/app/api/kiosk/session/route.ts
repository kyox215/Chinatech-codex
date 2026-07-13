import type { NextRequest } from "next/server";

import {
  isKioskPublicError,
  KIOSK_INTERNAL_ERROR_RESPONSE,
} from "@/features/kiosk/model/kiosk-public-error";
import {
  assertKioskPublicRequest,
  kioskPublicJson,
} from "@/features/kiosk/server/kiosk-public-http";
import { kioskPublicSource } from "@/server/api/kiosk-public-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    assertKioskPublicRequest(request);
    const token = request.headers.get("x-kiosk-token") ?? "";
    const api = await kioskPublicSource();
    const session = await api.getKioskPublicSession(token);
    return kioskPublicJson({ data: session });
  } catch (error) {
    if (isKioskPublicError(error)) {
      return kioskPublicJson({ error: error.message, code: error.code }, error.status);
    }
    return kioskPublicJson(
      {
        error: KIOSK_INTERNAL_ERROR_RESPONSE.message,
        code: KIOSK_INTERNAL_ERROR_RESPONSE.code,
      },
      500,
    );
  }
}
