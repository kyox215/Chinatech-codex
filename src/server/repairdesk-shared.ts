import { isApprovalOverdue, isPickupOverdue } from "@/lib/mock/workflow";
import { CURRENCY_CODE } from "@/lib/money";
import {
  approvalFlowStatusFromLegacyStatus,
  notifyStatusFromLegacyStatus,
  partsStatusFromLegacyStatus,
  paymentStatusFromMoney,
  workflowStatusFromLegacyStatus,
} from "@/features/orders/model/canonical-order-status";
import {
  isDeviceUnlockMethod,
  normalizeUnlockPattern,
} from "@/features/orders/model/device-unlock";
import { getSupabaseAdmin } from "@/server/supabase";
import { resolveStaffDisplayName } from "@/server/staff-display-name";
import { primaryPhoneRaw, uniqueContactPhones } from "@/shared/lib/phone";
import type {
  AuditActor,
  Customer,
  CustomerFollowup,
  CustomerInteraction,
  CustomerTag,
  Device,
  DeviceSnapshot,
  FaultPriceItem,
  MessageLog,
  OrderAttachment,
  OrderEvent,
  OrderListItem,
  RepairOrder,
  Supplier,
} from "@/lib/repairdesk/types";

export type DbRecord = Record<string, unknown>;

export const DEFAULT_STORE_ID = "00000000-0000-0000-0000-000000000001";
export const REPAIR_ORDER_CUSTOMER_EMBED =
  "customer:customers!repair_orders_customer_same_store_fkey";
export const REPAIR_ORDER_DEVICE_EMBED = "device:devices!repair_orders_device_same_store_fkey";
export const REPAIR_ORDER_SUPPLIER_EMBED =
  "supplier:suppliers!repair_orders_supplier_same_store_fkey";
export const REPAIR_ORDER_PARTS_SUPPLIER_EMBED =
  "parts_supplier:suppliers!repair_orders_parts_supplier_same_store_fkey";

export function storeIdFromActor(actor?: Pick<AuditActor, "storeId"> | string | null) {
  if (!actor) return DEFAULT_STORE_ID;
  if (typeof actor === "string") return actor || DEFAULT_STORE_ID;
  return actor?.storeId || DEFAULT_STORE_ID;
}

export function requireStoreIdFromActor(
  actor?: Pick<AuditActor, "storeId" | "isSystem"> | string | null,
  context = "当前操作",
) {
  const storeId = typeof actor === "string" ? actor : actor?.storeId;
  if (storeId) return storeId;
  throw new Error(`${context}缺少店铺上下文，请重新登录后再试`);
}

export function operatorNameFromActor(
  actor?: Pick<AuditActor, "displayName" | "email" | "role" | "storeRole"> | string | null,
  fallback = "前台",
) {
  if (!actor) return fallback;
  if (typeof actor === "string") return actor.trim() || fallback;
  return resolveStaffDisplayName({
    email: actor.email,
    displayName: actor.displayName,
    role: actor.storeRole ?? actor.role,
    fallback,
  });
}

export const ORDER_SELECT = `
  *,
  ${REPAIR_ORDER_CUSTOMER_EMBED}(*),
  ${REPAIR_ORDER_DEVICE_EMBED}(*),
  ${REPAIR_ORDER_SUPPLIER_EMBED}(*),
  ${REPAIR_ORDER_PARTS_SUPPLIER_EMBED}(*)
`;

const ORDER_LIST_PAGE_SIZE = 1000;

const ORDER_LIST_BASE_COLUMNS = `
  id,
  store_id,
  public_no,
  order_type,
  status,
  customer_id,
  device_id,
  issue_description,
  diagnosis_result,
  quotation_amount,
  deposit_amount,
  balance_amount,
  currency_code,
  is_paid,
  approval_status,
  approval_sent_at,
  approval_confirmed_at,
  technician_name,
  internal_tag,
  accessory_notes,
  warranty_text,
  warranty_months,
  warranty_change_reason,
  warranty_changed_by,
  warranty_changed_at,
  completed_at,
  delivered_at,
  pause_reason,
  cancel_reason,
  supplier_id,
  original_order_id,
  contact_phones,
  fault_prices,
  device_snapshot,
  created_at,
  updated_at
`;

