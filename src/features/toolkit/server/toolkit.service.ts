import { randomUUID } from "node:crypto";

import type { AuditActor } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";
import { assertRecentLifecycleAal2 } from "@/features/stores/server/store-lifecycle-auth";
import { isPlatformOwnerEmail } from "@/shared/config/platform-authority";
import { getSupabaseAdmin } from "@/server/supabase";
import { writeAuditLog } from "@/server/audit";
import {
  assertToolkitFileMetadata,
  assertToolkitStorageMetadata,
  isToolkitFilePublicationAllowed,
  normalizeToolkitFileName,
  normalizeToolkitHttpsUrl,
  normalizeToolkitText,
  TOOLKIT_DOWNLOAD_TTL_SECONDS,
  TOOLKIT_FILE_BUCKET,
} from "@/features/toolkit/model/policy";
import type {
  ToolkitAccessResult,
  ToolkitFileFinalizeInput,
  ToolkitFilePrepareInput,
  ToolkitFilePrepareResult,
  ToolkitLinkCreateInput,
  ToolkitListResult,
  ToolkitResource,
  ToolkitResourceStatusInput,
  ToolkitResourceUpdateInput,
} from "@/features/toolkit/model/contracts";

type DbRecord = Record<string, unknown>;

const TOOLKIT_RESOURCE_COLUMNS = [
  "id",
  "kind",
  "state",
  "title",
  "description",
  "platform",
  "version",
  "display_file_name",
  "mime_type",
  "size_bytes",
  "target_url",
  "storage_bucket",
  "storage_path",
  "upload_state",
  "security_review_state",
  "provenance_note",
  "trust_attestation",
  "revision",
  "created_at",
  "updated_at",
].join(",");
const TOOLKIT_RANGE_TIMEOUT_MS = 10_000;
const TOOLKIT_SMALL_RANGE_MAX_BYTES = 512;
const TOOLKIT_RANGE_MAX_READ_BYTES = TOOLKIT_SMALL_RANGE_MAX_BYTES + 1;

export class ToolkitConflictError extends Error {
  readonly status = 409;
  readonly code = "toolkit_revision_conflict";

  constructor(message = "工具集内容已被其他管理员更新，请刷新后重试") {
    super(message);
    this.name = "ToolkitConflictError";
  }
}

export function assertToolkitPlatformAdmin(actor: AuditActor) {
  if (
    actor.isPlatformAdmin !== true ||
    actor.emailVerified !== true ||
    !isPlatformOwnerEmail(actor.email)
  ) {
    throw new ForbiddenError("仅平台管理员可以管理工具集");
  }
  assertRecentLifecycleAal2(actor);
  return actor;
}

export function assertToolkitConsumer(actor: AuditActor) {
  if (
    actor.isSystem === true ||
    actor.emailVerified !== true ||
    !actor.id ||
    (actor.isPlatformAdmin !== true && !actor.storeId)
  ) {
    throw new ForbiddenError("当前账号尚未加入可用店铺");
  }
  return actor;
}

export async function listToolkitResources(actor: AuditActor): Promise<ToolkitListResult> {
  assertToolkitConsumer(actor);
  const admin = getSupabaseAdmin();
  const canManage = actor.isPlatformAdmin === true;
  let query = admin
    .from("toolkit_resources")
    .select(TOOLKIT_RESOURCE_COLUMNS)
    .order("updated_at", { ascending: false });
  if (!canManage) query = query.eq("state", "published");
  const { data, error } = await query;
  if (error) throw new Error("读取工具集失败");
  const resources = ((data ?? []) as unknown as DbRecord[])
    .filter((row) => canManage || isPublishedConsumerResource(row))
    .map((row) => toolkitResourceFromRow(row, canManage));
  return {
    resources,
    canManage,
    unscannedFilesBlocked: true,
  };
}

export async function createToolkitLink(
  input: ToolkitLinkCreateInput,
  actor: AuditActor,
): Promise<ToolkitResource> {
  assertToolkitPlatformAdmin(actor);
  const row = {
    id: randomUUID(),
    kind: "link",
    state: "draft",
    title: normalizeToolkitText(input.title, "工具名称", 120),
    description: normalizeDisplayText(input.description, 1000),
    platform: normalizeDisplayText(input.platform, 80),
    version: normalizeDisplayText(input.version, 80),
    target_url: normalizeToolkitHttpsUrl(input.url),
    upload_state: "not_applicable",
    security_review_state: "not_required",
    revision: 1,
    created_by: actor.id,
    updated_by: actor.id,
  };
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("toolkit_resources")
    .insert(row)
    .select(TOOLKIT_RESOURCE_COLUMNS)
    .single();
  if (error) throw new Error("创建工具链接失败");
  await writeToolkitAudit(actor, "toolkit_create_link", String(row.id));
  return toolkitResourceFromRow(data as unknown as DbRecord, true);
}

