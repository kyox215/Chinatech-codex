import type { RepairOrderStatus } from "@/lib/mock/enums";
import type {
  CreateOrderInput,
  Customer,
  Device,
  OrderDetail,
  OrderListFilters,
  OrderListItem,
  OrderStats,
  BatchTransitionResult,
  PaymentResult,
  RepairDeskOptions,
  UpdateOrderInput,
} from "@/lib/repairdesk/types";

export type {
  CreateOrderInput,
  Customer,
  Device,
  FaultPriceItem,
  OrderDetail,
  OrderListFilters,
  OrderListItem,
  OrderStats,
  BatchTransitionResult,
  PaymentResult,
  RepairDeskOptions,
  UpdateOrderInput,
} from "@/lib/repairdesk/types";

async function source() {
  const { hasSupabaseConfig } = await import("@/server/supabase");
  if (hasSupabaseConfig()) {
    return import("@/server/repairdesk-repository");
  }

  const mock = await import("@/lib/mock/api");
  return {
    ...mock,
    getRepairDeskOptions: async (): Promise<RepairDeskOptions> => ({
      suppliers: mock.suppliers,
      technicians: mock.allTechnicians,
    }),
    recordPayment: async (id: string, amount: number, _method?: string) =>
      mock.recordPayment(id, amount),
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
