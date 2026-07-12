import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type {
  DashboardSummary,
  OrderDetail,
  OrderListItem,
  OrderQueueSummary,
} from "@/lib/repairdesk/types";

import { ordersKeys } from "./query-keys";
import {
  patchOrderReadCaches,
  restoreOrderReadCaches,
  snapshotOrderReadCaches,
} from "./cache-sync";

describe("order cache sync", () => {
  it("patches queue summary, dashboard summary, and detail caches for an order", () => {
    const queryClient = new QueryClient();
    const order = makeOrder({ id: "order-1", updated_at: "old" });

    queryClient.setQueryData(
      ordersKeys.queueSummary({ page: 1 }, storeId),
      makeQueueSummary(order),
    );
    queryClient.setQueryData(ordersKeys.dashboardSummary({}, storeId), makeDashboardSummary(order));
    queryClient.setQueryData(ordersKeys.detail(order.id, storeId), makeDetail(order));

    patchOrderReadCaches(queryClient, order.id, {
      parts_supplier_id: "supplier-1",
      updated_at: "new",
    });

    expect(
      queryClient.getQueryData<OrderQueueSummary>(ordersKeys.queueSummary({ page: 1 }, storeId))
        ?.list.items[0],
    ).toMatchObject({ parts_supplier_id: "supplier-1", updated_at: "new" });
    expect(
      queryClient.getQueryData<DashboardSummary>(ordersKeys.dashboardSummary({}, storeId))
        ?.recentOrders.items[0],
    ).toMatchObject({ parts_supplier_id: "supplier-1", updated_at: "new" });
    expect(
      queryClient.getQueryData<OrderDetail>(ordersKeys.detail(order.id, storeId))?.order,
    ).toMatchObject({
      parts_supplier_id: "supplier-1",
      updated_at: "new",
    });
  });

  it("can roll back an optimistic cache patch", () => {
    const queryClient = new QueryClient();
    const order = makeOrder({ id: "order-1", parts_supplier_id: "supplier-old" });

    queryClient.setQueryData(
      ordersKeys.queueSummary({ page: 1 }, storeId),
      makeQueueSummary(order),
    );
    const snapshot = snapshotOrderReadCaches(queryClient, order.id);

    patchOrderReadCaches(queryClient, order.id, { parts_supplier_id: "supplier-new" });
    restoreOrderReadCaches(queryClient, snapshot);

    expect(
      queryClient.getQueryData<OrderQueueSummary>(ordersKeys.queueSummary({ page: 1 }, storeId))
        ?.list.items[0]?.parts_supplier_id,
    ).toBe("supplier-old");
  });

  it("clears a parts supplier marker from cached order rows", () => {
    const queryClient = new QueryClient();
    const order = makeOrder({ id: "order-1", parts_supplier_id: "supplier-old" });

    queryClient.setQueryData(
      ordersKeys.queueSummary({ page: 1 }, storeId),
      makeQueueSummary(order),
    );

    patchOrderReadCaches(queryClient, order.id, { parts_supplier_id: null });

    expect(
      queryClient.getQueryData<OrderQueueSummary>(ordersKeys.queueSummary({ page: 1 }, storeId))
        ?.list.items[0]?.parts_supplier_id,
    ).toBeUndefined();
  });
});

const storeId = "store-1";

function makeOrder(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: "order-1",
    public_no: "R2026001",
    status: "new",
    order_type: "quick_repair",
    payment_status: "unpaid",
    approval_status: "pending",
    customer_id: "customer-1",
    device_id: "device-1",
    customer_name: "张伟",
    customer_phone: "+390000000",
    device_label: "Apple iPhone",
    device_imei: "350100000000000",
    issue_description: "屏幕碎裂",
    quotation_amount: 100,
    deposit_amount: 0,
    balance_amount: 100,
    currency_code: "EUR",
    is_paid: false,
    technician_name: "陈师傅",
    contact_phones: [],
    fault_prices: [],
    approval_overdue: false,
    pickup_overdue: false,
    created_at: "2026-07-07T00:00:00.000Z",
    updated_at: "2026-07-07T00:00:00.000Z",
    ...overrides,
  };
}

function makeQueueSummary(order: OrderListItem): OrderQueueSummary {
  return {
    list: {
      items: [order],
      total: 1,
      page: 1,
      pageSize: 50,
      pageCount: 1,
      workflowCounts: { all: 1 } as OrderQueueSummary["list"]["workflowCounts"],
      queueCounts: { all: 1 } as OrderQueueSummary["list"]["queueCounts"],
    },
    workflow: { statuses: [], transitions: [] },
    options: {
      suppliers: [],
      technicians: [],
      permissions: {
        canReadSuppliers: false,
        canAssignSuppliers: false,
        canManageSuppliers: false,
      },
    },
  };
}

function makeDashboardSummary(order: OrderListItem): DashboardSummary {
  return {
    recentOrders: makeQueueSummary(order).list,
    stats: {
      total: 1,
      today: 1,
      inProgress: 0,
      unpaid: 1,
      approvalOverdue: 0,
      pickupOverdue: 0,
    },
  };
}

function makeDetail(order: OrderListItem): OrderDetail {
  return {
    order,
    events: [],
    messages: [],
    attachments: [],
  };
}