export async function prepareToolkitFileUpload(
  input: ToolkitFilePrepareInput,
  actor: AuditActor,
): Promise<ToolkitFilePrepareResult> {
  assertToolkitPlatformAdmin(actor);
  const metadata = assertToolkitFileMetadata(input);
  const id = randomUUID();
  const path = `${id}/${randomUUID()}`;
  const now = new Date().toISOString();
  const admin = getSupabaseAdmin();
  const { data: inserted, error: insertError } = await admin
    .from("toolkit_resources")
    .insert({
      id,
      kind: "file",
      state: "draft",
      title: normalizeToolkitText(input.title, "工具名称", 120),
      description: normalizeDisplayText(input.description, 1000),
      platform: normalizeDisplayText(input.platform, 80),
      version: normalizeDisplayText(input.version, 80),
      display_file_name: metadata.fileName,
      mime_type: metadata.mimeType,
      size_bytes: metadata.sizeBytes,
      storage_bucket: TOOLKIT_FILE_BUCKET,
      storage_path: path,
      upload_state: "pending",
      security_review_state: "pending",
      revision: 1,
      created_by: actor.id,
      updated_by: actor.id,
      created_at: now,
      updated_at: now,
    })
    .select(TOOLKIT_RESOURCE_COLUMNS)
    .single();
  if (insertError) throw new Error("准备工具文件失败");

  const { data: signed, error: signedError } = await admin.storage
    .from(TOOLKIT_FILE_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (signedError || !signed?.token) {
    await admin.from("toolkit_resources").delete().eq("id", id);
    throw new Error("生成工具文件上传凭证失败");
  }
  await writeToolkitAudit(actor, "toolkit_prepare_file", id);
  return {
    resource: toolkitResourceFromRow(inserted as unknown as DbRecord, true),
    upload: {
      path: signed.path,
      token: signed.token,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    },
  };
}

export async function finalizeToolkitFileUpload(
  id: string,
  input: ToolkitFileFinalizeInput,
  actor: AuditActor,
): Promise<ToolkitResource> {
  assertToolkitPlatformAdmin(actor);
  const admin = getSupabaseAdmin();
  const row = await readToolkitResource(admin, id);
  assertToolkitFileDraft(row);
  assertExpectedRevision(row, input.expectedRevision);
  const path = requiredString(row.storage_path);
  const bucket = requiredString(row.storage_bucket) || TOOLKIT_FILE_BUCKET;
  const infoResult = await admin.storage.from(bucket).info(path);
  if (infoResult.error || !infoResult.data) {
    await markToolkitUploadQuarantined(admin, id, input.expectedRevision, actor.id);
    await admin.storage
      .from(bucket)
      .remove([path])
      .catch(() => undefined);
    throw new Error("工具文件尚未完成上传或无法读取存储元数据");
  }
  const info = infoResult.data as unknown as DbRecord;
  const size = Number(info.size ?? info.size_bytes);
  const storageMime = String(info.mimetype ?? info.mimeType ?? "");
  let first: Uint8Array;
  let last: Uint8Array;
  try {
    first = await readToolkitStorageRange(admin, bucket, path, "bytes=0-511", size);
    last =
      size > 512
        ? await readToolkitStorageRange(
            admin,
            bucket,
            path,
            `bytes=${Math.max(0, size - 512)}-${size - 1}`,
            size,
          )
        : first;
  } catch {
    await markToolkitUploadQuarantined(admin, id, input.expectedRevision, actor.id);
    await admin.storage
      .from(bucket)
      .remove([path])
      .catch(() => undefined);
    throw new Error("工具文件校验失败，当前仍不可发布");
  }
  try {
    assertToolkitStorageMetadata({
      fileName: requiredString(row.display_file_name),
      mimeType: requiredString(row.mime_type),
      sizeBytes: Number(row.size_bytes),
      storageSizeBytes: size,
      storageMimeType: storageMime,
      header: new Uint8Array([...first, ...last]),
    });
  } catch (error) {
    await markToolkitUploadQuarantined(admin, id, input.expectedRevision, actor.id);
    await admin.storage
      .from(bucket)
      .remove([path])
      .catch(() => undefined);
    throw error;
  }
  const { data, error } = await admin
    .from("toolkit_resources")
    .update({
      upload_state: "ready",
      revision: input.expectedRevision + 1,
      updated_by: actor.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("revision", input.expectedRevision)
    .select(TOOLKIT_RESOURCE_COLUMNS)
    .maybeSingle();
  if (error) throw new Error("完成工具文件校验失败");
  if (!data) throw new ToolkitConflictError();
  await writeToolkitAudit(actor, "toolkit_finalize_file", id);
  return toolkitResourceFromRow(data as unknown as DbRecord, true);
}

export async function updateToolkitResource(
  id: string,
  input: ToolkitResourceUpdateInput,
  actor: AuditActor,
): Promise<ToolkitResource> {
  assertToolkitPlatformAdmin(actor);
  const admin = getSupabaseAdmin();
  const current = await readToolkitResource(admin, id);
  assertExpectedRevision(current, input.expectedRevision);
  const patch: DbRecord = {
    revision: input.expectedRevision + 1,
    updated_by: actor.id,
    updated_at: new Date().toISOString(),
  };
  if (input.title !== undefined) patch.title = normalizeToolkitText(input.title, "工具名称", 120);
  if (input.description !== undefined)
    patch.description = normalizeDisplayText(input.description, 1000);
  if (input.platform !== undefined) patch.platform = normalizeDisplayText(input.platform, 80);
  if (input.version !== undefined) patch.version = normalizeDisplayText(input.version, 80);
  if (current.kind === "link" && current.state === "published" && input.url !== undefined) {
    throw new ForbiddenError("已发布网页工具不能直接替换链接，请先归档后恢复为草稿");
  }
  if (current.kind === "link" && input.url !== undefined)
    patch.target_url = normalizeToolkitHttpsUrl(input.url);
  if (input.provenanceNote !== undefined)
    patch.provenance_note = normalizeOptionalText(input.provenanceNote, 1000);
  if (input.trustAttestation !== undefined)
    patch.trust_attestation = input.trustAttestation === true;
  const { data, error } = await admin
    .from("toolkit_resources")
    .update(patch)
    .eq("id", id)
    .eq("revision", input.expectedRevision)
    .select(TOOLKIT_RESOURCE_COLUMNS)
    .maybeSingle();
  if (error) throw new Error("更新工具集失败");
  if (!data) throw new ToolkitConflictError();
  await writeToolkitAudit(actor, "toolkit_update", id);
  return toolkitResourceFromRow(data as unknown as DbRecord, true);
}

export async function updateToolkitResourceStatus(
  id: string,
  input: ToolkitResourceStatusInput,
  actor: AuditActor,
): Promise<ToolkitResource> {
  assertToolkitPlatformAdmin(actor);
  const admin = getSupabaseAdmin();
  const current = await readToolkitResource(admin, id);
  assertExpectedRevision(current, input.expectedRevision);
  if (input.action !== "publish" && input.action !== "archive" && input.action !== "restore") {
    throw new ForbiddenError("工具状态操作无效");
  }
  const currentState = requiredString(current.state);
  if (input.action === "publish") {
    if (currentState !== "draft") throw new ForbiddenError("只有草稿工具可以发布");
    if (current.kind === "link" && !normalizeToolkitHttpsUrl(current.target_url)) {
      throw new ForbiddenError("工具链接未通过 HTTPS 校验");
    }
    if (current.kind === "file") {
      if (requiredString(current.upload_state) !== "ready")
        throw new ForbiddenError("文件尚未完成上传校验");
      if (
        !isToolkitFilePublicationAllowed({
          securityReviewState: requiredString(current.security_review_state) as
            | "not_required"
            | "pending"
            | "clean",
          provenanceNote: current.provenance_note as string | null,
          trustAttestation: Boolean(current.trust_attestation),
        })
      ) {
        throw new ForbiddenError("文件尚未完成扫描，当前不可发布；请先接入获批准的扫描流程");
      }
    }
  } else if (input.action === "archive") {
    if (currentState === "archived") throw new ForbiddenError("工具已经归档");
  } else if (currentState !== "archived") {
    throw new ForbiddenError("只有已归档工具可以恢复");
  }
  const nextState =
    input.action === "publish" ? "published" : input.action === "archive" ? "archived" : "draft";
  const patch: DbRecord = {
    state: nextState,
    revision: input.expectedRevision + 1,
    updated_by: actor.id,
    updated_at: new Date().toISOString(),
  };
  if (input.provenanceNote !== undefined)
    patch.provenance_note = normalizeOptionalText(input.provenanceNote, 1000);
  if (input.trustAttestation !== undefined)
    patch.trust_attestation = input.trustAttestation === true;
  const { data, error } = await admin
    .from("toolkit_resources")
    .update(patch)
    .eq("id", id)
    .eq("revision", input.expectedRevision)
    .select(TOOLKIT_RESOURCE_COLUMNS)
    .maybeSingle();
  if (error) throw new Error("更新工具状态失败");
  if (!data) throw new ToolkitConflictError();
  await writeToolkitAudit(actor, `toolkit_${input.action}`, id);
  return toolkitResourceFromRow(data as unknown as DbRecord, true);
}

export async function accessToolkitResource(
  id: string,
  actor: AuditActor,
): Promise<ToolkitAccessResult> {
  assertToolkitConsumer(actor);
  const admin = getSupabaseAdmin();
  const row = await readToolkitResource(admin, id);
  if (!isPublishedConsumerResource(row)) throw new Error("工具不存在或当前不可用");
  if (row.kind === "link") {
    return { kind: "link", url: normalizeToolkitHttpsUrl(row.target_url) };
  }
  if (requiredString(row.upload_state) !== "ready") throw new Error("工具文件当前不可用");
  const bucket = requiredString(row.storage_bucket) || TOOLKIT_FILE_BUCKET;
  const path = requiredString(row.storage_path);
  const signed = await admin.storage
    .from(bucket)
    .createSignedUrl(path, TOOLKIT_DOWNLOAD_TTL_SECONDS, {
      download: normalizeToolkitFileName(row.display_file_name),
    });
  if (signed.error || !signed.data?.signedUrl) throw new Error("生成工具下载链接失败");
  return {
    kind: "file",
    url: signed.data.signedUrl,
    fileName: normalizeToolkitFileName(row.display_file_name),
    expiresAt: new Date(Date.now() + TOOLKIT_DOWNLOAD_TTL_SECONDS * 1000).toISOString(),
  };
}

async function readToolkitResource(admin: ReturnType<typeof getSupabaseAdmin>, id: string) {
  const { data, error } = await admin
    .from("toolkit_resources")
    .select(TOOLKIT_RESOURCE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("读取工具集失败");
  if (!data) throw new Error("工具不存在或当前不可用");
  return data as unknown as DbRecord;
}

function assertToolkitFileDraft(row: DbRecord) {
  if (row.kind !== "file" || row.state !== "draft" || row.upload_state !== "pending") {
    throw new ForbiddenError("工具文件当前不能完成上传");
  }
}

function assertExpectedRevision(row: DbRecord, expectedRevision: number) {
  if (!Number.isInteger(expectedRevision) || Number(row.revision) !== expectedRevision) {
    throw new ToolkitConflictError();
  }
}

async function markToolkitUploadQuarantined(
  admin: ReturnType<typeof getSupabaseAdmin>,
  id: string,
  revision: number,
  actorId?: string,
) {
  await admin
    .from("toolkit_resources")
    .update({
      upload_state: "quarantined",
      revision: revision + 1,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("revision", revision);
}

function isPublishedConsumerResource(row: DbRecord) {
  if (row.state !== "published") return false;
  if (row.kind === "link") return typeof row.target_url === "string" && row.target_url.length > 0;
  return (
    row.kind === "file" &&
    row.upload_state === "ready" &&
    isToolkitFilePublicationAllowed({
      securityReviewState: String(row.security_review_state) as
        | "not_required"
        | "pending"
        | "clean",
    })
  );
}

function toolkitResourceFromRow(row: DbRecord, includePrivateState: boolean): ToolkitResource {
  return {
    id: requiredString(row.id),
    kind: row.kind as ToolkitResource["kind"],
    ...(includePrivateState ? { state: row.state as ToolkitResource["state"] } : {}),
    title: requiredString(row.title),
    description: String(row.description ?? ""),
    platform: String(row.platform ?? ""),
    version: String(row.version ?? ""),
    ...(row.display_file_name
      ? { displayFileName: normalizeToolkitFileName(row.display_file_name) }
      : {}),
    ...(row.mime_type ? { mimeType: String(row.mime_type) } : {}),
    ...(row.size_bytes !== null && row.size_bytes !== undefined
      ? { sizeBytes: Number(row.size_bytes) }
      : {}),
    ...(includePrivateState && row.kind === "link" && typeof row.target_url === "string"
      ? { targetUrl: normalizeToolkitHttpsUrl(row.target_url) }
      : {}),
    ...(includePrivateState && row.upload_state
      ? { uploadState: row.upload_state as ToolkitResource["uploadState"] }
      : {}),
    ...(includePrivateState && row.security_review_state
      ? { securityReviewState: row.security_review_state as ToolkitResource["securityReviewState"] }
      : {}),
    ...(includePrivateState && row.revision ? { revision: Number(row.revision) } : {}),
    ...(row.created_at ? { createdAt: String(row.created_at) } : {}),
    ...(row.updated_at ? { updatedAt: String(row.updated_at) } : {}),
  };
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  return normalizeToolkitText(value, "字段", maxLength);
}

function normalizeDisplayText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return "";
  return normalizeToolkitText(value, "字段", maxLength);
}

function requiredString(value: unknown) {
  return typeof value === "string" ? value : String(value ?? "");
}

async function writeToolkitAudit(actor: AuditActor, action: string, entityId: string) {
  await writeAuditLog({
    actor,
    action,
    entityType: "toolkit_resource",
    entityId,
    metadata: { source: "toolkit" },
  });
}

async function readToolkitStorageRange(
  admin: ReturnType<typeof getSupabaseAdmin>,
  bucket: string,
  path: string,
  range: string,
  expectedObjectSize: number,
) {
  const signed = await admin.storage.from(bucket).createSignedUrl(path, 60);
  if (signed.error || !signed.data?.signedUrl) throw new Error("工具文件校验失败，当前仍不可发布");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TOOLKIT_RANGE_TIMEOUT_MS);
  try {
    const response = await fetch(signed.data.signedUrl, {
      headers: { Range: range },
      cache: "no-store",
      signal: controller.signal,
    });
    if (
      !response.ok ||
      !response.body ||
      !isToolkitRangeResponseAcceptable(response, range, expectedObjectSize)
    ) {
      throw new Error("工具文件校验失败，当前仍不可发布");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (total < TOOLKIT_RANGE_MAX_READ_BYTES) {
        const next = await reader.read();
        if (next.done) break;
        const remaining = Math.min(next.value.byteLength, TOOLKIT_RANGE_MAX_READ_BYTES - total);
        chunks.push(next.value.slice(0, remaining));
        total += remaining;
        if (remaining < next.value.byteLength) break;
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    if (!isToolkitRangeResponseAcceptable(response, range, expectedObjectSize, result.byteLength)) {
      throw new Error("工具文件校验失败，当前仍不可发布");
    }
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function isToolkitRangeResponseAcceptable(
  response: Pick<Response, "status" | "headers">,
  requestedRange: string,
  expectedObjectSize: number,
  bodyLength?: number,
) {
  if (!Number.isInteger(expectedObjectSize) || expectedObjectSize < 1) return false;
  if (response.status === 200) {
    const contentLength = Number(response.headers.get("content-length"));
    const valid =
      expectedObjectSize <= TOOLKIT_SMALL_RANGE_MAX_BYTES &&
      Number.isInteger(contentLength) &&
      contentLength === expectedObjectSize;
    return valid && (bodyLength === undefined || bodyLength === expectedObjectSize);
  }
  if (response.status !== 206) return false;
  const contentRange = parseContentRange(response.headers.get("content-range"));
  const requested = parseRequestedRange(requestedRange);
  if (!contentRange || !requested) return false;
  const expectedBodyLength = contentRange.end - contentRange.start + 1;
  const valid =
    contentRange.start === requested.start &&
    contentRange.total === expectedObjectSize &&
    contentRange.end === Math.min(requested.end, expectedObjectSize - 1) &&
    contentRange.total > contentRange.end;
  return valid && (bodyLength === undefined || bodyLength === expectedBodyLength);
}

function parseRequestedRange(value: string) {
  const match = /^bytes=(\d+)-(\d+)$/.exec(value.trim());
  if (!match) return undefined;
  return { start: Number(match[1]), end: Number(match[2]) };
}

function parseContentRange(value: string | null) {
  const match = /^bytes\s+(\d+)-(\d+)\/(\d+)$/i.exec(value?.trim() ?? "");
  if (!match) return undefined;
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || !Number.isInteger(total) || total < 1) {
    return undefined;
  }
  return { start, end, total };
}
