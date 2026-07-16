import { describe, expect, it } from "vitest";

import type { CustomerDetail, OrderListItem } from "@/lib/repairdesk/types";

import {
  buildCustomerDeviceWorkbenchItems,
  buildCustomerOrderWorkbenchItems,
  buildCustomerPaymentSummary,
  buildCustomerWorkbenchSummary,
  getCustomerOrderWorkbenchState,
} from "./customer-workbench";

const baseCustomer: CustomerDetail["customer"] = {
  id: "cust_1",
  name: "Mario",
  phone_e164: "+39333",
  phone_raw: "39333",
  contact_phones: ["+39444"],
  consent_marketing: true,
  consent_sms: true,
  preferred_channel: "whatsapp",
  language: "it",
};

function order(input: Partial<OrderListItem> & Pick<OrderListItem, "id" | "device_id">) {
  return {
    id: input.id,
    public_no: input.public_no ?? `TEST-${input.id}`,
    order_type: input.order_type ?? "quick_repair",
    status: input.status ?? "completed",
    workflow_status: input.workflow_status,
    workflow_bucket: input.workflow_bucket,
    exception_status: input.exception_status,
    record_state: input.record_state,
    deleted_at: input.deleted_at,
    customer_id: "cust_1",
    device_id: input.device_id,
    issue_description: input.issue_description ?? "屏幕碎裂",
    quotation_amount: input.quotation_amount ?? 100,
    deposit_amount: input.deposit_amount ?? 30,
    balance_amount: input.balance_amount ?? 70,
    currency_code: "EUR",
    is_paid: input.is_paid ?? false,
    approval_status: input.approval_status ?? "pending",
    warranty_text: input.warranty_text,
    warranty_months: input.warranty_months,
    technician_name: input.technician_name ?? "ALESSIO",
    created_at: input.created_at ?? "2026-05-01T10:00:00.000Z",
    updated_at: input.updated_at ?? input.created_at ?? "2026-05-01T10:00:00.000Z",
    customer_name: "Mario",
    customer_phone: "+39333",
    device_label: input.device_label ?? "APPLE iPhone 15",
    device_imei: input.device_imei ?? "350100000000000",
    approval_overdue: false,
    pickup_overdue: false,
  } as OrderListItem;
}

function detail(overrides: Partial<CustomerDetail> = {}): CustomerDetail {
  return {
    customer: baseCustomer,
    devices: [
      {
        id: "dev_1",
        customer_id: "cust_1",
        brand: "APPLE",
        model: "iPhone 15",
        serial_or_imei: "350100000000000",
      },
    ],
    orders: [],
    tags: [],
    interactions: [],
    followups: [],
    stats: {
      order_count: 0,
      total_spent: 0,
      unpaid_amount: 0,
      device_count: 1,
    },
    ...overrides,
  };
}

