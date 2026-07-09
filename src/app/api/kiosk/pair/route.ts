import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { kioskPublicSource } from "@/server/api/kiosk-public-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pairBodySchema = z.object({
  code: z.string().min(6, "请输入配对码").max(32, "配对码过长"),
});

export async function POST(request: NextRequest) {
  try {
    const body = pairBodySchema.parse(await request.json().catch(() => ({})));
    const api = await kioskPublicSource();
    const result = await api.pairKioskDevice(body.code);
    return NextResponse.json({ data: result });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => issue.message).join("，")
        : error instanceof Error
          ? error.message
          : "iPad 配对失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
