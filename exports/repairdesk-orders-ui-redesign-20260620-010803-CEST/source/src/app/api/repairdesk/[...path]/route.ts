import type { NextRequest } from "next/server";

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
  const path = (await context.params).path?.join("/") ?? "";
  return handleRepairDeskPost(path, await readJson(request));
}
