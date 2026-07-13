import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  isKioskPublicError,
  KIOSK_INTERNAL_ERROR_RESPONSE,
} from "@/features/kiosk/model/kiosk-public-error";
import { queueRepairDeskRealtimeBroadcast } from "@/features/realtime/server/realtime-broadcast";
import { kioskPublicSource } from "@/server/api/kiosk-public-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pairBodySchema = z
  .object({
    code: z.string().min(6, "请输入配对码").max(32, "配对码过长"),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const body = pairBodySchema.parse(await request.json().catch(() => ({})));
    const api = await kioskPublicSource();
    const result = await api.pairKioskDevice(body.code);
    queueRepairDeskRealtimeBroadcast({
      storeId: result.device.store_id,
      domain: "settings",
      mutation: "updated",
      queryGroups: ["kiosk.devices"],
    });
    return NextResponse.json({
      data: {
        token: result.token,
        device: { label: result.device.label, status: result.device.status },
      },
    });
  } catch (error) {
    if (isKioskPublicError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((issue) => issue.message).join("，") },
        { status: 400 },
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
