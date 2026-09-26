import { NextResponse, type NextRequest } from "next/server";

import { BUYBACK_EVIDENCE_HOSTED_REQUEST_MAX_BYTES } from "@/features/buyback/model/buyback-evidence-policy";
import { isRepairDeskToolkitEnabled } from "@/features/toolkit/model/toolkit-feature";
import {
  assertRepairDeskPostRequestAllowed,
  resolveRepairDeskRequestOrigin,
} from "@/server/api/repairdesk-request-guard";
import {
  INVENTORY_LIFECYCLE_COMMAND_MAX_BYTES,
  INVENTORY_V2_COMMAND_REQUEST_MAX_BYTES,
  MEMO_COMMAND_REQUEST_MAX_BYTES,
  MEMO_EDITOR_REQUEST_MAX_BYTES,
} from "@/server/api/repairdesk-request-limits";
import {
  getRepairDeskPostActor,
  handleRepairDeskGet,
  handleRepairDeskPost,
} from "@/server/api/repairdesk-router";
import { ForbiddenError, UnauthorizedError } from "@/server/auth-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

const ORDER_DATA_MULTIPART_MAX_BYTES = 4_400_000;
const TOOLKIT_POST_MAX_BYTES = 64 * 1024;
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

function memoRequestMaxBytes(path: string) {
  return path === "memos/create" || path === "memos/update"
    ? MEMO_EDITOR_REQUEST_MAX_BYTES
    : MEMO_COMMAND_REQUEST_MAX_BYTES;
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
  if (path.startsWith("ai/")) return privateError("接口不存在", 404);
  if (path.startsWith("toolkit/") && !isRepairDeskToolkitEnabled()) {
    return privateError("工具集当前未开放", 404);
  }
  return handleRepairDeskGet(path, request.nextUrl.searchParams);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const path = (await context.params).path?.join("/") ?? "";
  if (path.startsWith("ai/")) return privateError("接口不存在", 404);
  const isToolkitPost = path.startsWith("toolkit/");
  if (isToolkitPost && !isRepairDeskToolkitEnabled()) {
    return privateError("工具集当前未开放", 404);
  }
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
    contentLength > memoRequestMaxBytes(path)
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
  if (path === "orders/data/import/preview") {
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
        : isToolkitPost
          ? await readJsonWithLimit(request, TOOLKIT_POST_MAX_BYTES, true)
          : isInventoryV2CommandPath(path)
            ? await readJsonWithLimit(request, INVENTORY_V2_COMMAND_REQUEST_MAX_BYTES)
            : isInventoryLifecycleCommandPath(path)
              ? await readJsonWithLimit(request, INVENTORY_LIFECYCLE_COMMAND_MAX_BYTES)
              : isMemoPath(path)
                ? await readJsonWithLimit(request, memoRequestMaxBytes(path))
                : await readJson(request);
  } catch (error) {
    if (error instanceof InvalidJsonPayloadError && isToolkitPost) {
      return privateError("工具集请求格式无效，请重试", 400);
    }
    if (error instanceof RequestPayloadTooLargeError) {
      return privateError(
        isToolkitPost
          ? "工具集请求过大，请缩短内容后重试"
          : isInventoryV2CommandPath(path)
            ? "库存 V2 请求过大，请减少备注或标识符后重试"
            : isInventoryLifecycleCommandPath(path)
              ? "商品生命周期请求过大，请缩短备注或检查项后重试"
              : isMemoPath(path)
                ? "备忘录请求过大，请缩短正文后重试"
                : "请求过大，请缩短内容后重试",
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
  return handleRepairDeskPost(path, body, preauthenticatedActor, request.signal);
}
