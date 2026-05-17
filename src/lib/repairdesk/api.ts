import { createIsomorphicFn, createServerFn } from "@tanstack/react-start";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import type {
  CreateOrderInput,
  Customer,
  Device,
  OrderDetail,
  OrderListFilters,
  OrderListItem,
  OrderStats,
  RepairDeskOptions,
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
  RepairDeskOptions,
} from "@/lib/repairdesk/types";

const source = createIsomorphicFn()
  .client(async () => {
    throw new Error("RepairDesk data source is server-only");
  })
  .server(async () => {
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
      recordPayment: async (id: string, amount: number) => mock.recordPayment(id, amount),
    };
  });

function isServerRuntime() {
  return typeof window === "undefined";
}

const listOrdersFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => (data ?? {}) as OrderListFilters)
  .handler(async ({ data }) => (await source()).listOrders(data));

export async function listOrders(filters: OrderListFilters = {}): Promise<OrderListItem[]> {
  if (isServerRuntime()) return (await source()).listOrders(filters);
  return listOrdersFn({ data: filters }) as Promise<OrderListItem[]>;
}

const getOrderStatsFn = createServerFn({ method: "GET" }).handler(async () =>
  (await source()).getOrderStats(),
);

export async function getOrderStats(): Promise<OrderStats> {
  if (isServerRuntime()) return (await source()).getOrderStats();
  return getOrderStatsFn() as Promise<OrderStats>;
}

const getOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data as { id: string })
  .handler(async ({ data }) => (await source()).getOrder(data.id));

export async function getOrder(id: string): Promise<OrderDetail> {
  if (isServerRuntime()) return (await source()).getOrder(id);
  return getOrderFn({ data: { id } }) as Promise<OrderDetail>;
}

const transitionOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data as { id: string; to: RepairOrderStatus; reason?: string })
  .handler(async ({ data }) =>
    (await source()).transitionOrder(data.id, data.to, { reason: data.reason }),
  );

export async function transitionOrder(
  id: string,
  to: RepairOrderStatus,
  opts: { reason?: string } = {},
) {
  if (isServerRuntime()) return (await source()).transitionOrder(id, to, opts);
  return transitionOrderFn({ data: { id, to, reason: opts.reason } });
}

const batchTransitionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data as { ids: string[]; to: RepairOrderStatus })
  .handler(async ({ data }) => (await source()).batchTransition(data.ids, data.to));

export async function batchTransition(ids: string[], to: RepairOrderStatus) {
  if (isServerRuntime()) return (await source()).batchTransition(ids, to);
  return batchTransitionFn({ data: { ids, to } });
}

const recordPaymentFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data as { id: string; amount: number; method?: string })
  .handler(async ({ data }) => (await source()).recordPayment(data.id, data.amount, data.method));

export async function recordPayment(id: string, amount: number, method?: string) {
  if (isServerRuntime()) return (await source()).recordPayment(id, amount, method);
  return recordPaymentFn({ data: { id, amount, method } });
}

const sendNotificationFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: unknown) => data as { id: string; body: string; channel: "whatsapp" | "sms" },
  )
  .handler(async ({ data }) => (await source()).sendNotification(data.id, data.body, data.channel));

export async function sendNotification(id: string, body: string, channel: "whatsapp" | "sms") {
  if (isServerRuntime()) return (await source()).sendNotification(id, body, channel);
  return sendNotificationFn({ data: { id, body, channel } });
}

const searchCustomersFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data as { q: string; limit?: number })
  .handler(async ({ data }) => (await source()).searchCustomers(data.q, data.limit));

export async function searchCustomers(q: string, limit = 6): Promise<Customer[]> {
  if (isServerRuntime()) return (await source()).searchCustomers(q, limit);
  return searchCustomersFn({ data: { q, limit } }) as Promise<Customer[]>;
}

const getCustomerDevicesFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data as { customerId: string })
  .handler(async ({ data }) => (await source()).getCustomerDevices(data.customerId));

export async function getCustomerDevices(customerId: string): Promise<Device[]> {
  if (isServerRuntime()) return (await source()).getCustomerDevices(customerId);
  return getCustomerDevicesFn({ data: { customerId } }) as Promise<Device[]>;
}

const createOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data as CreateOrderInput)
  .handler(async ({ data }) => (await source()).createOrder(data));

export async function createOrder(input: CreateOrderInput): Promise<{ id: string }> {
  if (isServerRuntime()) return (await source()).createOrder(input);
  return createOrderFn({ data: input }) as Promise<{ id: string }>;
}

const getRepairDeskOptionsFn = createServerFn({ method: "GET" }).handler(async () =>
  (await source()).getRepairDeskOptions(),
);

export async function getRepairDeskOptions(): Promise<RepairDeskOptions> {
  if (isServerRuntime()) return (await source()).getRepairDeskOptions();
  return getRepairDeskOptionsFn() as Promise<RepairDeskOptions>;
}