describe("customer workbench model", () => {
  it("builds order-centered items and keeps device association visible", () => {
    const data = detail({
      orders: [
        order({
          id: "o_old",
          device_id: "missing",
          device_label: "SAMSUNG A13",
          device_imei: "9900",
          created_at: "2026-04-01T10:00:00.000Z",
        }),
        order({
          id: "o_new",
          device_id: "dev_1",
          status: "repairing",
          issue_description: "触摸局部失灵",
          created_at: "2026-05-01T10:00:00.000Z",
        }),
      ],
    });

    const items = buildCustomerOrderWorkbenchItems(data);

    expect(items.map((item) => item.order.id)).toEqual(["o_new", "o_old"]);
    expect(items[0]).toMatchObject({
      deviceLabel: "APPLE iPhone 15",
      deviceImei: "350100000000000",
      state: "active",
    });
    expect(items[1]).toMatchObject({
      deviceLabel: "SAMSUNG A13",
      deviceImei: "9900",
      state: "unpaid",
    });
  });

  it("builds device-centered statistics from related historical orders", () => {
    const data = detail({
      devices: [
        {
          id: "dev_1",
          customer_id: "cust_1",
          brand: "APPLE",
          model: "iPhone 15",
          serial_or_imei: "350100000000000",
        },
        {
          id: "dev_2",
          customer_id: "cust_1",
          brand: "SAMSUNG",
          model: "A13",
          serial_or_imei: "9900",
        },
      ],
      orders: [
        order({
          id: "o1",
          device_id: "dev_1",
          status: "completed",
          quotation_amount: 100,
          balance_amount: 0,
          warranty_months: 6,
          created_at: "2026-05-02T10:00:00.000Z",
        }),
        order({
          id: "o2",
          device_id: "dev_1",
          status: "repairing",
          quotation_amount: 50,
          balance_amount: 30,
          created_at: "2026-05-03T10:00:00.000Z",
        }),
        order({
          id: "o3",
          device_id: "dev_1",
          status: "cancelled",
          exception_status: "cancelled",
          quotation_amount: 999,
          balance_amount: 999,
          created_at: "2026-05-04T10:00:00.000Z",
        }),
      ],
    });

    const [iphone, samsung] = buildCustomerDeviceWorkbenchItems(data);

    expect(iphone).toMatchObject({
      repairCount: 2,
      activeOrderCount: 1,
      totalQuoted: 150,
      unpaidAmount: 30,
      warrantyLabel: "6个月售后",
      canDelete: false,
      deleteBlockedReason: "已有历史工单，设备档案需要保留用于维修记录追踪",
    });
    expect(iphone.orderItems.map((item) => item.order.id)).toEqual(["o3", "o2", "o1"]);
    expect(iphone.historyPreviewItems.map((item) => item.order.id)).toEqual(["o3", "o2", "o1"]);
    expect(samsung).toMatchObject({
      repairCount: 0,
      activeOrderCount: 0,
      totalQuoted: 0,
      unpaidAmount: 0,
      warrantyLabel: "暂无售后记录",
      canDelete: true,
      deleteBlockedReason: undefined,
    });
  });

  it("limits device drill-down preview while keeping the full order count", () => {
    const [device] = buildCustomerDeviceWorkbenchItems(
      detail({
        orders: Array.from({ length: 6 }, (_, index) =>
          order({
            id: `o${index + 1}`,
            device_id: "dev_1",
            created_at: `2026-05-0${index + 1}T10:00:00.000Z`,
          }),
        ),
      }),
    );

    expect(device.orderItems).toHaveLength(6);
    expect(device.historyPreviewItems).toHaveLength(4);
    expect(device.historyPreviewItems.map((item) => item.order.id)).toEqual([
      "o6",
      "o5",
      "o4",
      "o3",
    ]);
    expect(device.canDelete).toBe(false);
  });

  it("summarizes quoted, deposit, and unpaid totals without mixing labels", () => {
    expect(
      buildCustomerPaymentSummary([
        order({
          id: "o1",
          device_id: "dev_1",
          quotation_amount: 100,
          deposit_amount: 25,
          balance_amount: 75,
        }),
        order({
          id: "o2",
          device_id: "dev_1",
          quotation_amount: 50,
          deposit_amount: 50,
          balance_amount: 0,
          is_paid: true,
        }),
        order({
          id: "o3",
          device_id: "dev_1",
          status: "cancelled",
          exception_status: "cancelled",
          quotation_amount: 999,
          deposit_amount: 999,
          balance_amount: 999,
        }),
      ]),
    ).toEqual({
      totalQuoted: 150,
      depositTotal: 75,
      unpaidAmount: 75,
      settledOrderCount: 1,
      unpaidOrderCount: 1,
    });
  });

  it("does not turn redacted finance fields into NaN or fake payable amounts", () => {
    const redacted = order({ id: "redacted", device_id: "dev_1" });
    Reflect.deleteProperty(redacted, "quotation_amount");
    Reflect.deleteProperty(redacted, "deposit_amount");
    Reflect.deleteProperty(redacted, "balance_amount");
    redacted.finance_redacted = true;

    expect(buildCustomerPaymentSummary([redacted])).toEqual({
      totalQuoted: 0,
      depositTotal: 0,
      unpaidAmount: 0,
      settledOrderCount: 0,
      unpaidOrderCount: 0,
    });
    expect(buildCustomerDeviceWorkbenchItems(detail({ orders: [redacted] }))[0]).toMatchObject({
      totalQuoted: 0,
      unpaidAmount: 0,
      financeRedacted: true,
    });
  });

  it("classifies active, unpaid, settled, and cancelled orders", () => {
    expect(
      getCustomerOrderWorkbenchState(order({ id: "o1", device_id: "dev_1", status: "repairing" })),
    ).toBe("active");
    expect(
      getCustomerOrderWorkbenchState(
        order({ id: "o2", device_id: "dev_1", status: "completed", balance_amount: 20 }),
      ),
    ).toBe("unpaid");
    expect(
      getCustomerOrderWorkbenchState(
        order({ id: "o3", device_id: "dev_1", status: "completed", balance_amount: 0 }),
      ),
    ).toBe("settled");
    expect(
      getCustomerOrderWorkbenchState(
        order({ id: "o4", device_id: "dev_1", status: "cancelled", balance_amount: 0 }),
      ),
    ).toBe("closed");
    expect(
      getCustomerOrderWorkbenchState(
        order({
          id: "o5",
          device_id: "dev_1",
          status: "repairing",
          workflow_status: "closed",
          balance_amount: 0,
        }),
      ),
    ).toBe("settled");
    expect(
      getCustomerOrderWorkbenchState(
        order({
          id: "o6",
          device_id: "dev_1",
          status: "repairing",
          workflow_status: "repair",
          workflow_bucket: "done",
          balance_amount: 20,
        }),
      ),
    ).toBe("unpaid");
    expect(
      getCustomerOrderWorkbenchState(
        order({
          id: "o7",
          device_id: "dev_1",
          status: "repairing",
          workflow_bucket: "cancelled",
          balance_amount: 20,
        }),
      ),
    ).toBe("closed");
  });

  it("does not infer hidden finance as zero or settled", () => {
    const summary = buildCustomerWorkbenchSummary(
      detail({
        orders: [order({ id: "o1", device_id: "dev_1", status: "completed", balance_amount: 90 })],
        stats: {
          order_count: 1,
          total_spent: 0,
          unpaid_amount: 0,
          device_count: 1,
          finance_redacted: true,
        },
      }),
    );

    expect(summary.payment).toMatchObject({
      totalQuoted: 0,
      unpaidAmount: 0,
      settledOrderCount: 0,
      unpaidOrderCount: 0,
      financeRedacted: true,
    });
    expect(summary.unpaidOrders).toEqual([]);
    expect(summary.orderItems[0]).toMatchObject({ state: "closed", financeRedacted: true });
  });

  it("builds the chosen profile-first workbench summary", () => {
    const summary = buildCustomerWorkbenchSummary(
      detail({
        orders: [
          order({ id: "o1", device_id: "dev_1", status: "repairing", balance_amount: 60 }),
          order({ id: "o2", device_id: "dev_1", status: "completed", balance_amount: 0 }),
        ],
        followups: [
          {
            id: "f1",
            customer_id: "cust_1",
            title: "回访",
            due_at: "2026-05-03T10:00:00.000Z",
            status: "open",
            created_at: "2026-05-01T10:00:00.000Z",
            updated_at: "2026-05-01T10:00:00.000Z",
          },
        ],
      }),
    );

    expect(summary.contactSummary).toMatchObject({
      primaryPhone: "+39333",
      backupPhoneCount: 1,
      channel: "WhatsApp",
      language: "Italiano",
    });
    expect(summary.activeOrders).toHaveLength(1);
    expect(summary.unpaidOrders).toHaveLength(1);
    expect(summary.openFollowupCount).toBe(1);
    expect(summary.payment.totalQuoted).toBe(200);
  });
});
