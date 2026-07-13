import { NextResponse, type NextRequest } from "next/server";

import {
  isKioskPublicError,
  KIOSK_INTERNAL_ERROR_RESPONSE,
} from "@/features/kiosk/model/kiosk-public-error";
import { kioskPublicSource } from "@/server/api/kiosk-public-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("x-kiosk-token") ?? "";
    const api = await kioskPublicSource();
    const session = await api.getKioskPublicSession(token);
    return NextResponse.json({ data: session });
  } catch (error) {
    if (isKioskPublicError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: KIOSK_INTERNAL_ERROR_RESPONSE.message,
        code: KIOSK_INTERNAL_ERROR_RESPONSE.code,
      },
      { status: 500 },
    );
  }
}
