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
import { AI_INVENTORY_VISION_REQUEST_MAX_BYTES } from "@/features/ai-assistant/model/inventory-image-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

const ORDER_DATA_MULTIPART_MAX_BYTES = 4_400_000;
const AI_ORDER_TURN_MAX_BYTES = 4_096;
const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function privateError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: PRIVATE_NO_STORE_HEADERS });
}

async function readJson(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => ({}));
}

class RequestPayloadTooLargeError extends Error {}

async function readJsonWithLimit(request: NextRequest, maxBytes: number): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new RequestPayloadTooLargeError();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const path = (await context.params).path?.join("/") ?? "";
  return handleRepairDeskGet(path, request.nextUrl.searchParams);
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
  if (
    path === "ai/order/turn" &&
    Number.isFinite(contentLength) &&
    contentLength > AI_ORDER_TURN_MAX_BYTES
  ) {
    return privateError("AI 查询请求过大，请缩短问题后重试", 413);
  }
  if (
    path === "ai/vision/extract" &&
    Number.isFinite(contentLength) &&
    contentLength > AI_INVENTORY_VISION_REQUEST_MAX_BYTES
  ) {
    return privateError("AI 图片请求过大，请重新裁剪标签后重试", 413);
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

  let preauthenticatedActor;
  if (
    path === "orders/data/import/preview" ||
    path === "ai/order/turn" ||
    path === "ai/vision/extract"
  ) {
    try {
      preauthenticatedActor = await getRepairDeskPostActor(path);
    } catch (error) {
      const status = error instanceof UnauthorizedError ? 401 : 403;
      const message =
        error instanceof UnauthorizedError || error instanceof ForbiddenError
          ? error.message
          : "无法验证当前账号";
      return privateError(message, status);
    }
  }

  let body: unknown;
  try {
    body =
      path === "orders/data/import/preview"
        ? await request.formData().catch(() => new FormData())
        : path === "ai/vision/extract"
          ? await readJsonWithLimit(request, AI_INVENTORY_VISION_REQUEST_MAX_BYTES)
          : await readJson(request);
  } catch (error) {
    if (error instanceof RequestPayloadTooLargeError) {
      return privateError("AI 图片请求过大，请重新裁剪标签后重试", 413);
    }
    return privateError("请求内容无法读取，请重试", 400);
  }
  return handleRepairDeskPost(path, body, preauthenticatedActor);
}
