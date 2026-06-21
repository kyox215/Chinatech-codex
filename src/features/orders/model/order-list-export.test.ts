import { describe, expect, it } from "vitest";

import type { OrderListItem } from "@/lib/repairdesk/api";
import { buildOrdersCsv } from "./order-list-export";

const baseOrder: OrderListItem = {
  id: "order-1",
  public_no: "RD-001",
  customer_id: "customer-1",
  customer_name: "Mario Rossi",
  customer_phone: "+39 333 123 4567",
  contact_phones: [],
  device_id: "device-1",
  device_label: "iPhone 13",
  device_imei: "123456789012345",
  issue_description: "Schermo rotto",
  fault_prices: [{ name: "Vetro", price: 89 }],
  status: "quoted",
  workflow_status: "quote",
  order_type: "quick_repair",
  quotation_amount: 89,
  deposit_amount: 20,
  balance_amount: 69,
  currency_code: "EUR",
  is_paid: false,
  approval_status: "pending",
  technician_name: "Hexiang",
  accessory_notes: "Cover",
  approval_overdue: false,
  pickup_overdue: false,
  created_at: "2026-06-19T08:00:00.000Z",
  updated_at: "2026-06-19T09:30:00.000Z",
};

describe("order list CSV export", () => {
  it("exports the expected headers and order fields", () => {
    const csv = buildOrdersCsv([baseOrder]);

    expect(csv).toContain("工单号,客户,电话,设备,IMEI");
    expect(csv).toContain("RD-001,Mario Rossi,+39 333 123 4567,iPhone 13,123456789012345");
    expect(csv).toContain("未结清,Hexiang");
  });

  it("escapes commas, quotes, and multiline cells", () => {
    const csv = buildOrdersCsv([
      {
        ...baseOrder,
        public_no: "RD-002",
        customer_name: 'Mario "Test", SR',
        issue_description: "Line 1\nLine 2",
      },
    ]);

    expect(csv).toContain('"Mario ""Test"", SR"');
    expect(csv).toContain('"Line 1\nLine 2"');
  });
});
