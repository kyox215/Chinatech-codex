import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type {
  DashboardSummary,
  OrderDetail,
  OrderListItem,
  OrderListResult,
  OrderQueueSummary,
} from "@/lib/repairdesk/types";
import { customersKeys } from "@/features/customers/api/query-keys";

import { ordersKeys } from "./query-keys";
import {
  invalidateOrderReadCaches,
  patchOrderReadCaches,
  restoreOrderReadCaches,
  snapshotOrderReadCaches,
} from "./cache-sync";

describe("order cache sync", () => {
  it("invalidates customer lists and details when an order-derived aggregate changes", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(customersKeys.list({}, storeId), { items: [] });
    queryClient.setQueryData(customersKeys.detail("customer-1", storeId), { customer: {} });

    invalidateOrderReadCaches(queryClient, "order-1");

    expect(queryClient.getQueryState(customersKeys.list({}, storeId))?.isInvalidated).toBe(true);
    expect(
      queryClient.getQueryState(customersKeys.detail("customer-1", storeId))?.isInvalidated,
    ).toBe(true);
  });

  it("patches order rows without optimistically reordering the derived dashboard priority", () => {
    const queryClient = new QueryClient();
    const order = makeOrder({ id: "order-1", updated_at: "old" });

    queryClient.setQueryData(
      ordersKeys.queueSummary({ page: 1 }, storeId),
      makeQueueSummary(order),
    );
    queryClient.setQueryData(ordersKeys.page({}, 1, 50, storeId), makeQueueSummary(order).list);
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
      queryClient.getQueryData<OrderListResult>(ordersKeys.page({}, 1, 50, storeId))?.items[0],
    ).toMatchObject({ parts_supplier_id: "supplier-1", updated_at: "new" });
    expect(
      queryClient.getQueryData<DashboardSummary>(ordersKeys.dashboardSummary({}, storeId))
        ?.items[0],
    ).toMatchObject({ orderId: "order-1", updatedAt: "old" });
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
    queryClient.setQueryData(ordersKeys.page({}, 1, 50, storeId), makeQueueSummary(order).list);
    const snapshot = snapshotOrderReadCaches(queryClient, order.id);

    patchOrderReadCaches(queryClient, order.id, { parts_supplier_id: "supplier-new" });
    restoreOrderReadCaches(queryClient, snapshot);

    expect(
      queryClient.getQueryData<OrderQueueSummary>(ordersKeys.queueSummary({ page: 1 }, storeId))
        ?.list.items[0]?.parts_supplier_id,
    ).toBe("supplier-old");
    expect(
      queryClient.getQueryData<OrderListResult>(ordersKeys.page({}, 1, 50, storeId))?.items[0]
        ?.parts_supplier_id,
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

  it("patches custody state without implicitly clearing unlock credentials", () => {
    const queryClient = new QueryClient();
    const order = makeOrder({
      id: "order-1",
      delivered_at: "2026-07-07T09:00:00.000Z",
      device_custody_status: "with_customer",
      device_unlock_method: "pin",
      device_unlock_value: "001258",
      device_unlock_pattern: [1, 2, 3],
      updated_at: "old-version",
    });

    queryClient.setQueryData(ordersKeys.detail(order.id, storeId), makeDetail(order));
    queryClient.setQueryData(
      ordersKeys.queueSummary({ page: 1 }, storeId),
      makeQueueSummary(order),
    );

    patchOrderReadCaches(queryClient, order.id, {
      delivered_at: null,
      device_custody_status: "with_shop",
      updated_at: "new-version",
    });

    expect(
      queryClient.getQueryData<OrderDetail>(ordersKeys.detail(order.id, storeId))?.order,
    ).toMatchObject({
      device_custody_status: "with_shop",
      updated_at: "new-version",
    });
    const detailOrder = queryClient.getQueryData<OrderDetail>(
      ordersKeys.detail(order.id, storeId),
    )?.order;
    expect(detailOrder?.delivered_at).toBeUndefined();
    expect(detailOrder?.device_unlock_method).toBe("pin");
    expect(detailOrder?.device_unlock_value).toBe("001258");
    expect(detailOrder?.device_unlock_pattern).toEqual([1, 2, 3]);
    expect(
      queryClient.getQueryData<OrderQueueSummary>(ordersKeys.queueSummary({ page: 1 }, storeId))
        ?.list.items[0],
    ).toMatchObject({
      device_custody_status: "with_shop",
      device_unlock_method: "pin",
      device_unlock_value: "001258",
      device_unlock_pattern: [1, 2, 3],
      updated_at: "new-version",
    });
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
    device_custody_status: overrides.device_custody_status ?? "with_shop",
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
      resultGroupCounts: {
        processing: 1,
      } as OrderQueueSummary["list"]["resultGroupCounts"],
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
    coverage: "store",
    policyVersion: "dashboard-priority-v1",
    generatedAt: "2026-07-16T12:00:00.000Z",
    totalCandidates: 1,
    hasMore: false,
    counts: { overdue: 0, ready: 0, active: 1, waiting: 0 },
    items: [
      {
        rank: 1,
        orderId: order.id,
        publicNo: order.public_no,
        customerName: order.customer_name,
        deviceLabel: order.device_label,
        tier: "active",
        reasonCode: "workflow_action_ready",
        reasonLabel: "新单待处理",
        reasonDescription: "Synthetic priority reason",
        currentStep: "接单",
        nextStep: "开始检测",
        assigneeLabel: order.technician_name,
        assigneeState: "assigned",
        isMine: false,
        isOverdue: false,
        isActionable: true,
        updatedAt: order.updated_at,
        action: { kind: "open_task", label: "开始检测", href: `/orders/${order.id}/task` },
        detailHref: `/orders/${order.id}`,
      },
    ],
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
