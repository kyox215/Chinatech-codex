import type {
  AuditActor,
  MessageTemplate,
  MessageTemplatePreviewInput,
  MessageTemplatePreviewResult,
  MessageTemplateUpdateInput,
  StoreSettings,
  StoreSettingsSectionUpdateRequest,
} from "@/lib/repairdesk/types";
import { SettingsMutationError } from "@/features/settings/model/store-settings-errors";
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
import {
  formatWarrantyText,
  normalizeWarrantyMonths,
} from "@/features/orders/model/order-warranty";
import {
  getActiveMockStoreId,
  getCreatedMockStoreProfile,
} from "@/features/stores/testing/mock-api";

const DEFAULT_MOCK_STORE_ID = "00000000-0000-0000-0000-000000000001";

const storeSettingsByStore = new Map<string, StoreSettings>();

const messageTemplates: MessageTemplate[] = DEFAULT_MESSAGE_TEMPLATES.map((template) => ({
  ...template,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}));

export async function getStoreSettings(_actor?: AuditActor): Promise<StoreSettings> {
  const storeId = resolveMockStoreId(_actor);
  return { ...getOrCreateStoreSettings(storeId), store_id: storeId };
}

export async function updateStoreSettings(
  request: StoreSettingsSectionUpdateRequest,
  _actor?: AuditActor,
): Promise<StoreSettings> {
  const storeId = resolveMockStoreId(_actor);
  if (request.expectedStoreId !== storeId) throw SettingsMutationError.contextChanged();
  const current = getOrCreateStoreSettings(storeId);
  if (request.expectedUpdatedAt !== current.updated_at)
    throw SettingsMutationError.versionConflict();
  const now = new Date(
    Math.max(Date.now(), new Date(current.updated_at).getTime() + 1),
  ).toISOString();
  const defaultOrderWarrantyMonths = normalizeWarrantyMonths(
    request.section === "rules"
      ? request.input.default_order_warranty_months
      : current.default_order_warranty_months,
  );
  const next = withStoreSettingsDefaults({
    ...current,
    ...request.input,
    default_order_warranty_months: defaultOrderWarrantyMonths,
    default_order_warranty_text: formatWarrantyText(defaultOrderWarrantyMonths),
    default_inventory_warranty_months:
      request.section === "rules"
        ? request.input.default_inventory_warranty_months
        : current.default_inventory_warranty_months,
    new_order_entry_mode:
      request.section === "rules" && request.input.new_order_entry_mode !== undefined
        ? request.input.new_order_entry_mode
        : current.new_order_entry_mode,
    updated_at: now,
    store_id: storeId,
  });
  storeSettingsByStore.set(storeId, next);
  return { ...next };
}

function getOrCreateStoreSettings(storeId: string) {
  const existing = storeSettingsByStore.get(storeId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const storeProfile = getCreatedMockStoreProfile(storeId);
  const created = withStoreSettingsDefaults({
    ...DEFAULT_STORE_SETTINGS,
    store_id: storeId,
    store_name: storeProfile?.name ?? DEFAULT_STORE_SETTINGS.store_name,
    store_address: storeProfile?.address ?? DEFAULT_STORE_SETTINGS.store_address,
    print_footer: storeProfile?.name ? `Grazie per aver scelto ${storeProfile.name}.` : "",
    message_signature: storeProfile?.name ?? "",
    new_order_entry_mode:
      process.env.REPAIRDESK_E2E_NEW_ORDER_ENTRY_MODE === "simple"
        ? "simple"
        : DEFAULT_STORE_SETTINGS.new_order_entry_mode,
    created_at: now,
    updated_at: now,
  });
  storeSettingsByStore.set(storeId, created);
  return created;
}

function resolveMockStoreId(actor?: AuditActor) {
  return actor?.storeId ?? getActiveMockStoreId() ?? DEFAULT_MOCK_STORE_ID;
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
  const storeId = resolveMockStoreId(_actor);
  const context = {
    ...createPreviewTemplateContext(getOrCreateStoreSettings(storeId)),
    ...(input.context ?? {}),
  };
  return {
    body: renderTemplate(bodyTemplate, context),
    variables: extractTemplateVariables(bodyTemplate),
  };
}
