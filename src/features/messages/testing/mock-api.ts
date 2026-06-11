import type {
  AuditActor,
  MessageTemplate,
  MessageTemplatePreviewInput,
  MessageTemplatePreviewResult,
  MessageTemplateUpdateInput,
  StoreSettings,
  StoreSettingsUpdateInput,
} from "@/lib/repairdesk/types";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  DEFAULT_STORE_SETTINGS,
  getDefaultMessageTemplate,
  withStoreSettingsDefaults,
} from "@/features/messages/model/message-template-defaults";
import {
  createPreviewTemplateContext,
  extractTemplateVariables,
  renderTemplate,
} from "@/features/messages/model/template-renderer";

let storeSettings = withStoreSettingsDefaults({
  ...DEFAULT_STORE_SETTINGS,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const messageTemplates: MessageTemplate[] = DEFAULT_MESSAGE_TEMPLATES.map((template) => ({
  ...template,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}));

export async function getStoreSettings(_actor?: AuditActor): Promise<StoreSettings> {
  return { ...storeSettings };
}

export async function updateStoreSettings(
  input: StoreSettingsUpdateInput,
  _actor?: AuditActor,
): Promise<StoreSettings> {
  const now = new Date().toISOString();
  storeSettings = withStoreSettingsDefaults({
    ...storeSettings,
    ...input,
    default_inventory_warranty_months:
      input.default_inventory_warranty_months ?? storeSettings.default_inventory_warranty_months,
    updated_at: now,
  });
  return { ...storeSettings };
}

export async function listMessageTemplates(_actor?: AuditActor): Promise<MessageTemplate[]> {
  return messageTemplates.map((template) => ({ ...template }));
}

export async function updateMessageTemplate(
  id: string,
  input: MessageTemplateUpdateInput,
  _actor?: AuditActor,
): Promise<MessageTemplate> {
  const now = new Date().toISOString();
  const index = messageTemplates.findIndex((template) => template.id === id);
  if (index === -1) throw new Error("消息模板不存在");
  messageTemplates[index] = {
    ...messageTemplates[index],
    ...input,
    updated_at: now,
  };
  return { ...messageTemplates[index] };
}

export async function resetMessageTemplate(
  id: string,
  _actor?: AuditActor,
): Promise<MessageTemplate> {
  const seed = getDefaultMessageTemplate(id);
  if (!seed) throw new Error("默认模板不存在");
  const now = new Date().toISOString();
  const template = {
    ...seed,
    created_at: now,
    updated_at: now,
  };
  const index = messageTemplates.findIndex((item) => item.id === id);
  if (index === -1) {
    messageTemplates.push(template);
  } else {
    messageTemplates[index] = {
      ...messageTemplates[index],
      ...template,
      updated_at: now,
    };
  }
  return { ...template };
}

export async function renderMessageTemplatePreview(
  input: MessageTemplatePreviewInput,
  _actor?: AuditActor,
): Promise<MessageTemplatePreviewResult> {
  const template = input.templateId
    ? messageTemplates.find((item) => item.id === input.templateId)
    : undefined;
  const bodyTemplate = input.bodyTemplate ?? template?.body_template ?? "";
  const context = {
    ...createPreviewTemplateContext(storeSettings),
    ...(input.context ?? {}),
  };
  return {
    body: renderTemplate(bodyTemplate, context),
    variables: extractTemplateVariables(bodyTemplate),
  };
}
