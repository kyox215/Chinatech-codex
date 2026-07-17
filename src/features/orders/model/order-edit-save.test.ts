import { describe, expect, it, vi } from "vitest";

import type { OrderCapabilities, UpdateOrderInput } from "@/lib/repairdesk/types";

import {
  advanceOrderEditBaseline,
  buildOrderEditSavePlan,
  executeOrderEditSavePlan,
  OrderEditSaveExecutionError,
} from "./order-edit-save";

const baseline: UpdateOrderInput = {
  expected_updated_at: "version-1",
  customer_name: "Mario",
  customer_phone: "+3900000000",
  device_brand: "Apple",
  device_model: "iPhone 14",
  device_imei: "IMEI-1",
  device_notes: "",
  issue_description: "屏幕损坏",
  diagnosis_result: "待检测",
  internal_tag: "",
  accessory_notes: "",
  device_unlock: { method: "none" },
  warranty_text: "6个月售后",
  warranty_months: 6,
  warranty_change_reason: "",
  fault_prices: [{ name: "屏幕", price: 75 }],
  deposit_amount: 0,
};

const capabilities: Pick<
  OrderCapabilities,
  "canEditIntake" | "canEditRepair" | "canAdjustFinance"
> = {
  canEditIntake: true,
  canEditRepair: true,
  canAdjustFinance: true,
};

describe("order edit save orchestration", () => {
  it("builds routine-only, finance-only and combined plans", () => {
    expect(
      buildOrderEditSavePlan({
        baseline,
        draft: { ...baseline, customer_name: "Mario Rossi" },
        capabilities,
      }).steps,
    ).toEqual(["routine"]);

    expect(
      buildOrderEditSavePlan({
        baseline,
        draft: { ...baseline, fault_prices: [{ name: "屏幕", price: 85 }] },
        capabilities,
      }).steps,
    ).toEqual(["finance"]);

    expect(
      buildOrderEditSavePlan({
        baseline,
        draft: {
          ...baseline,
          customer_name: "Mario Rossi",
          fault_prices: [{ name: "屏幕", price: 85 }],
        },
        capabilities,
      }).steps,
    ).toEqual(["routine", "finance"]);
  });

  it("does not create work for an unchanged draft", () => {
    expect(
      buildOrderEditSavePlan({ baseline, draft: { ...baseline }, capabilities }).steps,
    ).toEqual([]);
  });

  it("does not let an unchanged empty quote placeholder block an ordinary save", () => {
    const legacyBaseline = {
      ...baseline,
      fault_prices: [{ name: "", price: 0 }],
      deposit_amount: 0,
    };

    expect(
      buildOrderEditSavePlan({
        baseline: legacyBaseline,
        draft: { ...legacyBaseline, issue_description: "屏幕损坏且触控失灵" },
        capabilities,
      }).steps,
    ).toEqual(["routine"]);
  });

  it("rejects a finance change when finance permission is absent", () => {
    expect(() =>
      buildOrderEditSavePlan({
        baseline,
        draft: { ...baseline, deposit_amount: 10 },
        capabilities: { ...capabilities, canAdjustFinance: false },
      }),
    ).toThrow("当前账号没有调整报价的权限");
  });

  it("passes the version returned by the routine save into the finance save", async () => {
    const plan = buildOrderEditSavePlan({
      baseline,
      draft: {
        ...baseline,
        customer_name: "Mario Rossi",
        fault_prices: [{ name: "屏幕", price: 85 }],
      },
      capabilities,
    });
    const saveRoutine = vi.fn(async () => ({ ok: true, updated_at: "version-2" }));
    const saveFinance = vi.fn(async () => ({ ok: true, updated_at: "version-3" }));

    await expect(
      executeOrderEditSavePlan({
        plan,
        expectedUpdatedAt: baseline.expected_updated_at,
        saveRoutine,
        saveFinance,
      }),
    ).resolves.toEqual({ completedSteps: ["routine", "finance"], updatedAt: "version-3" });

    expect(saveRoutine).toHaveBeenCalledWith("version-1", { customer_name: "Mario Rossi" });
    expect(saveFinance).toHaveBeenCalledWith("version-2", {
      faultPrices: [{ name: "屏幕", price: 85 }],
      depositAmount: 0,
    });
  });

  it("stops before finance when the routine request fails", async () => {
    const plan = buildOrderEditSavePlan({
      baseline,
      draft: {
        ...baseline,
        customer_name: "Mario Rossi",
        fault_prices: [{ name: "屏幕", price: 85 }],
      },
      capabilities,
    });
    const saveFinance = vi.fn();

    await expect(
      executeOrderEditSavePlan({
        plan,
        expectedUpdatedAt: "version-1",
        saveRoutine: async () => {
          throw new Error("工单已被更新");
        },
        saveFinance,
      }),
    ).rejects.toMatchObject({
      failedStep: "routine",
      completedSteps: [],
      latestUpdatedAt: "version-1",
    });
    expect(saveFinance).not.toHaveBeenCalled();
  });

  it("retains routine progress and makes a retry finance-only after the second step fails", async () => {
    const draft: UpdateOrderInput = {
      ...baseline,
      customer_name: "Mario Rossi",
      fault_prices: [{ name: "屏幕", price: 85 }],
    };
    const plan = buildOrderEditSavePlan({ baseline, draft, capabilities });
    let failure: OrderEditSaveExecutionError | null = null;

    try {
      await executeOrderEditSavePlan({
        plan,
        expectedUpdatedAt: "version-1",
        saveRoutine: async () => ({ ok: true, updated_at: "version-2" }),
        saveFinance: async () => {
          throw new Error("报价服务暂不可用");
        },
      });
    } catch (error) {
      failure = error as OrderEditSaveExecutionError;
    }

    expect(failure).toMatchObject({
      failedStep: "finance",
      completedSteps: ["routine"],
      latestUpdatedAt: "version-2",
    });

    const retryBaseline = advanceOrderEditBaseline({
      baseline,
      plan,
      completedSteps: failure?.completedSteps ?? [],
      updatedAt: failure?.latestUpdatedAt ?? "",
    });
    expect(retryBaseline.customer_name).toBe("Mario Rossi");
    expect(retryBaseline.fault_prices).toEqual([{ name: "屏幕", price: 75 }]);
    expect(retryBaseline.expected_updated_at).toBe("version-2");
    expect(buildOrderEditSavePlan({ baseline: retryBaseline, draft, capabilities }).steps).toEqual([
      "finance",
    ]);
  });
});
