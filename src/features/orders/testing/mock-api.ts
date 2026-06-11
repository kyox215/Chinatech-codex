import { CURRENCY_CODE } from "@/lib/money";
import type {
  AuditActor,
  CreateOrderInput,
  OrderListFilters,
  OrderListItem,
  OrderListPageInput,
  OrderListResult,
  OrderWorkflow,
  OrderWorkflowStatus,
  OrderWorkflowStatusCreateInput,
  OrderWorkflowStatusEnabledInput,
  OrderWorkflowStatusReorderInput,
  OrderWorkflowStatusUpdateInput,
  OrderWorkflowTransition,
  OrderWorkflowTransitionsUpdateInput,
  OrderWhatsappTemplateKind,
  PatchOrderFinanceInput,
  PatchOrderInput,
  PatchOrderResult,
  RepairOrder,
  UpdateOrderInput,
  WhatsappNotificationResult,
} from "@/lib/repairdesk/types";
import { repairOrderStatus, statusMeta, type RepairOrderStatus } from "@/lib/mock/enums";
import { normalizePhoneBook, normalizePhoneRaw, phoneMatches } from "@/shared/lib/phone";
import {
  ORDER_STATUS_ALLOWED_FOR_CREATE,
  DEFAULT_ORDER_WORKFLOW_TRANSITIONS,
  getStatusListSortIndex,
  isApprovalOverdue,
  isPickupOverdue,
} from "@/lib/mock/workflow";
import {
  customers,
  decorate,
  devices,
  extraEvents,
  extraMessages,
  getCustomer,
  getDevice,
  getEvents,
  getMessages,
  getSupplier,
  orders,
} from "@/lib/mock/state";
import { normalizeOrderTagInput } from "@/features/orders/model/order-tags";
import {
  formatWarrantyText,
  normalizeWarrantyPayload,
  parseWarrantyMonths,
  warrantyReasonRequired,
} from "@/features/orders/model/order-warranty";

type MockOperator = string | AuditActor;

function operatorName(operator: MockOperator = "前台") {
  return typeof operator === "string" ? operator : operator.displayName;
}

const mockStoreId = "mock-store";
let workflowStatuses: OrderWorkflowStatus[] = repairOrderStatus.map((code, index) => ({
  id: `mock-status-${code}`,
  store_id: mockStoreId,
  code,
  label: statusMeta[code]?.label ?? code,
  short_label: statusMeta[code]?.shortLabel ?? statusMeta[code]?.label ?? code,
  tone: statusMeta[code]?.tone ?? "neutral",
  bucket:
    code === "cancelled"
      ? "cancelled"
      : code === "completed"
        ? "done"
        : ["repaired", "notified", "waiting_pickup", "unfixed_pickup"].includes(code)
          ? "pickup"
          : ["parts_ordered", "parts_arrived"].includes(code)
            ? "parts"
            : code === "repairing"
              ? "repair"
              : ["quoted", "waiting_approval"].includes(code)
                ? "quote"
                : code === "diagnosing"
                  ? "diagnosing"
                  : "intake",
  sort_order: (index + 1) * 10,
  enabled: true,
  show_in_order_filters: ["new", "rework", "mail_in_progress", "diagnosing"].includes(code),
  allowed_for_create: ORDER_STATUS_ALLOWED_FOR_CREATE.includes(code),
  is_default_create_status: code === "new",
  is_system: true,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
}));

let workflowTransitions: OrderWorkflowTransition[] = Object.entries(
  DEFAULT_ORDER_WORKFLOW_TRANSITIONS,
).flatMap(([from, targets]) =>
  targets.map((to, index) => ({
    id: `mock-transition-${from}-${to}`,
    store_id: mockStoreId,
    from_status_code: from,
    to_status_code: to,
    is_primary: index === 0,
    sort_order: (index + 1) * 10,
    enabled: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  })),
);

function cloneWorkflow(): OrderWorkflow {
  return {
    statuses: workflowStatuses.map((status) => ({ ...status })),
    transitions: workflowTransitions.map((transition) => ({ ...transition })),
  };
}

function mergeContactPhones(existing: string[], incoming: string[], primaryRaw: string) {
  const result: string[] = [];
  const seen = new Set<string>(primaryRaw ? [primaryRaw] : []);
  for (const phone of [...existing, ...incoming]) {
    const raw = normalizePhoneRaw(phone);
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    result.push(phone.trim());
  }
  return result;
}

function assertCustomerPhoneAvailable(
  customerId: string,
  primaryRaw: string,
  contactPhones: string[],
) {
  const raws = new Set([
    primaryRaw,
    ...contactPhones.map((phone) => normalizePhoneRaw(phone)).filter(Boolean),
  ]);
  const conflicts = customers.filter(
    (customer) => customer.id !== customerId && raws.has(customer.phone_raw),
  );
  if (conflicts.length === 0) return;
  if (conflicts.some((customer) => customer.phone_raw === primaryRaw)) {
    throw new Error("该手机号已存在客户档案");
  }
  throw new Error("备用号码已属于其他客户档案，请先确认客户资料");
}

