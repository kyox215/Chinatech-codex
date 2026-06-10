import type { RepairOrderStatus } from "@/lib/mock/enums";
import type {
  CreateOrderInput,
  Customer,
  Device,
  OrderDetail,
  OrderListFilters,
  OrderListItem,
  OrderListPageInput,
  OrderListResult,
  OrderStats,
  OrderWhatsappTemplateKind,
  BatchTransitionResult,
  CustomerCreateInput,
  CustomerDetail,
  CustomerDeviceInput,
  CustomerFollowupInput,
  CustomerListFilters,
  CustomerListResult,
  CustomerMessageInput,
  CustomerUpdateInput,
  PaymentResult,
  RepairDeskOptions,
  UpdateOrderInput,
  WhatsappNotificationResult,
} from "@/lib/repairdesk/types";

export type {
  CreateOrderInput,
  Customer,
  Device,
  FaultPriceItem,
  MessageLog,
  OrderDetail,
  OrderEvent,
  OrderListFilters,
  OrderListItem,
  OrderListPageInput,
  OrderListResult,
  OrderStats,
  OrderWhatsappTemplateKind,
  BatchTransitionResult,
  CustomerCreateInput,
  CustomerDetail,
  CustomerDeviceInput,
  CustomerFollowup,
  CustomerFollowupInput,
  CustomerInteraction,
  CustomerListFilters,
  CustomerListItem,
  CustomerListResult,
  CustomerMessageInput,
  CustomerStats,
  CustomerTag,
  CustomerUpdateInput,
  PaymentResult,
  RepairOrder,
  RepairDeskOptions,
  UpdateOrderInput,
  WhatsappNotificationResult,
} from "@/lib/repairdesk/types";

async function source() {
  const { hasSupabaseConfig } = await import("@/server/supabase");
  if (hasSupabaseConfig()) {
    const [orders, customers] = await Promise.all([
      import("@/features/orders/server/order.service"),
      import("@/features/customers/server/customer.service"),
    ]);
    return { ...orders, ...customers };
  }

  const mock = await import("@/lib/mock/api");
  return {
    ...mock,
    getRepairDeskOptions: async (): Promise<RepairDeskOptions> => ({
      suppliers: mock.suppliers,
      technicians: mock.allTechnicians,
    }),
    recordPayment: async (id: string, amount: number, method?: string) =>
      mock.recordPayment(id, amount, method),
  };
}

function isServerRuntime() {
  return typeof window === "undefined";
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/repairdesk/${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `请求失败：${response.status}`);
  }
  return payload.data as T;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listOrders(filters: OrderListFilters = {}): Promise<OrderListItem[]> {
  if (isServerRuntime()) return (await source()).listOrders(filters);
  return postJson<OrderListItem[]>("orders/list", filters);
}

export async function listOrdersPage(input: OrderListPageInput = {}): Promise<OrderListResult> {
  if (isServerRuntime()) return (await source()).listOrdersPage(input);
  return postJson<OrderListResult>("orders/list-page", input);
}

export async function getOrderStats(): Promise<OrderStats> {
  if (isServerRuntime()) return (await source()).getOrderStats();
  return requestJson<OrderStats>("order-stats");
}

export async function getOrder(id: string): Promise<OrderDetail> {
  if (isServerRuntime()) return (await source()).getOrder(id);
  return postJson<OrderDetail>("order/get", { id });
}

export async function transitionOrder(
  id: string,
  to: RepairOrderStatus,
  opts: { reason?: string } = {},
) {
  if (isServerRuntime()) return (await source()).transitionOrder(id, to, opts);
  return postJson("order/transition", { id, to, reason: opts.reason });
}

export async function batchTransition(
  ids: string[],
  to: RepairOrderStatus,
): Promise<BatchTransitionResult> {
  if (isServerRuntime()) return (await source()).batchTransition(ids, to);
  return postJson<BatchTransitionResult>("order/batch-transition", { ids, to });
}

export async function recordPayment(
  id: string,
  amount: number,
  method?: string,
): Promise<PaymentResult> {
  if (isServerRuntime()) return (await source()).recordPayment(id, amount, method);
  return postJson<PaymentResult>("order/payment", { id, amount, method });
}

export async function sendNotification(id: string, body: string, channel: "whatsapp" | "sms") {
  if (isServerRuntime()) return (await source()).sendNotification(id, body, channel);
  return postJson("order/notification", { id, body, channel });
}

