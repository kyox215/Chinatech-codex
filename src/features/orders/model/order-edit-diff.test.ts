import { describe, expect, it } from "vitest";

import type { OrderCapabilities, UpdateOrderInput } from "@/lib/repairdesk/types";

import { buildOrderPatchChanges } from "./order-edit-diff";

const baseline: UpdateOrderInput = {
  expected_updated_at: "2026-07-16T10:00:00.000Z",
  customer_name: "Mario",
  customer_phone: "+3900000000",
  device_brand: "Samsung",
  device_model: "A20",
  device_imei: "ABC123",
  device_notes: "蓝壳",
  issue_description: "不开机",
  diagnosis_result: "待检测",
  internal_tag: "急",
  accessory_notes: "含卡托",
  device_unlock: { method: "pin", value: "1234" },
  warranty_text: "6个月售后",
  warranty_months: 6,
  warranty_change_reason: "默认",
  fault_prices: [{ name: "检测", price: 90 }],
  deposit_amount: 0,
};

const allCapabilities: Pick<OrderCapabilities, "canEditIntake" | "canEditRepair"> = {
  canEditIntake: true,
  canEditRepair: true,
};

describe("buildOrderPatchChanges", () => {
  it("returns an empty payload when the draft is unchanged", () => {
    expect(buildOrderPatchChanges(baseline, { ...baseline }, allCapabilities)).toEqual({});
  });

  it("emits only changed non-financial fields", () => {
    const result = buildOrderPatchChanges(
      baseline,
      {
        ...baseline,
        device_imei: "XYZ999",
        fault_prices: [{ name: "检测", price: 190 }],
        deposit_amount: 50,
      },
      allCapabilities,
    );
    expect(result).toEqual({ device_imei: "XYZ999" });
    expect(result).not.toHaveProperty("fault_prices");
    expect(result).not.toHaveProperty("deposit_amount");
  });

  it("does not emit repair fields without repair capability", () => {
    expect(
      buildOrderPatchChanges(
        baseline,
        { ...baseline, diagnosis_result: "已确认主板故障", customer_name: "Mario Rossi" },
        { canEditIntake: true, canEditRepair: false },
      ),
    ).toEqual({ customer_name: "Mario Rossi" });
  });

  it("normalizes string whitespace and compares unlock values deeply", () => {
    expect(
      buildOrderPatchChanges(
        baseline,
        {
          ...baseline,
          customer_name: "  Mario  ",
          device_unlock: { method: "pin", value: " 5678 " },
          warranty_months: 12,
        },
        allCapabilities,
      ),
    ).toEqual({
      device_unlock: { method: "pin", value: " 5678 " },
      warranty_months: 12,
    });
  });
});
