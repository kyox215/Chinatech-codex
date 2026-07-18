import {
  DEFAULT_MESSAGE_TEMPLATES,
  DEFAULT_STORE_SETTINGS,
  templateIdForStore,
} from "@/features/messages/model/message-template-defaults";
import { fail } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

const DEFAULT_ORDER_WORKFLOW_STATUSES = [
  {
    code: "new",
    label: "新建",
    shortLabel: "新建",
    tone: "info",
    bucket: "intake",
    sortOrder: 10,
    allowedForCreate: true,
    isDefaultCreateStatus: true,
  },
  {
    code: "rework",
    label: "返修",
    shortLabel: "返修",
    tone: "warn",
    bucket: "intake",
    sortOrder: 20,
    allowedForCreate: true,
    isDefaultCreateStatus: false,
  },
  {
    code: "diagnosing",
    label: "检测中",
    shortLabel: "检测",
    tone: "progress",
    bucket: "diagnosing",
    sortOrder: 40,
    allowedForCreate: true,
    isDefaultCreateStatus: false,
  },
  {
    code: "quoted",
    label: "已报价",
    shortLabel: "报价",
    tone: "progress",
    bucket: "quote",
    sortOrder: 50,
    allowedForCreate: false,
    isDefaultCreateStatus: false,
  },
  {
    code: "waiting_approval",
    label: "待审批",
    shortLabel: "审批",
    tone: "warn",
    bucket: "quote",
    sortOrder: 60,
    allowedForCreate: false,
    isDefaultCreateStatus: false,
  },
  {
    code: "parts_ordered",
    label: "配件已订",
    shortLabel: "订件",
    tone: "progress",
    bucket: "parts",
    sortOrder: 70,
    allowedForCreate: false,
    isDefaultCreateStatus: false,
  },
  {
    code: "parts_arrived",
    label: "配件已到",
    shortLabel: "到件",
    tone: "progress",
    bucket: "parts",
    sortOrder: 80,
    allowedForCreate: false,
    isDefaultCreateStatus: false,
  },
  {
    code: "mail_in_progress",
    label: "寄修中",
    shortLabel: "寄修",
    tone: "progress",
    bucket: "repair",
    sortOrder: 85,
    allowedForCreate: true,
    isDefaultCreateStatus: false,
  },
  {
    code: "repairing",
    label: "维修中",
    shortLabel: "维修",
    tone: "progress",
    bucket: "repair",
    sortOrder: 90,
    allowedForCreate: false,
    isDefaultCreateStatus: false,
  },
  {
    code: "repaired",
    label: "已修复",
    shortLabel: "修复",
    tone: "success",
    bucket: "repair",
    sortOrder: 100,
    allowedForCreate: false,
    isDefaultCreateStatus: false,
  },
  {
    code: "notified",
    label: "已通知",
    shortLabel: "通知",
    tone: "success",
    bucket: "pickup",
    sortOrder: 110,
    allowedForCreate: false,
    isDefaultCreateStatus: false,
  },
  {
    code: "unfixed_pickup",
    label: "未修取机",
    shortLabel: "未修",
    tone: "danger",
    bucket: "pickup",
    sortOrder: 120,
    allowedForCreate: false,
    isDefaultCreateStatus: false,
  },
  {
    code: "waiting_pickup",
    label: "待取机",
    shortLabel: "待取",
    tone: "warn",
    bucket: "pickup",
    sortOrder: 130,
    allowedForCreate: false,
    isDefaultCreateStatus: false,
  },
  {
    code: "completed",
    label: "已完成",
    shortLabel: "完成",
    tone: "success",
    bucket: "done",
    sortOrder: 140,
    allowedForCreate: false,
    isDefaultCreateStatus: false,
  },
  {
    code: "cancelled",
    label: "已取消",
    shortLabel: "取消",
    tone: "neutral",
    bucket: "cancelled",
    sortOrder: 150,
    allowedForCreate: false,
    isDefaultCreateStatus: false,
  },
] as const;

const DEFAULT_ORDER_WORKFLOW_TRANSITIONS = [
  ["new", "diagnosing", true, 10],
  ["new", "quoted", false, 20],
  ["new", "repairing", false, 30],
  ["new", "cancelled", false, 40],
  ["rework", "diagnosing", true, 10],
  ["rework", "repairing", false, 20],
  ["rework", "cancelled", false, 30],
  ["mail_in_progress", "repaired", true, 10],
  ["mail_in_progress", "repairing", false, 20],
  ["mail_in_progress", "diagnosing", false, 30],
  ["mail_in_progress", "unfixed_pickup", false, 40],
  ["mail_in_progress", "cancelled", false, 50],
  ["diagnosing", "quoted", true, 10],
  ["diagnosing", "repairing", false, 20],
  ["diagnosing", "unfixed_pickup", false, 30],
  ["diagnosing", "cancelled", false, 40],
  ["quoted", "waiting_approval", true, 10],
  ["quoted", "repairing", false, 20],
  ["quoted", "parts_ordered", false, 30],
  ["quoted", "mail_in_progress", false, 35],
  ["quoted", "cancelled", false, 40],
  ["waiting_approval", "repairing", true, 10],
  ["waiting_approval", "parts_ordered", false, 20],
  ["waiting_approval", "mail_in_progress", false, 25],
  ["waiting_approval", "cancelled", false, 30],
  ["parts_ordered", "parts_arrived", true, 10],
  ["parts_ordered", "cancelled", false, 20],
  ["parts_arrived", "repairing", true, 10],
  ["parts_arrived", "cancelled", false, 20],
  ["repairing", "repaired", true, 10],
  ["repairing", "mail_in_progress", false, 15],
  ["repairing", "parts_ordered", false, 20],
  ["repairing", "unfixed_pickup", false, 30],
  ["repairing", "cancelled", false, 40],
  ["repaired", "notified", true, 10],
  ["repaired", "completed", false, 20],
  ["repaired", "waiting_pickup", false, 30],
  ["notified", "completed", true, 10],
  ["notified", "waiting_pickup", false, 20],
  ["notified", "unfixed_pickup", false, 30],
  ["unfixed_pickup", "completed", true, 10],
  ["unfixed_pickup", "rework", false, 20],
  ["waiting_pickup", "completed", true, 10],
  ["waiting_pickup", "notified", false, 20],
  ["completed", "rework", true, 10],
  ["cancelled", "new", true, 10],
  ["cancelled", "rework", false, 20],
] as const;

