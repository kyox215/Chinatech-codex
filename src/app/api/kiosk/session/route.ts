import { NextResponse, type NextRequest } from "next/server";

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
    const message = error instanceof Error ? error.message : "读取 iPad 任务失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