function mockId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function listOrders(
  filters: OrderListFilters = {},
  _actor?: AuditActor,
): Promise<OrderListItem[]> {
  let result = orders.map(decorate);
  const q = filters.search?.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (o) =>
        o.public_no.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        phoneMatches(o.customer_phone, q) ||
        o.contact_phones.some((phone) => phoneMatches(phone, q)) ||
        o.device_imei.toLowerCase().includes(q) ||
        o.device_label.toLowerCase().includes(q),
    );
  }
  if (filters.statuses?.length) {
    result = result.filter((o) => filters.statuses!.includes(o.status));
  }
  if (filters.types?.length) {
    result = result.filter((o) => filters.types!.includes(o.order_type));
  }
  if (filters.technicians?.length) {
    result = result.filter((o) => filters.technicians!.includes(o.technician_name));
  }
  if (filters.supplierIds?.length) {
    result = result.filter((o) => o.supplier_id && filters.supplierIds!.includes(o.supplier_id));
  }
  if (filters.paid && filters.paid !== "all") {
    result = result.filter((o) => (filters.paid === "paid" ? o.is_paid : !o.is_paid));
  }
  if (filters.overdue) {
    result = result.filter((o) =>
      filters.overdue === "approval"
        ? o.approval_overdue
        : filters.overdue === "pickup"
          ? o.pickup_overdue
          : o.approval_overdue || o.pickup_overdue,
    );
  }
  // Workflow-first sort, then updated_at desc.
  return result.sort((a, b) => {
    const d = getStatusListSortIndex(a.status) - getStatusListSortIndex(b.status);
    if (d !== 0) return d;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

export async function listOrdersPage(
  input: OrderListPageInput = {},
  actor?: AuditActor,
): Promise<OrderListResult> {
  const page = Math.max(1, Math.floor(Number(input.page ?? 1)));
  const pageSize = Math.min(100, Math.max(10, Math.floor(Number(input.pageSize ?? 50))));
  const all = await listOrders(input, actor);
  const start = (page - 1) * pageSize;
  return {
    items: all.slice(start, start + pageSize),
    total: all.length,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(all.length / pageSize)),
  };
}

// Used to compute KPIs without re-running filters on the same dataset.
export async function getOrderStats(_actor?: AuditActor) {
  return {
    total: orders.length,
    today: orders.filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString())
      .length,
    inProgress: orders.filter((o) =>
      [
        "new",
        "rework",
        "mail_in_progress",
        "diagnosing",
        "quoted",
        "parts_ordered",
        "parts_arrived",
        "repairing",
      ].includes(o.status),
    ).length,
    unpaid: orders.filter((o) => !o.is_paid).length,
    approvalOverdue: orders.filter(isApprovalOverdue).length,
    pickupOverdue: orders.filter(isPickupOverdue).length,
  };
}

export async function listOrderWorkflow(_actor?: AuditActor): Promise<OrderWorkflow> {
  return cloneWorkflow();
}

export async function createOrderWorkflowStatus(
  input: OrderWorkflowStatusCreateInput,
  _actor?: AuditActor,
): Promise<OrderWorkflowStatus> {
  const code = input.code.trim().toLowerCase();
  if (workflowStatuses.some((status) => status.code === code)) throw new Error("状态代码已存在");
  const now = new Date().toISOString();
  if (input.is_default_create_status) {
    workflowStatuses = workflowStatuses.map((status) => ({
      ...status,
      is_default_create_status: false,
    }));
  }
  const label = input.label.trim();
  const status: OrderWorkflowStatus = {
    id: crypto.randomUUID(),
    store_id: mockStoreId,
    code,
    label,
    short_label: input.short_label?.trim() || label.slice(0, 4),
    tone: input.tone,
    bucket: input.bucket,
    sort_order:
      input.sort_order ?? Math.max(0, ...workflowStatuses.map((item) => item.sort_order)) + 10,
    enabled: input.is_default_create_status ? true : (input.enabled ?? true),
    show_in_order_filters: input.show_in_order_filters ?? true,
    allowed_for_create: input.is_default_create_status ? true : (input.allowed_for_create ?? false),
    is_default_create_status: Boolean(input.is_default_create_status),
    is_system: false,
    created_at: now,
    updated_at: now,
  };
  workflowStatuses = [...workflowStatuses, status].sort((a, b) => a.sort_order - b.sort_order);
  return { ...status };
}

