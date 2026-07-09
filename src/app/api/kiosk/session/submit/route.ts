import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { kioskPublicSource } from "@/server/api/kiosk-public-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const submitBodySchema = z.object({
  customer_name: z.string().max(120).optional(),
  customer_phone: z.string().max(40).optional(),
  backup_phone: z.string().max(40).optional(),
  preferred_channel: z.enum(["whatsapp", "sms"]).optional(),
  language: z.enum(["it", "zh", "en"]).optional(),
  confirmation_checked: z.boolean().optional(),
  signature_data_url: z.string().max(600_000).optional(),
  note: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("x-kiosk-token") ?? "";
    const body = submitBodySchema.parse(await request.json().catch(() => ({})));
    const api = await kioskPublicSource();
    const result = await api.submitKioskPublicSession(token, body);
    return NextResponse.json({ data: result });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => issue.message).join("，")
        : error instanceof Error
          ? error.message
          : "提交 iPad 表单失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
