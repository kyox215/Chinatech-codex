import { randomUUID } from "node:crypto";

import type { AuditActor } from "@/lib/repairdesk/types";
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
import {
  assertToolkitFileMetadata,
  normalizeToolkitHttpsUrl,
  normalizeToolkitText,
} from "@/features/toolkit/model/policy";

const resources = new Map<string, ToolkitResource & { targetUrl?: string; uploadToken?: string }>();
const sampleId = "00000000-0000-4000-8000-000000000701";

function ensureSeed() {
  if (resources.has(sampleId)) return;
  resources.set(sampleId, {
    id: sampleId,
    kind: "link",
    state: "published",
    title: "RepairDesk 帮助中心",
    description: "打开官方帮助与操作说明。",
    platform: "Web",
    version: "在线",
    targetUrl: "https://www.chinatech.in/",
    revision: 1,
  });
}

export async function listMockToolkitResources(actor: AuditActor): Promise<ToolkitListResult> {
  ensureSeed();
  const canManage = actor.isPlatformAdmin === true;
  return {
    resources: [...resources.values()]
      .filter((resource) => canManage || resource.state === "published")
      .map(({ uploadToken: _uploadToken, targetUrl: _targetUrl, ...resource }) => ({
        ...resource,
        ...(canManage && resource.kind === "link" && _targetUrl ? { targetUrl: _targetUrl } : {}),
      })),
    canManage,
    unscannedFilesBlocked: true,
  };
}

export async function createMockToolkitLink(input: ToolkitLinkCreateInput, actor: AuditActor) {
  assertMockAdmin(actor);
  const resource: ToolkitResource & { targetUrl: string } = {
    id: randomUUID(),
    kind: "link",
    state: "draft",
    title: normalizeToolkitText(input.title, "工具名称", 120),
    description: input.description?.trim() ?? "",
    platform: input.platform?.trim() ?? "",
    version: input.version?.trim() ?? "",
    targetUrl: normalizeToolkitHttpsUrl(input.url),
    revision: 1,
  };
  resources.set(resource.id, resource);
  return resource;
}

export async function prepareMockToolkitFileUpload(
  input: ToolkitFilePrepareInput,
  actor: AuditActor,
): Promise<ToolkitFilePrepareResult> {
  assertMockAdmin(actor);
  const metadata = assertToolkitFileMetadata(input);
  const resource: ToolkitResource & { uploadToken: string } = {
    id: randomUUID(),
    kind: "file",
    state: "draft",
    title: normalizeToolkitText(input.title, "工具名称", 120),
    description: input.description?.trim() ?? "",
    platform: input.platform?.trim() ?? "",
    version: input.version?.trim() ?? "",
    displayFileName: metadata.fileName,
    mimeType: metadata.mimeType,
    sizeBytes: metadata.sizeBytes,
    uploadState: "pending",
    securityReviewState: "pending",
    revision: 1,
    uploadToken: randomUUID(),
  };
  resources.set(resource.id, resource);
  return {
    resource,
    upload: {
      path: `${resource.id}/${randomUUID()}`,
      token: resource.uploadToken,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    },
  };
}

export async function finalizeMockToolkitFileUpload(
  id: string,
  input: ToolkitFileFinalizeInput,
  actor: AuditActor,
) {
  assertMockAdmin(actor);
  const resource = resources.get(id);
  if (!resource || resource.kind !== "file" || resource.revision !== input.expectedRevision) {
    throw new Error("工具文件已被更新，请刷新后重试");
  }
  resource.uploadState = "ready";
  resource.revision += 1;
  return resource;
}

export async function updateMockToolkitResource(
  id: string,
  input: ToolkitResourceUpdateInput,
  actor: AuditActor,
) {
  assertMockAdmin(actor);
  const resource = resources.get(id);
  if (!resource || resource.revision !== input.expectedRevision)
    throw new Error("工具集内容已被更新，请刷新后重试");
  if (input.title !== undefined)
    resource.title = normalizeToolkitText(input.title, "工具名称", 120);
  if (input.description !== undefined) resource.description = input.description.trim();
  if (input.platform !== undefined) resource.platform = input.platform.trim();
  if (input.version !== undefined) resource.version = input.version.trim();
  if (resource.kind === "link" && input.url !== undefined)
    resource.targetUrl = normalizeToolkitHttpsUrl(input.url);
  resource.revision += 1;
  return resource;
}

export async function updateMockToolkitResourceStatus(
  id: string,
  input: ToolkitResourceStatusInput,
  actor: AuditActor,
) {
  assertMockAdmin(actor);
  const resource = resources.get(id);
  if (!resource || resource.revision !== input.expectedRevision)
    throw new Error("工具集内容已被更新，请刷新后重试");
  if (input.action === "publish") {
    if (resource.kind === "file" && resource.securityReviewState !== "clean") {
      throw new Error("文件尚未完成扫描，当前不可发布");
    }
    resource.state = "published";
  } else if (input.action === "archive") resource.state = "archived";
  else resource.state = "draft";
  resource.revision += 1;
  return resource;
}

export async function accessMockToolkitResource(
  id: string,
  actor: AuditActor,
): Promise<ToolkitAccessResult> {
  if (!actor.id || actor.isSystem === true) throw new Error("未登录或登录已过期");
  ensureSeed();
  const resource = resources.get(id);
  if (!resource || resource.state !== "published") throw new Error("工具不存在或当前不可用");
  if (resource.kind === "link")
    return { kind: "link", url: normalizeToolkitHttpsUrl(resource.targetUrl) };
  return {
    kind: "file",
    url: `https://example.invalid/toolkit/${resource.id}?download=1`,
    fileName: resource.displayFileName,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

function assertMockAdmin(actor: AuditActor) {
  if (actor.isPlatformAdmin !== true) throw new Error("仅平台管理员可以管理工具集");
}