const ORDER_LIST_CANONICAL_COLUMNS = `
  assignee_membership_id,
  device_custody_status,
  workflow_status,
  exception_status,
  payment_status,
  approval_flow_status,
  parts_status,
  notify_status,
  record_state,
  voided_at,
  voided_by,
  void_reason,
  deleted_at
`;

// Columns already present before the lifecycle rollout. The compatibility
// select intentionally omits only the lifecycle fields introduced by
// 20260716221119 so assignment scoping and canonical status semantics remain
// available while the application and database are rolling forward.
const ORDER_LIST_PRE_LIFECYCLE_COLUMNS = `
  assignee_membership_id,
  workflow_status,
  exception_status,
  payment_status,
  approval_flow_status,
  parts_status,
  notify_status
`;

const ORDER_LIST_UNLOCK_COLUMNS = `
  device_unlock_method
`;

const ORDER_LIST_PARTS_SUPPLIER_COLUMNS = `
  parts_supplier_id
`;

const ORDER_LIST_COLUMNS = `
  ${ORDER_LIST_BASE_COLUMNS},
  ${ORDER_LIST_CANONICAL_COLUMNS},
  ${ORDER_LIST_UNLOCK_COLUMNS},
  ${ORDER_LIST_PARTS_SUPPLIER_COLUMNS}
`;

export const ORDER_LIST_SELECT = `
  ${ORDER_LIST_COLUMNS},
  ${REPAIR_ORDER_CUSTOMER_EMBED}(*),
  ${REPAIR_ORDER_DEVICE_EMBED}(*),
  ${REPAIR_ORDER_SUPPLIER_EMBED}(*)
`;

export const ORDER_LIST_LEGACY_SELECT = `
  ${ORDER_LIST_BASE_COLUMNS},
  ${ORDER_LIST_PRE_LIFECYCLE_COLUMNS},
  ${ORDER_LIST_UNLOCK_COLUMNS},
  ${ORDER_LIST_PARTS_SUPPLIER_COLUMNS},
  ${REPAIR_ORDER_CUSTOMER_EMBED}(*),
  ${REPAIR_ORDER_DEVICE_EMBED}(*),
  ${REPAIR_ORDER_SUPPLIER_EMBED}(*)
`;

const ORDER_LIST_SEARCH_CUSTOMER_COLUMNS = "id,name,phone_e164,phone_raw,contact_phones";
const ORDER_LIST_SEARCH_DEVICE_COLUMNS = "id,customer_id,brand,model,serial_or_imei,device_notes";
const ORDER_LIST_CARD_SUPPLIER_COLUMNS = "id,name,short_name,color,archived_at";

const ORDER_LIST_INDEX_BASE_COLUMNS = `
  id,
  store_id,
  public_no,
  order_type,
  status,
  customer_id,
  device_id,
  deposit_amount,
  balance_amount,
  is_paid,
  approval_status,
  approval_sent_at,
  technician_name,
  pause_reason,
  supplier_id,
  contact_phones,
  device_snapshot,
  completed_at,
  created_at,
  updated_at
`;

export const ORDER_LIST_INDEX_SELECT = `
  ${ORDER_LIST_INDEX_BASE_COLUMNS},
  ${ORDER_LIST_CANONICAL_COLUMNS},
  ${REPAIR_ORDER_CUSTOMER_EMBED}(${ORDER_LIST_SEARCH_CUSTOMER_COLUMNS}),
  ${REPAIR_ORDER_DEVICE_EMBED}(${ORDER_LIST_SEARCH_DEVICE_COLUMNS})
`;

export const ORDER_LIST_INDEX_LEGACY_SELECT = `
  ${ORDER_LIST_INDEX_BASE_COLUMNS},
  ${ORDER_LIST_PRE_LIFECYCLE_COLUMNS},
  ${REPAIR_ORDER_CUSTOMER_EMBED}(${ORDER_LIST_SEARCH_CUSTOMER_COLUMNS}),
  ${REPAIR_ORDER_DEVICE_EMBED}(${ORDER_LIST_SEARCH_DEVICE_COLUMNS})
`;