export async function updateOrderWorkflowStatus(
  id: string,
  input: OrderWorkflowStatusUpdateInput,
  _actor?: AuditActor,
): Promise<OrderWorkflowStatus> {
  const current = workflowStatuses.find((status) => status.id === id);
  if (!current) throw new Error("状态不存在");
  if (current.is_default_create_status && input.enabled === false) {
    throw new Error("默认新建状态不能停用");
  }
  if (current.is_default_create_status && input.is_default_create_status === false) {
    throw new Error("请先把另一个状态设为默认新建状态");
  }
  if (input.is_default_create_status) {
    workflowStatuses = workflowStatuses.map((status) => ({
      ...status,
      is_default_create_status: false,
    }));
  }
  const now = new Date().toISOString();
  workflowStatuses = workflowStatuses.map((status) =>
    status.id === id
      ? {
          ...status,
          ...input,
          enabled: input.is_default_create_status ? true : (input.enabled ?? status.enabled),
          allowed_for_create: input.is_default_create_status
            ? true
            : (input.allowed_for_create ?? status.allowed_for_create),
          is_default_create_status:
            input.is_default_create_status ?? status.is_default_create_status,
          updated_at: now,
        }
      : status,
  );
  return { ...workflowStatuses.find((status) => status.id === id)! };
}

export async function reorderOrderWorkflowStatuses(
  input: OrderWorkflowStatusReorderInput,
  _actor?: AuditActor,
): Promise<OrderWorkflow> {
  const orderById = new Map(input.items.map((item) => [item.id, item.sort_order]));
  workflowStatuses = workflowStatuses
    .map((status) => ({
      ...status,
      sort_order: orderById.get(status.id) ?? status.sort_order,
      updated_at: orderById.has(status.id) ? new Date().toISOString() : status.updated_at,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
  return cloneWorkflow();
}

export async function setOrderWorkflowStatusEnabled(
  input: OrderWorkflowStatusEnabledInput,
  actor?: AuditActor,
): Promise<OrderWorkflowStatus> {
  return updateOrderWorkflowStatus(input.id, { enabled: input.enabled }, actor);
}

export async function updateOrderWorkflowTransitions(
  input: OrderWorkflowTransitionsUpdateInput,
  _actor?: AuditActor,
): Promise<OrderWorkflow> {
  const from = workflowStatuses.find((status) => status.code === input.from_status_code);
  if (!from) throw new Error("来源状态不存在");
  const byTarget = new Map(input.transitions.map((item) => [item.to_status_code, item]));
  const targets = workflowStatuses
    .filter((status) => status.code !== from.code)
    .map((status, index) => ({
      to_status_code: status.code,
      enabled: Boolean(byTarget.get(status.code)?.enabled),
      is_primary: Boolean(
        byTarget.get(status.code)?.enabled && byTarget.get(status.code)?.is_primary,
      ),
      sort_order: byTarget.get(status.code)?.sort_order ?? (index + 1) * 10,
    }));
  const primaryIndex = targets.findIndex((target) => target.enabled && target.is_primary);
  const firstEnabledIndex = targets.findIndex((target) => target.enabled);
  const now = new Date().toISOString();
  workflowTransitions = workflowTransitions.filter(
    (transition) => transition.from_status_code !== from.code,
  );
  workflowTransitions = [
    ...workflowTransitions,
    ...targets.map((target, index) => ({
      id: `mock-transition-${from.code}-${target.to_status_code}`,
      store_id: mockStoreId,
      from_status_code: from.code,
      to_status_code: target.to_status_code,
      enabled: target.enabled,
      is_primary:
        target.enabled &&
        (primaryIndex >= 0 ? index === primaryIndex : index === firstEnabledIndex),
      sort_order: target.sort_order,
      created_at: now,
      updated_at: now,
    })),
  ];
  return cloneWorkflow();
}

// GET /api/orders/[id]
export async function getOrder(id: string, _actor?: AuditActor) {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  return {
    order: decorate(o),
    customer: getCustomer(o.customer_id),
    device: getDevice(o.device_id),
    supplier: getSupplier(o.supplier_id),
    events: [...extraEvents.filter((event) => event.order_id === o.id), ...getEvents(o.id)].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ),
    messages: [
      ...extraMessages.filter((message) => message.order_id === o.id),
      ...getMessages(o.id),
    ].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()),
  };
}

// POST /api/orders/[id]/transition
export async function transitionOrder(
  id: string,
  to: RepairOrderStatus,
  opts: { reason?: string; operator?: MockOperator; storeId?: string } = {},
) {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  const allowed = workflowTransitions.some(
    (transition) =>
      transition.from_status_code === o.status &&
      transition.to_status_code === to &&
      transition.enabled,
  );
  if (!allowed) {
    const fromLabel =
      workflowStatuses.find((status) => status.code === o.status)?.label ?? o.status;
    const toLabel = workflowStatuses.find((status) => status.code === to)?.label ?? to;
    throw new Error(`「${fromLabel}」不能直接流转到「${toLabel}」`);
  }
  const from = o.status;
  o.status = to;
  o.updated_at = new Date().toISOString();
  if (to === "cancelled" && opts.reason) o.cancel_reason = opts.reason;
  if (to === "completed") o.completed_at = o.updated_at;
  if (to === "waiting_approval") o.approval_sent_at = o.updated_at;
  return { ok: true, from, to };
}

// POST /api/orders/batch-transition
export async function batchTransition(
  ids: string[],
  to: RepairOrderStatus,
  operator: MockOperator = "前台",
) {
  let count = 0;
  const failures: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      await transitionOrder(id, to, { operator });
      count++;
    } catch (e) {
      failures.push({ id, reason: (e as Error).message });
    }
  }
  return { ok: failures.length === 0, count, failures };
}

