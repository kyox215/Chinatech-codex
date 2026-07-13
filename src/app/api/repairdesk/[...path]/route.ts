import { NextResponse, type NextRequest } from "next/server";

import {
  assertRepairDeskPostRequestAllowed,
  resolveRepairDeskRequestOrigin,
} from "@/server/api/repairdesk-request-guard";
import {
  getRepairDeskPostActor,
  handleRepairDeskGet,
  handleRepairDeskPost,
} from "@/server/api/repairdesk-router";
import { ForbiddenError, UnauthorizedError } from "@/server/auth-context";
import { BUYBACK_EVIDENCE_HOSTED_REQUEST_MAX_BYTES } from "@/features/buyback/model/buyback-evidence-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

const ORDER_DATA_MULTIPART_MAX_BYTES = 4_400_000;
const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function privateError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: PRIVATE_NO_STORE_HEADERS });
}

async function readJson(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => ({}));
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const path = (await context.params).path?.join("/") ?? "";
  return handleRepairDeskGet(path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const path = (await context.params).path?.join("/") ?? "";
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (
    path === "orders/data/import/preview" &&
    Number.isFinite(contentLength) &&
    contentLength > ORDER_DATA_MULTIPART_MAX_BYTES
  ) {
    return privateError("上传文件超过 4 MB 限制", 413);
  }
  if (
    path === "inventory/attachment/upload" &&
    Number.isFinite(contentLength) &&
    contentLength > BUYBACK_EVIDENCE_HOSTED_REQUEST_MAX_BYTES
  ) {
    return privateError("附件请求过大，请压缩至 2.4MB 后重试", 413);
  }
  try {
    assertRepairDeskPostRequestAllowed({
      headers: request.headers,
      requestOrigin: resolveRepairDeskRequestOrigin({
        headers: request.headers,
        fallbackOrigin: request.nextUrl.origin,
      }),
      allowedContentTypes:
        path === "orders/data/import/preview" ? ["multipart/form-data"] : ["application/json"],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "请求来源无效，请刷新页面后重试";
    return privateError(message, 403);
  }

  let uploadActor;
  if (path === "orders/data/import/preview") {
    try {
      uploadActor = await getRepairDeskPostActor(path);
    } catch (error) {
      const status = error instanceof UnauthorizedError ? 401 : 403;
      const message =
        error instanceof UnauthorizedError || error instanceof ForbiddenError
          ? error.message
          : "无法验证当前账号";
      return privateError(message, status);
    }
  }

  const body = uploadActor
    ? await request.formData().catch(() => new FormData())
    : await readJson(request);
  return handleRepairDeskPost(path, body, uploadActor);
}
