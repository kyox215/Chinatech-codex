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

const submitBodySchema = z
  .object({
    customer_name: z.string().max(120).optional(),
    customer_phone: z.string().max(40).optional(),
    backup_phone: z.string().max(40).optional(),
    preferred_channel: z.enum(["whatsapp", "sms"]).optional(),
    language: z.enum(["it", "zh", "en"]).optional(),
    confirmation_checked: z.boolean().refine(Boolean, "请先确认客户资料"),
    signature_data_url: z.string().max(600_000).optional(),
    note: z.string().max(500).optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("x-kiosk-token") ?? "";
    const body = submitBodySchema.parse(await request.json().catch(() => ({})));
    const api = await kioskPublicSource();
    const result = await api.submitKioskPublicSession(token, body);
    queueRepairDeskRealtimeBroadcast({
      storeId: result.store_id,
      domain: "settings",
      mutation: "updated",
      queryGroups: ["kiosk.sessions"],
    });
    return NextResponse.json({ data: { ok: result.ok } });
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