// POST /api/orders/[id]/payment
export async function recordPayment(
  id: string,
  amount: number,
  method = "现金",
  operator: MockOperator = "前台",
) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("收款金额必须大于 0");
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  if (o.balance_amount <= 0 || o.is_paid) throw new Error("该工单已结清");
  if (amount > o.balance_amount) throw new Error("收款金额不能超过未结清尾款");
  o.balance_amount = Math.max(0, o.balance_amount - amount);
  if (o.balance_amount === 0) o.is_paid = true;
  const now = new Date().toISOString();
  o.updated_at = now;
  extraEvents.unshift({
    id: `event_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    order_id: id,
    event_type: "payment",
    payload: { amount, method, balance: o.balance_amount, currency_code: CURRENCY_CODE },
    operator_name: operatorName(operator),
    created_at: now,
  });
  return { ok: true, balance: o.balance_amount, is_paid: o.is_paid };
}

const PATCH_FIELD_LABELS: Record<keyof PatchOrderInput["changes"], string> = {
  customer_name: "客户姓名",
  customer_phone: "手机号",
  device_brand: "设备品牌",
  device_model: "设备型号",
  device_imei: "IMEI/序列号",
  device_notes: "设备备注",
  issue_description: "故障描述",
  diagnosis_result: "诊断结果",
  accessory_notes: "留存备注",
  warranty_text: "质保",
};

function normalizeFaultPriceInput(input: PatchOrderFinanceInput["fault_prices"]) {
  return input.map((item) => {
    const name = item.name.trim();
    const price = Number(item.price);
    if (!name) throw new Error("报价项目名称不能为空");
    if (!Number.isFinite(price) || price < 0) throw new Error("报价金额不能为负数");
    return {
      name,
      price,
      currency_code: CURRENCY_CODE,
      ...(item.note?.trim() ? { note: item.note.trim() } : {}),
    };
  });
}

function writeMergedPatchEvent(
  orderId: string,
  changedFields: string[],
  now: string,
  operator: MockOperator,
) {
  const name = operatorName(operator);
  const cutoff = Date.now() - 5 * 60 * 1000;
  const previous = extraEvents.find(
    (event) =>
      event.order_id === orderId &&
      event.event_type === "note" &&
      event.payload.action === "order_patched" &&
      new Date(event.created_at).getTime() >= cutoff,
  );

  if (previous) {
    const existingFields = Array.isArray(previous.payload.changed_fields)
      ? previous.payload.changed_fields.filter(
          (field): field is string => typeof field === "string",
        )
      : [];
    previous.payload = {
      ...previous.payload,
      changed_fields: Array.from(new Set([...existingFields, ...changedFields])),
      currency_code: CURRENCY_CODE,
    };
    previous.created_at = now;
    previous.operator_name = name;
    return;
  }

  extraEvents.unshift({
    id: `evt_patch_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    order_id: orderId,
    event_type: "note",
    payload: {
      action: "order_patched",
      changed_fields: changedFields,
      currency_code: CURRENCY_CODE,
    },
    operator_name: name,
    created_at: now,
  });
}

