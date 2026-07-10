import { NextResponse, type NextRequest } from "next/server";

import {
  assertRepairDeskPostRequestAllowed,
  resolveRepairDeskRequestOrigin,
} from "@/server/api/repairdesk-request-guard";
import { handleRepairDeskGet, handleRepairDeskPost } from "@/server/api/repairdesk-router";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

async function readJson(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => ({}));
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const path = (await context.params).path?.join("/") ?? "";
  return handleRepairDeskGet(path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertRepairDeskPostRequestAllowed({
      headers: request.headers,
      requestOrigin: resolveRepairDeskRequestOrigin({
        headers: request.headers,
        fallbackOrigin: request.nextUrl.origin,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "请求来源无效，请刷新页面后重试";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const path = (await context.params).path?.join("/") ?? "";
  return handleRepairDeskPost(path, await readJson(request));
}