export const ORDER_LIST_CARD_SELECT = `
  ${ORDER_LIST_COLUMNS},
  ${REPAIR_ORDER_CUSTOMER_EMBED}(${ORDER_LIST_SEARCH_CUSTOMER_COLUMNS}),
  ${REPAIR_ORDER_DEVICE_EMBED}(${ORDER_LIST_SEARCH_DEVICE_COLUMNS}),
  ${REPAIR_ORDER_SUPPLIER_EMBED}(${ORDER_LIST_CARD_SUPPLIER_COLUMNS})
`;

export const ORDER_LIST_CARD_LEGACY_SELECT = `
  ${ORDER_LIST_BASE_COLUMNS},
  ${ORDER_LIST_PRE_LIFECYCLE_COLUMNS},
  ${ORDER_LIST_UNLOCK_COLUMNS},
  ${ORDER_LIST_PARTS_SUPPLIER_COLUMNS},
  ${REPAIR_ORDER_CUSTOMER_EMBED}(${ORDER_LIST_SEARCH_CUSTOMER_COLUMNS}),
  ${REPAIR_ORDER_DEVICE_EMBED}(${ORDER_LIST_SEARCH_DEVICE_COLUMNS}),
  ${REPAIR_ORDER_SUPPLIER_EMBED}(${ORDER_LIST_CARD_SUPPLIER_COLUMNS})
`;

export function fail(error: { message: string } | null | undefined, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

export function failStorageOperation(
  error: { message: string } | null | undefined,
  context: string,
  bucket: string,
) {
  if (!error) return;

  const message = error.message || "";
  if (/bucket/i.test(message) && /not found/i.test(message)) {
    throw new Error(
      `${context}: 附件存储未初始化，缺少 Supabase Storage bucket「${bucket}」。请应用 repairdesk_attachment_storage_repair 迁移后重试。`,
    );
  }
  if (/signature verification failed|unauthorized|invalid jwt|jwt/i.test(message)) {
    throw new Error(
      `${context}: Supabase Storage 服务密钥无效或权限不足，请检查服务端 SUPABASE_SERVICE_ROLE_KEY。`,
    );
  }
  if (/row-level security|permission denied|403/i.test(message)) {
    throw new Error(`${context}: Supabase Storage 权限拒绝，请检查 bucket 策略和服务端权限。`);
  }

  throw new Error(`${context}: ${message}`);
}

export function isMissingRepairOrderColumnError(error: { message: string } | null | undefined) {
  const message = error?.message;
  return Boolean(
    message &&
    (/column repair_orders\.[a-z_]+ does not exist/i.test(message) ||
      /Could not find the '[a-z_]+' column of 'repair_orders' in the schema cache/i.test(message)),
  );
}

export function maybeString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function requiredString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function money(value: unknown): number {
  return Number(value ?? 0);
}

export function phoneRaw(value: string): string {
  return primaryPhoneRaw(value);
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function faultPrices(value: unknown): FaultPriceItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): FaultPriceItem | undefined => {
      if (!item || typeof item !== "object") return undefined;
      const row = item as DbRecord;
      const name = requiredString(row.name);
      const price = money(row.price);
      if (!name) return undefined;
      const note = maybeString(row.note);
      return note
        ? { name, price, currency_code: CURRENCY_CODE, note }
        : { name, price, currency_code: CURRENCY_CODE };
    })
    .filter((item): item is FaultPriceItem => item !== undefined);
}

export function customerFromRow(row: unknown): Customer | undefined {
  if (!row || typeof row !== "object") return undefined;
  const r = row as DbRecord;
  return {
    id: requiredString(r.id),
    name: requiredString(r.name),
    phone_e164: requiredString(r.phone_e164),
    phone_raw: requiredString(r.phone_raw),
    contact_phones: uniqueContactPhones(
      requiredString(r.phone_e164),
      stringArray(r.contact_phones),
    ),
    consent_marketing: Boolean(r.consent_marketing),
    consent_sms: Boolean(r.consent_sms),
    email: maybeString(r.email),
    preferred_channel:
      r.preferred_channel === "sms" || r.preferred_channel === "whatsapp"
        ? r.preferred_channel
        : "whatsapp",
    language: r.language === "zh" || r.language === "en" || r.language === "it" ? r.language : "it",
    notes: maybeString(r.notes),
    marketing_notes: maybeString(r.marketing_notes),
    last_contacted_at: maybeString(r.last_contacted_at),
    blacklisted_at: maybeString(r.blacklisted_at),
  };
}