export async function updateOrder(
  id: string,
  input: UpdateOrderInput,
  operator: MockOperator = "前台",
): Promise<{ ok: boolean }> {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");

  const customer = getCustomer(o.customer_id);
  const device = getDevice(o.device_id);
  if (!customer || !device) throw new Error("工单缺少客户或设备关联");

  const customerName = input.customer_name.trim();
  const customerPhone = input.customer_phone.trim();
  const deviceBrand = input.device_brand.trim();
  const deviceModel = input.device_model.trim();
  const issueDescription = input.issue_description.trim();
  if (!customerName || !customerPhone) throw new Error("客户姓名和手机号不能为空");
  if (!deviceBrand || !deviceModel) throw new Error("设备品牌和型号不能为空");
  if (!issueDescription) throw new Error("故障描述不能为空");

  const validFaults = input.fault_prices
    .filter((item) => item.name.trim() && Number(item.price) >= 0)
    .map((item) => ({
      name: item.name.trim(),
      price: Number(item.price),
      currency_code: CURRENCY_CODE,
      ...(item.note?.trim() ? { note: item.note.trim() } : {}),
    }));
  const quotation = validFaults.reduce((sum, item) => sum + item.price, 0);
  const deposit = Number(input.deposit_amount ?? 0);
  if (!Number.isFinite(deposit) || deposit < 0) throw new Error("押金不能为负数");
  if (deposit > quotation) throw new Error("押金不能超过总报价");

  const paidAmount = Math.max(0, o.quotation_amount - o.deposit_amount - o.balance_amount);
  const nextBalance = Math.max(0, quotation - deposit - paidAmount);
  const tagInput = normalizeOrderTagInput({
    internalTag: input.internal_tag,
    accessoryNotes: input.accessory_notes,
  });
  const now = new Date().toISOString();
  const warranty = normalizeWarrantyPayload({
    warranty_months: input.warranty_months,
    warranty_text: input.warranty_text,
    warranty_change_reason: input.warranty_change_reason,
    defaultWarrantyMonths: 6,
  });
  const previousWarrantyMonths =
    typeof o.warranty_months === "number"
      ? o.warranty_months
      : parseWarrantyMonths(o.warranty_text, 6);
  const previousWarrantyReason = o.warranty_change_reason;
  const warrantyChanged =
    previousWarrantyMonths !== warranty.warranty_months ||
    (previousWarrantyReason ?? "") !== (warranty.warranty_change_reason ?? "");
  const phoneBook = normalizePhoneBook(customerPhone, customer.contact_phones);
  if (!phoneBook.primaryRaw) throw new Error("手机号格式不正确");
  const customerContactPhones = mergeContactPhones(
    customer.contact_phones,
    phoneBook.contacts,
    phoneBook.primaryRaw,
  );
  assertCustomerPhoneAvailable(customer.id, phoneBook.primaryRaw, customerContactPhones);

  customer.name = customerName;
  customer.phone_e164 = phoneBook.primary;
  customer.phone_raw = phoneBook.primaryRaw;
  customer.contact_phones = customerContactPhones;

  o.issue_description = issueDescription;
  o.diagnosis_result = input.diagnosis_result?.trim() || undefined;
  o.internal_tag = tagInput.internalTag;
  o.accessory_notes = tagInput.accessoryNotes;
  o.warranty_text = warranty.warranty_text;
  o.warranty_months = warranty.warranty_months;
  o.warranty_change_reason = warranty.warranty_change_reason;
  if (warrantyChanged) {
    o.warranty_changed_by = typeof operator === "string" ? undefined : operator.id;
    o.warranty_changed_at = now;
  }
  o.contact_phones = customerContactPhones;
  o.quotation_amount = quotation;
  o.deposit_amount = deposit;
  o.balance_amount = nextBalance;
  o.is_paid = nextBalance === 0;
  o.fault_prices = validFaults;
  o.currency_code = CURRENCY_CODE;
  o.device_snapshot = {
    brand: deviceBrand,
    model: deviceModel,
    serial_or_imei: input.device_imei?.trim() ?? "",
    ...(input.device_notes?.trim() ? { device_notes: input.device_notes.trim() } : {}),
  };
  o.updated_at = now;

  extraEvents.unshift({
    id: `evt_update_${Date.now()}`,
    order_id: id,
    event_type: "note",
    payload: {
      action: "order_updated",
      quotation_amount: quotation,
      deposit_amount: deposit,
      balance_amount: nextBalance,
      internal_tag: tagInput.internalTag,
      accessory_notes: tagInput.accessoryNotes,
      warranty_months: warranty.warranty_months,
      warranty_text: warranty.warranty_text,
      currency_code: CURRENCY_CODE,
    },
    operator_name: operatorName(operator),
    created_at: now,
  });

  if (warrantyChanged) {
    extraEvents.unshift({
      id: `evt_warranty_${Date.now()}`,
      order_id: id,
      event_type: "note",
      payload: {
        action: "warranty_changed",
        from_months: previousWarrantyMonths,
        from_text: formatWarrantyText(previousWarrantyMonths),
        to_months: warranty.warranty_months,
        to_text: warranty.warranty_text,
        reason: warranty.warranty_change_reason ?? null,
        default_months: 6,
      },
      operator_name: operatorName(operator),
      created_at: now,
    });
  }

  return { ok: true };
}

