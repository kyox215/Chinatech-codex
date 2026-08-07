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
import { getAiAssistantCapabilities } from "@/features/ai-assistant/server/capabilities";
import { AiServiceError } from "@/features/ai-assistant/server/errors";
import { consumeAiAssistantRequestRateLimit } from "@/features/ai-assistant/server/request-rate-limit";
import {
  INVENTORY_V2_COMMAND_REQUEST_MAX_BYTES,
  MEMO_COMMAND_REQUEST_MAX_BYTES,
} from "@/server/api/repairdesk-request-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

const ORDER_DATA_MULTIPART_MAX_BYTES = 4_400_000;
export const INVENTORY_LIFECYCLE_COMMAND_MAX_BYTES = 48 * 1024;
const TOOLKIT_POST_MAX_BYTES = 64 * 1024;
const AI_ORDER_TURN_MAX_BYTES = 4_096;
const AI_ORDER_ACTION_MAX_BYTES = 2_048;
const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function isInventoryV2CommandPath(path: string) {
  return (
    path === "inventory/v2/intake/create" ||
    path === "inventory/products/quick-create" ||
    path === "inventory/products/edit-data" ||
    path === "inventory/products/update" ||
    path === "inventory/v2/sales/complete" ||
    path === "inventory/v2/workflow/apply"
  );
}

function isInventoryLifecycleCommandPath(path: string) {
  return path === "inventory/lifecycle/command";
}

function isMemoPath(path: string) {
  return path.startsWith("memos/");
}

function privateError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: PRIVATE_NO_STORE_HEADERS });
}

async function readJson(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => ({}));
}

class RequestPayloadTooLargeError extends Error {}
class InvalidJsonPayloadError extends Error {}

function assertInventoryLifecycleJsonBounds(value: unknown, depth = 0, state = { nodes: 0 }): void {
  state.nodes += 1;
  if (depth > 8 || state.nodes > 256) throw new RequestPayloadTooLargeError();
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RequestPayloadTooLargeError();
    return;
  }
  if (typeof value === "string") {
    if (value.length > 4096) throw new RequestPayloadTooLargeError();
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 64) throw new RequestPayloadTooLargeError();
    for (const entry of value) assertInventoryLifecycleJsonBounds(entry, depth + 1, state);
    return;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 64) throw new RequestPayloadTooLargeError();
    for (const [key, entry] of entries) {
      if (key.length > 128) throw new RequestPayloadTooLargeError();
      assertInventoryLifecycleJsonBounds(entry, depth + 1, state);
    }
  }
}