export function deviceFromRow(row: unknown): Device | undefined {
  if (!row || typeof row !== "object") return undefined;
  const r = row as DbRecord;
  return {
    id: requiredString(r.id),
    customer_id: requiredString(r.customer_id),
    brand: requiredString(r.brand),
    model: requiredString(r.model),
    serial_or_imei: requiredString(r.serial_or_imei),
    device_notes: maybeString(r.device_notes),
  };
}

export function supplierFromRow(row: unknown): Supplier | undefined {
  if (!row || typeof row !== "object") return undefined;
  const r = row as DbRecord;
  return {
    id: requiredString(r.id),
    name: requiredString(r.name),
    short_name: requiredString(r.short_name),
    color: requiredString(r.color),
    contact_name: maybeString(r.contact_name),
    phone: maybeString(r.phone),
    email: maybeString(r.email),
    website: maybeString(r.website),
    notes: maybeString(r.notes),
    archived_at: maybeString(r.archived_at),
    created_at: maybeString(r.created_at),
    updated_at: maybeString(r.updated_at),
  };
}

function deviceSnapshotFromRow(value: unknown): DeviceSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as DbRecord;
  const brand = requiredString(row.brand);
  const model = requiredString(row.model);
  if (!brand && !model) return undefined;
  return {
    brand,
    model,
    serial_or_imei: requiredString(row.serial_or_imei),
    device_notes: maybeString(row.device_notes),
  };
}

function deviceUnlockPatternFromRow(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const points = value.map((point) => Number(point));
  try {
    return normalizeUnlockPattern(points);
  } catch {
    return undefined;
  }
}

export function snapshotFromDevice(device: Device): DeviceSnapshot {
  return {
    brand: device.brand,
    model: device.model,
    serial_or_imei: device.serial_or_imei,
    ...(device.device_notes ? { device_notes: device.device_notes } : {}),
  };
}

export function tagFromRow(row: unknown): CustomerTag | undefined {
  if (!row || typeof row !== "object") return undefined;
  const r = row as DbRecord;
  const id = requiredString(r.id);
  const name = requiredString(r.name);
  if (!id || !name) return undefined;
  return {
    id,
    name,
    color: requiredString(r.color) || "#6366f1",
    description: maybeString(r.description),
  };
}

export function interactionFromRow(row: DbRecord): CustomerInteraction {
  return {
    id: requiredString(row.id),
    customer_id: requiredString(row.customer_id),
    order_id: maybeString(row.order_id),
    channel: row.channel as CustomerInteraction["channel"],
    direction: row.direction as CustomerInteraction["direction"],
    message_body: requiredString(row.message_body),
    status: row.status as CustomerInteraction["status"],
    operator_name: requiredString(row.operator_name) || "前台",
    created_at: requiredString(row.created_at),
  };
}