export async function patchOrder(
  id: string,
  input: PatchOrderInput,
  operator: MockOperator = "前台",
): Promise<PatchOrderResult> {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  if (!input.expected_updated_at) throw new Error("缺少工单版本时间");
  if (o.updated_at !== input.expected_updated_at) throw new Error("工单已被更新，请刷新后再试");

  const rawEntries = Object.entries(input.changes).filter(([, value]) => value !== undefined);
  const unsupportedField = rawEntries.find(([field]) => !(field in PATCH_FIELD_LABELS))?.[0];
  if (unsupportedField) throw new Error(`${unsupportedField} 不可通过快速编辑修改`);
  const entries = rawEntries as [keyof PatchOrderInput["changes"], string][];
  if (entries.length === 0) throw new Error("没有可保存的字段");

  const customer = getCustomer(o.customer_id);
  const device = getDevice(o.device_id);
  if (!customer || !device) throw new Error("工单缺少客户或设备关联");

  const nextSnapshot = {
    brand: o.device_snapshot?.brand || device.brand,
    model: o.device_snapshot?.model || device.model,
    serial_or_imei: o.device_snapshot?.serial_or_imei || device.serial_or_imei,
    device_notes: o.device_snapshot?.device_notes || device.device_notes,
  };
  const changedFields: string[] = [];

  for (const [field, rawValue] of entries) {
    const value = rawValue.trim();
    changedFields.push(PATCH_FIELD_LABELS[field]);
    switch (field) {
      case "customer_name":
        if (!value) throw new Error("客户姓名不能为空");
        customer.name = value;
        break;
      case "customer_phone":
        if (!value) throw new Error("手机号不能为空");
        {
          const phoneBook = normalizePhoneBook(value, customer.contact_phones);
          if (!phoneBook.primaryRaw) throw new Error("手机号格式不正确");
          const contactPhones = mergeContactPhones(
            customer.contact_phones,
            phoneBook.contacts,
            phoneBook.primaryRaw,
          );
          assertCustomerPhoneAvailable(customer.id, phoneBook.primaryRaw, contactPhones);
          customer.phone_e164 = phoneBook.primary;
          customer.phone_raw = phoneBook.primaryRaw;
          customer.contact_phones = contactPhones;
          o.contact_phones = contactPhones;
        }
        break;
      case "device_brand":
        if (!value) throw new Error("设备品牌不能为空");
        nextSnapshot.brand = value;
        break;
      case "device_model":
        if (!value) throw new Error("设备型号不能为空");
        nextSnapshot.model = value;
        break;
      case "device_imei":
        nextSnapshot.serial_or_imei = value;
        break;
      case "device_notes":
        nextSnapshot.device_notes = value || undefined;
        break;
      case "issue_description":
        if (!value) throw new Error("故障描述不能为空");
        o.issue_description = value;
        break;
      case "diagnosis_result":
        o.diagnosis_result = value || undefined;
        break;
      case "accessory_notes": {
        const tagInput = normalizeOrderTagInput({ accessoryNotes: value });
        o.accessory_notes = tagInput.accessoryNotes;
        break;
      }
      case "warranty_text":
        o.warranty_text = value || undefined;
        break;
    }
  }

  if (
    entries.some(([field]) =>
      ["device_brand", "device_model", "device_imei", "device_notes"].includes(field),
    )
  ) {
    if (!nextSnapshot.brand || !nextSnapshot.model) throw new Error("设备品牌和型号不能为空");
    o.device_snapshot = nextSnapshot;
  }

  const now = new Date().toISOString();
  o.updated_at = now;
  writeMergedPatchEvent(id, changedFields, now, operator);
  return { ok: true, updated_at: now };
}