export async function sendWhatsappNotification(
  id: string,
  body: string,
  templateKind: OrderWhatsappTemplateKind,
  transitionTo?: RepairOrderStatus,
): Promise<WhatsappNotificationResult> {
  if (isServerRuntime()) {
    return (await source()).sendWhatsappNotification(id, body, templateKind, transitionTo);
  }
  return postJson<WhatsappNotificationResult>("order/whatsapp-notification", {
    id,
    body,
    template_kind: templateKind,
    transition_to: transitionTo,
  });
}

export async function sendApprovalRequest(id: string, body: string) {
  if (isServerRuntime()) return (await source()).sendApprovalRequest(id, body);
  return postJson("order/approval-request", { id, body });
}

export async function searchCustomers(q: string, limit = 6): Promise<Customer[]> {
  if (isServerRuntime()) return (await source()).searchCustomers(q, limit);
  return postJson<Customer[]>("customers/search", { q, limit });
}

export async function getCustomerDevices(customerId: string): Promise<Device[]> {
  if (isServerRuntime()) return (await source()).getCustomerDevices(customerId);
  return postJson<Device[]>("customers/devices", { customerId });
}

export async function listCustomers(
  filters: CustomerListFilters = {},
): Promise<CustomerListResult> {
  if (isServerRuntime()) return (await source()).listCustomers(filters);
  return postJson<CustomerListResult>("customers/list", filters);
}

export async function getCustomerDetail(id: string): Promise<CustomerDetail> {
  if (isServerRuntime()) return (await source()).getCustomerDetail(id);
  return postJson<CustomerDetail>("customer/get", { id });
}

export async function createCustomer(input: CustomerCreateInput): Promise<{ id: string }> {
  if (isServerRuntime()) return (await source()).createCustomer(input);
  return postJson<{ id: string }>("customer/create", { input });
}

export async function updateCustomer(
  id: string,
  input: CustomerUpdateInput,
): Promise<{ ok: boolean }> {
  if (isServerRuntime()) return (await source()).updateCustomer(id, input);
  return postJson<{ ok: boolean }>("customer/update", { id, input });
}

export async function upsertCustomerDevice(
  customerId: string,
  input: CustomerDeviceInput,
): Promise<{ id: string }> {
  if (isServerRuntime()) return (await source()).upsertCustomerDevice(customerId, input);
  return postJson<{ id: string }>("customer/device/upsert", { customerId, input });
}

export async function deleteCustomerDevice(
  customerId: string,
  deviceId: string,
): Promise<{ ok: boolean }> {
  if (isServerRuntime()) return (await source()).deleteCustomerDevice(customerId, deviceId);
  return postJson<{ ok: boolean }>("customer/device/delete", { customerId, deviceId });
}

export async function setCustomerTags(
  customerId: string,
  tagIds: string[],
): Promise<{ ok: boolean }> {
  if (isServerRuntime()) return (await source()).setCustomerTags(customerId, tagIds);
  return postJson<{ ok: boolean }>("customer/tags/update", { customerId, tagIds });
}

export async function createCustomerFollowup(
  customerId: string,
  input: CustomerFollowupInput,
): Promise<{ id: string }> {
  if (isServerRuntime()) return (await source()).createCustomerFollowup(customerId, input);
  return postJson<{ id: string }>("customer/followup/create", { customerId, input });
}

export async function completeCustomerFollowup(
  customerId: string,
  followupId: string,
): Promise<{ ok: boolean }> {
  if (isServerRuntime()) return (await source()).completeCustomerFollowup(customerId, followupId);
  return postJson<{ ok: boolean }>("customer/followup/complete", { customerId, followupId });
}

export async function sendCustomerMessage(
  customerId: string,
  input: CustomerMessageInput,
): Promise<{ ok: boolean; id: string }> {
  if (isServerRuntime()) return (await source()).sendCustomerMessage(customerId, input);
  return postJson<{ ok: boolean; id: string }>("customer/message", { customerId, input });
}

export async function createOrder(input: CreateOrderInput): Promise<{ id: string }> {
  if (isServerRuntime()) return (await source()).createOrder(input);
  return postJson<{ id: string }>("orders/create", input);
}

export async function updateOrder(id: string, input: UpdateOrderInput): Promise<{ ok: boolean }> {
  if (isServerRuntime()) return (await source()).updateOrder(id, input);
  return postJson<{ ok: boolean }>("order/update", { id, input });
}

export async function getRepairDeskOptions(): Promise<RepairDeskOptions> {
  if (isServerRuntime()) return (await source()).getRepairDeskOptions();
  return requestJson<RepairDeskOptions>("options");
}