export function followupFromRow(row: DbRecord): CustomerFollowup {
  return {
    id: requiredString(row.id),
    customer_id: requiredString(row.customer_id),
    order_id: maybeString(row.order_id),
    title: requiredString(row.title),
    note: maybeString(row.note),
    due_at: requiredString(row.due_at),
    owner_name: maybeString(row.owner_name),
    status: row.status as CustomerFollowup["status"],
    completed_at: maybeString(row.completed_at),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

export function orderFromRow(row: DbRecord): RepairOrder {
  const status = row.status as RepairOrder["status"];
  const balanceAmount = money(row.balance_amount);
  const isPaid = row.is_paid === true;
  const derivedPaymentStatus = paymentStatusFromMoney({
    isPaid,
    depositAmount: money(row.deposit_amount),
    balanceAmount,
  });
  const storedPaymentStatus = maybeString(row.payment_status) as RepairOrder["payment_status"];
  return {
    id: requiredString(row.id),
    public_no: requiredString(row.public_no),
    order_type: row.order_type as RepairOrder["order_type"],
    status,
    legacy_status: (maybeString(row.legacy_status) as RepairOrder["legacy_status"]) ?? status,
    workflow_status:
      (maybeString(row.workflow_status) as RepairOrder["workflow_status"]) ??
      workflowStatusFromLegacyStatus(status),
    exception_status:
      (maybeString(row.exception_status) as RepairOrder["exception_status"]) ??
      (status === "cancelled"
        ? "cancelled"
        : status === "rework"
          ? "rework"
          : status === "unfixed_pickup"
            ? "returned_unfixed"
            : maybeString(row.pause_reason)
              ? "paused"
              : undefined),
    payment_status: storedPaymentStatus ?? derivedPaymentStatus,
    approval_flow_status:
      (maybeString(row.approval_flow_status) as RepairOrder["approval_flow_status"]) ??
      approvalFlowStatusFromLegacyStatus(status, maybeString(row.approval_status)),
    parts_status:
      (maybeString(row.parts_status) as RepairOrder["parts_status"]) ??
      partsStatusFromLegacyStatus(status),
    notify_status:
      (maybeString(row.notify_status) as RepairOrder["notify_status"]) ??
      notifyStatusFromLegacyStatus(status),
    workflow_bucket: maybeString(row.workflow_bucket) as RepairOrder["workflow_bucket"],
    customer_id: requiredString(row.customer_id),
    device_id: requiredString(row.device_id),
    issue_description: requiredString(row.issue_description),
    diagnosis_result: maybeString(row.diagnosis_result),
    quotation_amount: money(row.quotation_amount),
    deposit_amount: money(row.deposit_amount),
    balance_amount: balanceAmount,
    currency_code: CURRENCY_CODE,
    is_paid: isPaid,
    approval_status: row.approval_status as RepairOrder["approval_status"],
    approval_sent_at: maybeString(row.approval_sent_at),
    approval_confirmed_at: maybeString(row.approval_confirmed_at),
    technician_name: requiredString(row.technician_name),
    assignee_membership_id: maybeString(row.assignee_membership_id),
    internal_tag: maybeString(row.internal_tag),
    accessory_notes: maybeString(row.accessory_notes),
    device_custody_status:
      row.device_custody_status === "with_shop" || row.device_custody_status === "with_customer"
        ? row.device_custody_status
        : null,
    warranty_text: maybeString(row.warranty_text),
    warranty_months:
      typeof row.warranty_months === "number"
        ? row.warranty_months
        : row.warranty_months === undefined || row.warranty_months === null
          ? undefined
          : Number(row.warranty_months),
    warranty_change_reason: maybeString(row.warranty_change_reason),
    warranty_changed_by: maybeString(row.warranty_changed_by),
    warranty_changed_at: maybeString(row.warranty_changed_at),
    completed_at: maybeString(row.completed_at),
    delivered_at: maybeString(row.delivered_at),
    pause_reason: maybeString(row.pause_reason),
    cancel_reason: maybeString(row.cancel_reason),
    supplier_id: maybeString(row.supplier_id),
    parts_supplier_id: maybeString(row.parts_supplier_id),
    original_order_id: maybeString(row.original_order_id),
    contact_phones: uniqueContactPhones(
      requiredString(row.customer_phone),
      stringArray(row.contact_phones),
    ),
    fault_prices: faultPrices(row.fault_prices),
    device_snapshot: deviceSnapshotFromRow(row.device_snapshot),
    device_unlock_method: isDeviceUnlockMethod(row.device_unlock_method)
      ? row.device_unlock_method
      : undefined,
    device_unlock_value: maybeString(row.device_unlock_value),
    device_unlock_pattern: deviceUnlockPatternFromRow(row.device_unlock_pattern),
    customer_signature: maybeString(row.customer_signature),
    record_state: maybeString(row.record_state) === "voided" ? "voided" : "active",
    voided_at: maybeString(row.voided_at),
    voided_by: maybeString(row.voided_by),
    void_reason: maybeString(row.void_reason),
    deleted_at: maybeString(row.deleted_at),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

export function decorate(row: DbRecord): OrderListItem {
  const order = orderFromRow(row);
  const customer = customerFromRow(row.customer);
  const device = deviceFromRow(row.device);
  const supplier = supplierFromRow(row.supplier);
  const snapshot = order.device_snapshot ?? (device ? snapshotFromDevice(device) : undefined);
  const deviceLabel = snapshot ? `${snapshot.brand} ${snapshot.model}`.trim() : "-";

  return {
    ...order,
    customer_name: customer?.name ?? "-",
    customer_phone: customer?.phone_e164 ?? "",
    device_label: deviceLabel || "-",
    device_imei: snapshot?.serial_or_imei ?? device?.serial_or_imei ?? "",
    supplier_name: supplier?.name,
    supplier_color: supplier?.color,
    approval_overdue: isApprovalOverdue(order),
    pickup_overdue: isPickupOverdue(order),
  };
}

export function eventFromRow(row: DbRecord): OrderEvent {
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  return {
    id: requiredString(row.id),
    order_id: requiredString(row.order_id),
    event_type: row.event_type as OrderEvent["event_type"],
    payload: payload as Record<string, unknown>,
    operator_name: requiredString(row.operator_name),
    created_at: requiredString(row.created_at),
  };
}

export function messageFromRow(row: DbRecord): MessageLog {
  return {
    id: requiredString(row.id),
    order_id: requiredString(row.order_id),
    channel: row.channel as MessageLog["channel"],
    message_body: requiredString(row.message_body),
    status: row.status as MessageLog["status"],
    sent_at: requiredString(row.sent_at),
    opened_at: maybeString(row.opened_at),
  };
}

export function attachmentFromRow(row: DbRecord): OrderAttachment {
  return {
    id: requiredString(row.id),
    store_id: requiredString(row.store_id),
    order_id: requiredString(row.order_id),
    kind: (maybeString(row.kind) || "other") as OrderAttachment["kind"],
    file_name: requiredString(row.file_name),
    mime_type: requiredString(row.mime_type),
    file_size: Number(row.file_size ?? 0),
    storage_bucket: requiredString(row.storage_bucket),
    storage_path: requiredString(row.storage_path),
    public_url: maybeString(row.public_url),
    signed_url: maybeString(row.signed_url),
    note: maybeString(row.note),
    uploaded_by: maybeString(row.uploaded_by),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

export async function fetchOrderRows(storeId: string): Promise<DbRecord[]> {
  const supabase = getSupabaseAdmin();
  const rows: DbRecord[] = [];
  let from = 0;
  let select = ORDER_LIST_SELECT;
  let retriedLegacySelect = false;

  while (true) {
    const { data, error } = await supabase
      .from("repair_orders")
      .select(select)
      .eq("store_id", storeId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + ORDER_LIST_PAGE_SIZE - 1);
    if (error && !retriedLegacySelect && isMissingRepairOrderColumnError(error)) {
      rows.length = 0;
      from = 0;
      select = ORDER_LIST_LEGACY_SELECT;
      retriedLegacySelect = true;
      continue;
    }
    fail(error, "读取工单失败");

    const assignmentSupported = !retriedLegacySelect;
    const batch = ((data ?? []) as unknown as DbRecord[]).map((row) => ({
      ...row,
      __assignment_supported: assignmentSupported,
    }));
    rows.push(...batch);

    if (batch.length < ORDER_LIST_PAGE_SIZE) break;
    from += ORDER_LIST_PAGE_SIZE;
  }

  return attachOrderWorkflowBuckets(storeId, rows);
}

export type OrderListDatabaseView = "active" | "archive" | "all";

type OrderListDatabaseScope = {
  view: OrderListDatabaseView;
  assigneeMembershipId?: string;
};

export function orderListDatabaseOrFilter(view: OrderListDatabaseView) {
  if (view === "active") {
    return "exception_status.is.null,exception_status.neq.cancelled";
  }
  if (view === "archive") {
    return "status.in.(completed,cancelled),exception_status.eq.cancelled";
  }
  return undefined;
}

function applyOrderListDatabaseScopeWithCompatibility<
  T extends {
    eq: (column: string, value: string) => T;
    in: (column: string, values: string[]) => T;
    neq: (column: string, value: string) => T;
    is: (column: string, value: null) => T;
    not: (column: string, operator: string, value: string) => T;
    or: (filters: string) => T;
  },
>(query: T, scope: OrderListDatabaseScope, lifecycleSupported: boolean) {
  let scoped = query;
  if (!lifecycleSupported && scope.view === "active") {
    scoped = scoped.neq("status", "completed").neq("status", "cancelled");
  } else if (scope.view === "active") {
    scoped = scoped
      .eq("record_state", "active")
      .is("deleted_at", null)
      .not("status", "in", "(completed,cancelled)")
      .or("exception_status.neq.cancelled,exception_status.is.null");
  }
  if (scope.assigneeMembershipId) {
    scoped = scoped.eq("assignee_membership_id", scope.assigneeMembershipId);
  }
  return scoped;
}

export async function fetchOrderListIndexRows(
  storeId: string,
  scope: OrderListDatabaseScope,
): Promise<DbRecord[]> {
  const supabase = getSupabaseAdmin();
  const rows: DbRecord[] = [];
  let from = 0;
  let select = ORDER_LIST_INDEX_SELECT;
  let retriedLegacySelect = false;

  while (true) {
    let query = supabase.from("repair_orders").select(select).eq("store_id", storeId);
    query = applyOrderListDatabaseScopeWithCompatibility(query, scope, !retriedLegacySelect);
    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + ORDER_LIST_PAGE_SIZE - 1);

    if (error && !retriedLegacySelect && isMissingRepairOrderColumnError(error)) {
      rows.length = 0;
      from = 0;
      select = ORDER_LIST_INDEX_LEGACY_SELECT;
      retriedLegacySelect = true;
      continue;
    }
    fail(error, "读取工单索引失败");

    const batch = ((data ?? []) as unknown as DbRecord[]).map((row) => ({
      ...row,
      __assignment_supported: true,
    }));
    rows.push(...batch);
    if (batch.length < ORDER_LIST_PAGE_SIZE) break;
    from += ORDER_LIST_PAGE_SIZE;
  }

  return attachOrderWorkflowBuckets(storeId, rows);
}

export async function fetchOrderRowsByIds(
  storeId: string,
  ids: string[],
  assigneeMembershipId?: string,
): Promise<DbRecord[]> {
  if (!ids.length) return [];

  const supabase = getSupabaseAdmin();
  let select = ORDER_LIST_CARD_SELECT;
  let retriedLegacySelect = false;

  while (true) {
    let query = supabase.from("repair_orders").select(select).eq("store_id", storeId).in("id", ids);
    if (assigneeMembershipId) {
      query = query.eq("assignee_membership_id", assigneeMembershipId);
    }
    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true });

    if (error && !retriedLegacySelect && isMissingRepairOrderColumnError(error)) {
      select = ORDER_LIST_CARD_LEGACY_SELECT;
      retriedLegacySelect = true;
      continue;
    }
    fail(error, "读取当前页工单失败");
    const rows = ((data ?? []) as unknown as DbRecord[]).map((row) => ({
      ...row,
      __assignment_supported: true,
    }));
    return attachOrderWorkflowBuckets(storeId, rows);
  }
}

async function attachOrderWorkflowBuckets(storeId: string, rows: DbRecord[]) {
  if (!rows.length) return rows;
  const { data, error } = await getSupabaseAdmin()
    .from("order_workflow_statuses")
    .select("code,bucket")
    .eq("store_id", storeId);
  fail(error, "读取工单状态口径失败");
  const bucketByCode = new Map(
    ((data ?? []) as unknown as DbRecord[]).map((row) => [
      requiredString(row.code),
      requiredString(row.bucket),
    ]),
  );
  return rows.map((row) => ({
    ...row,
    workflow_bucket: bucketByCode.get(requiredString(row.status)),
  }));
}
