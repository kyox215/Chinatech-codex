import type {
  MessageTemplate,
  MessageTemplateUpdateInput,
  StoreSettings,
  StoreSettingsUpdateInput,
} from "@/lib/repairdesk/types";
import { getSupabaseAdmin } from "@/server/supabase";
import { type DbRecord, fail } from "@/server/repairdesk-shared";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  DEFAULT_STORE_SETTINGS,
  getDefaultMessageTemplate,
  templateIdForStore,
  withStoreSettingsDefaults,
} from "@/features/messages/model/message-template-defaults";
import { normalizePublicBaseUrl } from "@/entities/store/model/store-output-identity";
import {
  formatWarrantyText,
  normalizeWarrantyMonths,
} from "@/features/orders/model/order-warranty";
import { normalizeNewOrderEntryMode } from "@/entities/store/model/store-setting-defaults";

const DEFAULT_STORE_ID = "00000000-0000-0000-0000-000000000001";

export async function getStoreSettings(
  storeId: string,
  fallbackStoreName?: string,
): Promise<StoreSettings> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("store_settings")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();
  fail(error, "读取消息模板失败");
  if (data) return storeSettingsFromRow(data as DbRecord);

  const now = new Date().toISOString();
  const storeName = fallbackStoreName?.trim() ?? "";
  const defaults = withStoreSettingsDefaults({
    ...DEFAULT_STORE_SETTINGS,
    id: storeSettingsIdForStore(storeId),
    store_id: storeId,
    store_name: storeName,
    print_footer: storeName ? `Grazie per aver scelto ${storeName}.` : "",
    message_signature: storeName,
    created_at: now,
    updated_at: now,
  });
  const { data: inserted, error: insertError } = await supabase
    .from("store_settings")
    .insert({
      id: defaults.id,
      store_id: storeId,
      store_name: defaults.store_name,
      store_address: defaults.store_address,
      store_phone: defaults.store_phone,
      store_whatsapp: defaults.store_whatsapp,
      store_email: defaults.store_email,
      public_base_url: defaults.public_base_url,
      default_order_warranty_text: defaults.default_order_warranty_text,
      default_order_warranty_months: defaults.default_order_warranty_months,
      default_inventory_warranty_months: defaults.default_inventory_warranty_months,
      new_order_entry_mode: defaults.new_order_entry_mode,
      print_footer: defaults.print_footer,
      message_signature: defaults.message_signature,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  fail(insertError, "初始化店铺设置失败");
  return storeSettingsFromRow(inserted as DbRecord);
}

export async function updateStoreSettingsRow(request: {
  input: StoreSettingsUpdateInput;
  expectedUpdatedAt: string;
  actorId?: string;
  storeId?: string;
}): Promise<StoreSettings | null> {
  const resolvedStoreId = requireRepositoryStoreId(request.storeId, "保存店铺设置");
  const supabase = getSupabaseAdmin();
  const now = nextSettingsUpdatedAt(request.expectedUpdatedAt);
  const update = sanitizeStoreSettingsInput(request.input);
  const { data, error } = await supabase
    .from("store_settings")
    .update({
      ...update,
      updated_by: request.actorId ?? null,
      updated_at: now,
    })
    .eq("store_id", resolvedStoreId)
    .eq("updated_at", request.expectedUpdatedAt)
    .select("*")
    .maybeSingle();
  fail(error, "保存店铺设置失败");
  return data ? storeSettingsFromRow(data as DbRecord) : null;
}

export async function listMessageTemplates(storeId: string): Promise<MessageTemplate[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("message_templates")
    .select("*")
    .eq("store_id", storeId)
    .order("domain", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  fail(error, "读取消息模板失败");
  const rows = ((data ?? []) as DbRecord[]).map(messageTemplateFromRow);
  if (rows.length) return rows;

  return seedDefaultTemplatesForStore(storeId);
}

export async function getMessageTemplate(
  id: string,
  storeId?: string,
): Promise<MessageTemplate | undefined> {
  const resolvedStoreId = requireRepositoryStoreId(storeId, "读取消息模板");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("message_templates")
    .select("*")
    .eq("id", id)
    .eq("store_id", resolvedStoreId)
    .maybeSingle();
  fail(error, "读取店铺设置失败");
  if (data) return messageTemplateFromRow(data as DbRecord);
  const seed = getDefaultMessageTemplate(id);
  return seed ? defaultTemplateFromSeed(seed, resolvedStoreId) : undefined;
}

export async function updateMessageTemplateRow(
  id: string,
  input: MessageTemplateUpdateInput,
  actorId?: string,
  storeId?: string,
): Promise<MessageTemplate> {
  const resolvedStoreId = requireRepositoryStoreId(storeId, "保存消息模板");
  const update = sanitizeMessageTemplateInput(input);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  await ensureTemplateExists(id, resolvedStoreId);
  const { data, error } = await supabase
    .from("message_templates")
    .update({
      ...update,
      updated_by: actorId ?? null,
      updated_at: now,
    })
    .eq("id", id)
    .eq("store_id", resolvedStoreId)
    .select("*")
    .single();
  fail(error, "保存消息模板失败");
  return messageTemplateFromRow(data as DbRecord);
}

export async function resetMessageTemplateRow(
  id: string,
  actorId?: string,
  storeId?: string,
): Promise<MessageTemplate> {
  const resolvedStoreId = requireRepositoryStoreId(storeId, "恢复消息模板");
  const seed = getDefaultMessageTemplate(id);
  if (!seed) throw new Error("默认模板不存在");

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const storeTemplate = defaultTemplateFromSeed(seed, resolvedStoreId);
  const { data, error } = await supabase
    .from("message_templates")
    .upsert({
      ...storeTemplate,
      updated_by: actorId ?? null,
      updated_at: now,
    })
    .select("*")
    .single();
  fail(error, "恢复默认模板失败");
  return messageTemplateFromRow(data as DbRecord);
}

function sanitizeStoreSettingsInput(input: StoreSettingsUpdateInput) {
  const update: StoreSettingsUpdateInput = {};
  if (input.store_name !== undefined) {
    const storeName = input.store_name.trim();
    if (!storeName) throw new Error("店铺名不能为空");
    update.store_name = storeName;
  }
  if (input.store_address !== undefined) update.store_address = input.store_address.trim();
  if (input.store_phone !== undefined) update.store_phone = input.store_phone.trim();
  if (input.store_whatsapp !== undefined) update.store_whatsapp = input.store_whatsapp.trim();
  if (input.store_email !== undefined) update.store_email = input.store_email.trim();
  if (input.public_base_url !== undefined) {
    const publicBaseUrl = input.public_base_url.trim();
    update.public_base_url = publicBaseUrl ? normalizePublicBaseUrl(publicBaseUrl) : "";
    if (publicBaseUrl && !update.public_base_url) {
      throw new Error("客户门户域名必须使用 HTTPS，或本地开发 localhost HTTP");
    }
  }
  if (input.default_order_warranty_months !== undefined) {
    const months = normalizeWarrantyMonths(input.default_order_warranty_months);
    update.default_order_warranty_months = months;
    update.default_order_warranty_text = formatWarrantyText(months);
  }
  if (input.default_inventory_warranty_months !== undefined) {
    update.default_inventory_warranty_months = input.default_inventory_warranty_months;
  }
  if (input.new_order_entry_mode !== undefined) {
    update.new_order_entry_mode = normalizeNewOrderEntryMode(input.new_order_entry_mode);
  }
  if (input.print_footer !== undefined) update.print_footer = input.print_footer.trim();
  if (input.message_signature !== undefined) {
    update.message_signature = input.message_signature.trim();
  }
  return update;
}

function nextSettingsUpdatedAt(expectedUpdatedAt: string) {
  const expectedTime = new Date(expectedUpdatedAt).getTime();
  const nextTime = Number.isFinite(expectedTime)
    ? Math.max(Date.now(), expectedTime + 1)
    : Date.now();
  return new Date(nextTime).toISOString();
}

function sanitizeMessageTemplateInput(input: MessageTemplateUpdateInput) {
  const update: MessageTemplateUpdateInput = {};
  if (typeof input.label === "string") {
    const label = input.label.trim();
    if (!label) throw new Error("模板名称不能为空");
    update.label = label;
  }
  if (typeof input.body_template === "string") {
    const body = input.body_template.trim();
    if (!body) throw new Error("模板正文不能为空");
    update.body_template = body;
  }
  if (typeof input.enabled === "boolean") {
    update.enabled = input.enabled;
  }
  return update;
}

function storeSettingsFromRow(row: DbRecord): StoreSettings {
  return withStoreSettingsDefaults({
    id: String(row.id ?? "default"),
    store_id: typeof row.store_id === "string" ? row.store_id : undefined,
    store_name: String(row.store_name ?? ""),
    store_address: String(row.store_address ?? ""),
    store_phone: String(row.store_phone ?? ""),
    store_whatsapp: String(row.store_whatsapp ?? ""),
    store_email: String(row.store_email ?? ""),
    public_base_url: String(row.public_base_url ?? ""),
    default_order_warranty_text: String(row.default_order_warranty_text ?? ""),
    default_order_warranty_months: Number(row.default_order_warranty_months ?? 6),
    default_inventory_warranty_months: Number(row.default_inventory_warranty_months ?? 12),
    new_order_entry_mode: normalizeNewOrderEntryMode(row.new_order_entry_mode),
    print_footer: String(row.print_footer ?? ""),
    message_signature: String(row.message_signature ?? ""),
    updated_by: typeof row.updated_by === "string" ? row.updated_by : undefined,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  });
}

function messageTemplateFromRow(row: DbRecord): MessageTemplate {
  return {
    id: String(row.id ?? ""),
    store_id: typeof row.store_id === "string" ? row.store_id : undefined,
    domain: row.domain === "customer" ? "customer" : "order",
    kind: String(row.kind ?? ""),
    channel: row.channel === "sms" ? "sms" : "whatsapp",
    language: row.language === "zh" || row.language === "en" ? row.language : "it",
    label: String(row.label ?? ""),
    body_template: String(row.body_template ?? ""),
    enabled: row.enabled !== false,
    sort_order: Number(row.sort_order ?? 0),
    updated_by: typeof row.updated_by === "string" ? row.updated_by : undefined,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function defaultTemplateFromSeed(
  seed: (typeof DEFAULT_MESSAGE_TEMPLATES)[number],
  storeId: string,
): MessageTemplate {
  const now = new Date().toISOString();
  return {
    ...seed,
    id: templateIdForStore(storeId, seed.id),
    store_id: storeId,
    created_at: now,
    updated_at: now,
  };
}

async function seedDefaultTemplatesForStore(storeId: string) {
  const supabase = getSupabaseAdmin();
  const templates = DEFAULT_MESSAGE_TEMPLATES.map((seed) => defaultTemplateFromSeed(seed, storeId));
  const { data, error } = await supabase
    .from("message_templates")
    .insert(
      templates.map((template) => ({
        id: template.id,
        store_id: storeId,
        domain: template.domain,
        kind: template.kind,
        channel: template.channel,
        language: template.language,
        label: template.label,
        body_template: template.body_template,
        enabled: template.enabled,
        sort_order: template.sort_order,
      })),
    )
    .select("*")
    .order("domain", { ascending: true })
    .order("sort_order", { ascending: true });
  fail(error, "初始化消息模板失败");
  return ((data ?? []) as DbRecord[]).map(messageTemplateFromRow);
}

async function ensureTemplateExists(id: string, storeId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("message_templates")
    .select("id")
    .eq("id", id)
    .eq("store_id", storeId)
    .maybeSingle();
  fail(error, "读取消息模板失败");
  if (data) return data;

  const seed = getDefaultMessageTemplate(id);
  if (!seed) throw new Error("消息模板不存在");
  return resetMessageTemplateRow(templateIdForStore(storeId, seed.id), undefined, storeId);
}

function storeSettingsIdForStore(storeId: string) {
  return storeId === DEFAULT_STORE_ID ? "default" : `store-settings:${storeId}`;
}

function requireRepositoryStoreId(storeId: string | undefined, context: string) {
  if (storeId?.trim()) return storeId;
  throw new Error(`${context}缺少店铺上下文，请重新登录后再试`);
}
