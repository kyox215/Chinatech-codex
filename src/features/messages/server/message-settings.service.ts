import type {
  AuditActor,
  MessageTemplatePreviewInput,
  MessageTemplatePreviewResult,
  MessageTemplateUpdateInput,
  StoreSettingsUpdateInput,
} from "@/lib/repairdesk/types";
import { writeAuditLog } from "@/server/audit";
import { assertStaffRole } from "@/server/auth-context";
import {
  createPreviewTemplateContext,
  extractTemplateVariables,
  renderTemplate,
} from "@/features/messages/model/template-renderer";
import { requireStoreIdFromActor } from "@/server/repairdesk-shared";
import {
  getMessageTemplate,
  getStoreSettings as getStoreSettingsRow,
  listMessageTemplates as listMessageTemplatesRows,
  resetMessageTemplateRow,
  updateMessageTemplateRow,
  updateStoreSettingsRow,
} from "./message-settings.repository";

export async function getStoreSettings(actor?: AuditActor) {
  return getStoreSettingsRow(requireStoreIdFromActor(actor, "读取店铺设置"));
}

export async function listMessageTemplates(actor?: AuditActor) {
  return listMessageTemplatesRows(requireStoreIdFromActor(actor, "读取消息模板"));
}

export async function updateStoreSettings(input: StoreSettingsUpdateInput, actor: AuditActor) {
  assertStaffRole(actor, ["owner", "manager"]);
  const storeId = requireStoreIdFromActor(actor, "保存店铺设置");
  const before = await getStoreSettingsRow(storeId);
  const after = await updateStoreSettingsRow(input, actor.id, storeId);
  await writeAuditLog({
    actor,
    action: "update",
    entityType: "store_settings",
    entityId: after.id,
    before: asRecord(before),
    after: asRecord(after),
    metadata: { input },
  });
  return after;
}

export async function updateMessageTemplate(
  id: string,
  input: MessageTemplateUpdateInput,
  actor: AuditActor,
) {
  assertStaffRole(actor, ["owner", "manager"]);
  const storeId = requireStoreIdFromActor(actor, "保存消息模板");
  const before = await getMessageTemplate(id, storeId);
  if (!before) throw new Error("消息模板不存在");
  const after = await updateMessageTemplateRow(id, input, actor.id, storeId);
  await writeAuditLog({
    actor,
    action: "update",
    entityType: "message_template",
    entityId: id,
    before: asRecord(before),
    after: asRecord(after),
    metadata: { input },
  });
  return after;
}

export async function resetMessageTemplate(id: string, actor: AuditActor) {
  assertStaffRole(actor, ["owner", "manager"]);
  const storeId = requireStoreIdFromActor(actor, "恢复消息模板");
  const before = await getMessageTemplate(id, storeId);
  if (!before) throw new Error("消息模板不存在");
  const after = await resetMessageTemplateRow(id, actor.id, storeId);
  await writeAuditLog({
    actor,
    action: "reset",
    entityType: "message_template",
    entityId: id,
    before: asRecord(before),
    after: asRecord(after),
    metadata: { defaultRestored: true },
  });
  return after;
}

export async function renderMessageTemplatePreview(
  input: MessageTemplatePreviewInput,
  actor?: AuditActor,
): Promise<MessageTemplatePreviewResult> {
  const storeId = requireStoreIdFromActor(actor, "预览消息模板");
  const store = await getStoreSettingsRow(storeId);
  const template = input.templateId
    ? await getMessageTemplate(input.templateId, storeId)
    : undefined;
  const bodyTemplate = input.bodyTemplate ?? template?.body_template ?? "";
  const context = {
    ...createPreviewTemplateContext(store),
    ...(input.context ?? {}),
  };

  return {
    body: renderTemplate(bodyTemplate, context),
    variables: extractTemplateVariables(bodyTemplate),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : { value };
}