export async function patchOrderFinance(
  id: string,
  input: PatchOrderFinanceInput,
  operator: MockOperator = "前台",
): Promise<PatchOrderResult> {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  if (!input.expected_updated_at) throw new Error("缺少工单版本时间");
  if (o.updated_at !== input.expected_updated_at) throw new Error("工单已被更新，请刷新后再试");

  const validFaults = normalizeFaultPriceInput(input.fault_prices);
  const quotation = validFaults.reduce((sum, item) => sum + item.price, 0);
  const deposit = Number(input.deposit_amount ?? 0);
  if (!Number.isFinite(deposit) || deposit < 0) throw new Error("押金不能为负数");
  if (deposit > quotation) throw new Error("押金不能超过总报价");

  const paidAmount = Math.max(0, o.quotation_amount - o.deposit_amount - o.balance_amount);
  const nextBalance = Math.max(0, quotation - deposit - paidAmount);
  const now = new Date().toISOString();

  o.quotation_amount = quotation;
  o.deposit_amount = deposit;
  o.balance_amount = nextBalance;
  o.is_paid = nextBalance === 0;
  o.fault_prices = validFaults;
  o.currency_code = CURRENCY_CODE;
  o.updated_at = now;

  extraEvents.unshift({
    id: `evt_finance_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    order_id: id,
    event_type: "note",
    payload: {
      action: "order_finance_updated",
      quotation_amount: quotation,
      deposit_amount: deposit,
      balance_amount: nextBalance,
      currency_code: CURRENCY_CODE,
    },
    operator_name: operatorName(operator),
    created_at: now,
  });

  return { ok: true, updated_at: now };
}

// POST /api/orders/[id]/notify
export async function sendNotification(
  id: string,
  body: string,
  channel: "whatsapp" | "sms" = "whatsapp",
  operator: MockOperator = "前台",
) {
  const message = body.trim();
  if (!message) throw new Error("通知内容不能为空");
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  const now = new Date().toISOString();
  const messageId = `msg_${Date.now()}`;
  o.updated_at = now;
  extraMessages.unshift({
    id: messageId,
    order_id: id,
    channel,
    message_body: message,
    status: "sent",
    sent_at: now,
  });
  extraEvents.unshift({
    id: `evt_message_${Date.now()}`,
    order_id: id,
    event_type: "message_sent",
    payload: { channel, message_id: messageId },
    operator_name: operatorName(operator),
    created_at: now,
  });
  return { ok: true, id: messageId, channel, body: message };
}

function writeMockWhatsappMessage({
  id,
  body,
  templateKind,
  eventType,
  transitionTo,
  operator = "前台",
  allowInvalidTransition = false,
  markApprovalPending = false,
}: {
  id: string;
  body: string;
  templateKind: OrderWhatsappTemplateKind;
  eventType: "message_sent" | "approval_sent";
  transitionTo?: RepairOrderStatus;
  operator?: MockOperator;
  allowInvalidTransition?: boolean;
  markApprovalPending?: boolean;
}): WhatsappNotificationResult {
  const message = body.trim();
  if (!message) throw new Error("通知内容不能为空");
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  const now = new Date().toISOString();
  const messageId = `msg_whatsapp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const from = o.status;
  let statusChanged = false;
  let to: RepairOrderStatus | undefined;

  if (transitionTo) {
    const allowed = workflowTransitions.some(
      (transition) =>
        transition.from_status_code === from &&
        transition.to_status_code === transitionTo &&
        transition.enabled,
    );
    if (!allowed) {
      if (!allowInvalidTransition) {
        const fromLabel = workflowStatuses.find((status) => status.code === from)?.label ?? from;
        const toLabel =
          workflowStatuses.find((status) => status.code === transitionTo)?.label ?? transitionTo;
        throw new Error(`「${fromLabel}」不能直接流转到「${toLabel}」`);
      }
    } else {
      statusChanged = true;
      to = transitionTo;
      o.status = to;
      if (to === "completed") o.completed_at = now;
      if (to === "waiting_approval") o.approval_sent_at = now;
    }
  }

  if (markApprovalPending) {
    o.approval_status = "pending";
    o.approval_sent_at = now;
  }
  o.updated_at = now;

  extraMessages.unshift({
    id: messageId,
    order_id: id,
    channel: "whatsapp",
    message_body: message,
    status: "sent",
    sent_at: now,
  });
  extraEvents.unshift({
    id: `evt_whatsapp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    order_id: id,
    event_type: eventType,
    payload: {
      channel: "whatsapp",
      message_id: messageId,
      template_kind: templateKind,
      status_changed: statusChanged,
      currency_code: CURRENCY_CODE,
      ...(transitionTo ? { from, to: statusChanged && to ? to : from } : {}),
    },
    operator_name: operatorName(operator),
    created_at: now,
  });
  return {
    ok: true,
    id: messageId,
    channel: "whatsapp",
    body: message,
    template_kind: templateKind,
    statusChanged,
    from,
    to,
  };
}

export async function sendWhatsappNotification(
  id: string,
  body: string,
  templateKind: OrderWhatsappTemplateKind,
  transitionTo?: RepairOrderStatus,
  operator: MockOperator = "前台",
) {
  return writeMockWhatsappMessage({
    id,
    body,
    templateKind,
    eventType: "message_sent",
    transitionTo,
    operator,
  });
}

export async function sendApprovalRequest(
  id: string,
  body: string,
  operator: MockOperator = "前台",
) {
  return writeMockWhatsappMessage({
    id,
    body,
    templateKind: "approval_request",
    eventType: "approval_sent",
    transitionTo: "waiting_approval",
    operator,
    allowInvalidTransition: true,
    markApprovalPending: true,
  });
}

// GET /api/customers/suggest?q=
export async function createOrder(
  input: CreateOrderInput,
  operator: MockOperator = "前台",
): Promise<{ id: string }> {
  const requestedStatus = workflowStatuses.find((status) => status.code === input.status);
  const status =
    requestedStatus?.enabled && requestedStatus.allowed_for_create
      ? requestedStatus.code
      : workflowStatuses.find((item) => item.enabled && item.is_default_create_status)?.code;
  if (!status) throw new Error("店铺没有可用于新建工单的状态");
  if (!input.issue_description.trim()) throw new Error("故障描述不能为空");
  if (input.device_id && !input.customer_id) throw new Error("选择现有设备时必须同时选择客户");

  let customer = input.customer_id ? getCustomer(input.customer_id) : undefined;
  if (input.customer_id && !customer) throw new Error("读取客户失败");
  let customerContactPhones = customer?.contact_phones ?? [];
  if (customer && input.customer_phone?.trim()) {
    const phoneBook = normalizePhoneBook(input.customer_phone, customer.contact_phones);
    const primaryRaw = phoneBook.primaryRaw || customer.phone_raw;
    customerContactPhones = mergeContactPhones(
      customer.contact_phones,
      phoneBook.contacts,
      primaryRaw,
    );
    customer.contact_phones = customerContactPhones;
  }
  if (!customer) {
    if (!input.customer_name?.trim() || !input.customer_phone?.trim()) {
      throw new Error("客户姓名和手机号不能为空");
    }
    const phoneBook = normalizePhoneBook(input.customer_phone);
    const raw = phoneBook.primaryRaw;
    if (!raw) throw new Error("手机号格式不正确");
    customer = customers.find((item) => item.phone_raw === raw);
    if (!customer) {
      customer = {
        id: mockId("cus_new"),
        name: input.customer_name.trim(),
        phone_raw: raw,
        phone_e164: phoneBook.primary,
        contact_phones: phoneBook.contacts,
        consent_marketing: false,
        consent_sms: true,
        preferred_channel: "whatsapp",
        language: "it",
      };
      customers.push(customer);
      customerContactPhones = phoneBook.contacts;
    } else {
      customerContactPhones = mergeContactPhones(customer.contact_phones, phoneBook.contacts, raw);
      customer.contact_phones = customerContactPhones;
    }
  }
  let device = input.device_id ? getDevice(input.device_id) : undefined;
  if (input.device_id && !device) throw new Error("读取设备失败");
  if (device && device.customer_id !== customer.id) throw new Error("设备不属于当前客户");
  if (!device) {
    if (!input.device_brand?.trim() || !input.device_model?.trim()) {
      throw new Error("设备品牌和型号不能为空");
    }
    device = {
      id: mockId("dev_new"),
      customer_id: customer.id,
      brand: input.device_brand.trim(),
      model: input.device_model.trim(),
      serial_or_imei: input.device_imei?.trim() ?? "",
      device_notes: input.device_notes?.trim() || undefined,
    };
    devices.push(device);
  }
  const validFaults = input.fault_prices
    .filter((item) => item.name.trim() && Number(item.price) >= 0)
    .map((item) => ({
      ...item,
      name: item.name.trim(),
      price: Number(item.price),
      currency_code: CURRENCY_CODE,
    }));
  const quotation = validFaults.reduce((s, f) => s + (f.price || 0), 0);
  const deposit = input.deposit_amount ?? 0;
  if (!Number.isFinite(deposit) || deposit < 0) throw new Error("押金不能为负数");
  if (deposit > quotation) throw new Error("押金不能超过总报价");
  const id = mockId("ord_new");
  const seq = orders.length + 1;
  const now = new Date().toISOString();
  const balance = Math.max(0, quotation - deposit);
  const tagInput = normalizeOrderTagInput({
    internalTag: input.internal_tag,
    accessoryNotes: input.accessory_notes,
  });
  const warranty = normalizeWarrantyPayload({
    warranty_months: input.warranty_months,
    warranty_text: input.warranty_text,
    warranty_change_reason: input.warranty_change_reason,
    defaultWarrantyMonths: 6,
  });
  const warrantyChangedFromDefault = warrantyReasonRequired(warranty.warranty_months, 6);
  const newOrder: RepairOrder = {
    id,
    public_no: `R${(2026000 + seq).toString().padStart(7, "0")}`,
    order_type: input.order_type,
    status,
    customer_id: customer.id,
    device_id: device.id,
    issue_description: input.issue_description,
    quotation_amount: quotation,
    deposit_amount: deposit,
    balance_amount: balance,
    currency_code: CURRENCY_CODE,
    is_paid: balance === 0,
    approval_status: "pending",
    technician_name: operatorName(operator),
    internal_tag: tagInput.internalTag,
    accessory_notes: tagInput.accessoryNotes,
    warranty_text: warranty.warranty_text,
    warranty_months: warranty.warranty_months,
    warranty_change_reason: warranty.warranty_change_reason,
    warranty_changed_by:
      warrantyChangedFromDefault && typeof operator !== "string" ? operator.id : undefined,
    warranty_changed_at: warrantyChangedFromDefault ? now : undefined,
    contact_phones: customerContactPhones,
    fault_prices: validFaults,
    device_snapshot: {
      brand: device.brand,
      model: device.model,
      serial_or_imei: device.serial_or_imei,
      ...(device.device_notes ? { device_notes: device.device_notes } : {}),
    },
    created_at: now,
    updated_at: now,
  };
  orders.unshift(newOrder);
  return { id };
}