export interface StoreProvisioningInput {
  storeId: string;
  storeName: string;
  storeAddress?: string;
  actorId?: string;
  now?: string;
}

export async function provisionStoreDefaults(
  supabase: SupabaseAdmin,
  input: StoreProvisioningInput,
) {
  const now = input.now ?? new Date().toISOString();
  await seedStoreSettings(supabase, input, now);
  await seedMessageTemplates(supabase, input, now);
  await seedOrderWorkflow(supabase, input, now);
}

export async function deleteProvisionedStoreDefaults(supabase: SupabaseAdmin, storeId: string) {
  await deleteStoreRows(supabase, "order_workflow_transitions", storeId);
  await deleteStoreRows(supabase, "order_workflow_statuses", storeId);
  await deleteStoreRows(supabase, "message_templates", storeId);
  await deleteStoreRows(supabase, "store_settings", storeId);
}

async function seedStoreSettings(
  supabase: SupabaseAdmin,
  input: StoreProvisioningInput,
  now: string,
) {
  const storeName = input.storeName.trim() || DEFAULT_STORE_SETTINGS.store_name;
  const { error } = await supabase.from("store_settings").upsert(
    {
      id: storeSettingsIdForStore(input.storeId),
      store_id: input.storeId,
      store_name: storeName,
      store_address: input.storeAddress?.trim() ?? "",
      store_phone: "",
      store_whatsapp: "",
      store_email: "",
      default_order_warranty_text: DEFAULT_STORE_SETTINGS.default_order_warranty_text,
      default_order_warranty_months: DEFAULT_STORE_SETTINGS.default_order_warranty_months,
      default_inventory_warranty_months: DEFAULT_STORE_SETTINGS.default_inventory_warranty_months,
      print_footer: `Grazie per aver scelto ${storeName}.`,
      message_signature: storeName,
      updated_by: input.actorId ?? null,
      created_at: now,
      updated_at: now,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  fail(error, "初始化店铺设置失败");
}

async function seedMessageTemplates(
  supabase: SupabaseAdmin,
  input: StoreProvisioningInput,
  now: string,
) {
  const { error } = await supabase.from("message_templates").upsert(
    DEFAULT_MESSAGE_TEMPLATES.map((template) => ({
      id: templateIdForStore(input.storeId, template.id),
      store_id: input.storeId,
      domain: template.domain,
      kind: template.kind,
      channel: template.channel,
      language: template.language,
      label: template.label,
      body_template: template.body_template,
      enabled: template.enabled,
      sort_order: template.sort_order,
      updated_by: input.actorId ?? null,
      created_at: now,
      updated_at: now,
    })),
    {
      onConflict: "id",
      ignoreDuplicates: true,
    },
  );
  fail(error, "初始化消息模板失败");
}

async function seedOrderWorkflow(
  supabase: SupabaseAdmin,
  input: StoreProvisioningInput,
  now: string,
) {
  const { error: statusError } = await supabase.from("order_workflow_statuses").upsert(
    DEFAULT_ORDER_WORKFLOW_STATUSES.map((status) => ({
      id: crypto.randomUUID(),
      store_id: input.storeId,
      code: status.code,
      label: status.label,
      short_label: status.shortLabel,
      tone: status.tone,
      bucket: status.bucket,
      sort_order: status.sortOrder,
      enabled: true,
      show_in_order_filters: true,
      allowed_for_create: status.allowedForCreate,
      is_default_create_status: status.isDefaultCreateStatus,
      is_system: true,
      created_by: input.actorId ?? null,
      updated_by: input.actorId ?? null,
      created_at: now,
      updated_at: now,
    })),
    { onConflict: "store_id,code", ignoreDuplicates: true },
  );
  fail(statusError, "初始化工单状态失败");

  const { error: transitionError } = await supabase.from("order_workflow_transitions").upsert(
    DEFAULT_ORDER_WORKFLOW_TRANSITIONS.map(([from, to, isPrimary, sortOrder]) => ({
      id: crypto.randomUUID(),
      store_id: input.storeId,
      from_status_code: from,
      to_status_code: to,
      is_primary: isPrimary,
      sort_order: sortOrder,
      enabled: true,
      created_by: input.actorId ?? null,
      updated_by: input.actorId ?? null,
      created_at: now,
      updated_at: now,
    })),
    {
      onConflict: "store_id,from_status_code,to_status_code",
      ignoreDuplicates: true,
    },
  );
  fail(transitionError, "初始化工单流转失败");
}

async function deleteStoreRows(supabase: SupabaseAdmin, table: string, storeId: string) {
  const { error } = await supabase.from(table).delete().eq("store_id", storeId);
  fail(error, `回滚${table}失败`);
}

function storeSettingsIdForStore(storeId: string) {
  return storeId === "00000000-0000-0000-0000-000000000001"
    ? "default"
    : `store-settings:${storeId}`;
}