async function readJsonWithLimit(
  request: NextRequest,
  maxBytes: number,
  rejectInvalidJson = false,
): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) {
    if (rejectInvalidJson) throw new InvalidJsonPayloadError();
    return {};
  }
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
    if (rejectInvalidJson) throw new InvalidJsonPayloadError();
    return {};
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const path = (await context.params).path?.join("/") ?? "";
  return handleRepairDeskGet(path, request.nextUrl.searchParams);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const path = (await context.params).path?.join("/") ?? "";
  const isToolkitPost = path.startsWith("toolkit/");
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (isToolkitPost && Number.isFinite(contentLength) && contentLength > TOOLKIT_POST_MAX_BYTES) {
    return privateError("工具集请求过大，请缩短内容后重试", 413);
  }
  if (
    path === "orders/data/import/preview" &&
    Number.isFinite(contentLength) &&
    contentLength > ORDER_DATA_MULTIPART_MAX_BYTES
  ) {
    return privateError("上传文件超过 4 MB 限制", 413);
  }
  if (
    ["inventory/attachment/upload", "buyback/attachment/upload"].includes(path) &&
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
    path === "ai/order/action" &&
    Number.isFinite(contentLength) &&
    contentLength > AI_ORDER_ACTION_MAX_BYTES
  ) {
    return privateError("AI 订单操作请求过大，请刷新后重试", 413);
  }
  if (
    path === "ai/vision/extract" &&
    Number.isFinite(contentLength) &&
    contentLength > AI_INVENTORY_VISION_REQUEST_MAX_BYTES
  ) {
    return privateError("AI 图片请求过大，请重新裁剪标签后重试", 413);
  }
  if (
    isInventoryV2CommandPath(path) &&
    Number.isFinite(contentLength) &&
    contentLength > INVENTORY_V2_COMMAND_REQUEST_MAX_BYTES
  ) {
    return privateError("库存 V2 请求过大，请减少备注或标识符后重试", 413);
  }
  if (
    isInventoryLifecycleCommandPath(path) &&
    Number.isFinite(contentLength) &&
    contentLength > INVENTORY_LIFECYCLE_COMMAND_MAX_BYTES
  ) {
    return privateError("商品生命周期请求过大，请减少备注或检查项后重试", 413);
  }
  if (
    isMemoPath(path) &&
    Number.isFinite(contentLength) &&
    contentLength > MEMO_COMMAND_REQUEST_MAX_BYTES
  ) {
    return privateError("备忘录请求过大，请缩短正文后重试", 413);
  }
  try {
    assertRepairDeskPostRequestAllowed({
      headers: request.headers,
      requestOrigin: resolveRepairDeskRequestOrigin({
        headers: request.headers,
        fallbackOrigin: request.nextUrl.origin,
      }),
      allowedContentTypes:
        isToolkitPost || path !== "orders/data/import/preview"
          ? ["application/json"]
          : ["multipart/form-data"],
      requireOrigin: isToolkitPost,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "请求来源无效，请刷新页面后重试";
    return privateError(message, 403);
  }

  let preauthenticatedActor;
  let aiVisionRateLimitConsumed = false;
  if (
    path === "orders/data/import/preview" ||
    path === "ai/order/turn" ||
    path === "ai/order/action" ||
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

  if (path === "ai/vision/extract" && preauthenticatedActor) {
    const capabilities = getAiAssistantCapabilities(preauthenticatedActor);
    if (!capabilities.canUseVisionIntake) {
      const permissionDenied = capabilities.reason === "permission_denied";
      return privateError(
        permissionDenied ? "当前账号不能使用这项 AI 功能" : "AI 小助手当前未开放",
        permissionDenied ? 403 : 404,
      );
    }
    try {
      consumeAiAssistantRequestRateLimit({ actor: preauthenticatedActor });
      aiVisionRateLimitConsumed = true;
    } catch (error) {
      if (error instanceof AiServiceError) return privateError(error.message, error.status);
      return privateError("AI 请求频率检查暂时不可用", 503);
    }
  }

  let body: unknown;
  try {
    body =
      path === "orders/data/import/preview"
        ? await request.formData().catch(() => new FormData())
        : isToolkitPost
          ? await readJsonWithLimit(request, TOOLKIT_POST_MAX_BYTES, true)
          : path === "ai/vision/extract"
            ? await readJsonWithLimit(request, AI_INVENTORY_VISION_REQUEST_MAX_BYTES)
            : path === "ai/order/turn"
              ? await readJsonWithLimit(request, AI_ORDER_TURN_MAX_BYTES)
              : path === "ai/order/action"
                ? await readJsonWithLimit(request, AI_ORDER_ACTION_MAX_BYTES)
                : isInventoryV2CommandPath(path)
                  ? await readJsonWithLimit(request, INVENTORY_V2_COMMAND_REQUEST_MAX_BYTES)
                  : isInventoryLifecycleCommandPath(path)
                    ? await readJsonWithLimit(request, INVENTORY_LIFECYCLE_COMMAND_MAX_BYTES)
                    : isMemoPath(path)
                      ? await readJsonWithLimit(request, MEMO_COMMAND_REQUEST_MAX_BYTES)
                      : await readJson(request);
  } catch (error) {
    if (error instanceof InvalidJsonPayloadError && isToolkitPost) {
      return privateError("工具集请求格式无效，请重试", 400);
    }
    if (error instanceof RequestPayloadTooLargeError) {
      return privateError(
        isToolkitPost
          ? "工具集请求过大，请缩短内容后重试"
          : path === "ai/vision/extract"
            ? "AI 图片请求过大，请重新裁剪标签后重试"
            : path === "ai/order/action"
              ? "AI 订单操作请求过大，请刷新后重试"
              : isInventoryV2CommandPath(path)
                ? "库存 V2 请求过大，请减少备注或标识符后重试"
                : isInventoryLifecycleCommandPath(path)
                  ? "商品生命周期请求过大，请缩短备注或检查项后重试"
                  : isMemoPath(path)
                    ? "备忘录请求过大，请缩短正文后重试"
                    : "AI 查询请求过大，请缩短问题后重试",
        413,
      );
    }
    return privateError("请求内容无法读取，请重试", 400);
  }
  if (isInventoryLifecycleCommandPath(path)) {
    try {
      assertInventoryLifecycleJsonBounds(body);
    } catch (error) {
      if (error instanceof RequestPayloadTooLargeError) {
        return privateError("商品生命周期请求过大，请减少备注或检查项后重试", 413);
      }
      return privateError("商品生命周期请求无效，请重试", 400);
    }
  }
  return handleRepairDeskPost(path, body, preauthenticatedActor, request.signal, {
    aiVisionRateLimitConsumed,
  });
}
