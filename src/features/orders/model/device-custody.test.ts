import { describe, expect, it } from "vitest";

import {
  deviceCustodyAllowsChange,
  deviceCustodyAllowsStatus,
  deviceCustodyDisplayLabel,
  formatDeviceCustodyEvent,
  isDeviceCustodyReasonValid,
  normalizeUnlockForCustody,
} from "./device-custody";

describe("device custody domain rules", () => {
  it("derives current display wording without adding a third persisted state", () => {
    expect(deviceCustodyDisplayLabel("with_shop")).toBe("门店保管");
    expect(deviceCustodyDisplayLabel("with_customer")).toBe("客户持有");
    expect(deviceCustodyDisplayLabel("with_customer", "2026-07-16T18:30:00.000Z")).toBe(
      "已归还客户",
    );
    expect(deviceCustodyDisplayLabel(null)).toBe("保管未确认");
  });

  it("blocks physical and terminal flow until custody is compatible", () => {
    expect(deviceCustodyAllowsStatus("with_shop", "diagnosing")).toBe(true);
    expect(deviceCustodyAllowsStatus("with_customer", "diagnosing")).toBe(false);
    expect(deviceCustodyAllowsStatus(null, "repairing")).toBe(false);
    expect(deviceCustodyAllowsStatus(null, "completed")).toBe(false);
    expect(deviceCustodyAllowsStatus("with_customer", "completed")).toBe(true);
    expect(deviceCustodyAllowsStatus("with_customer", "parts_ordered")).toBe(true);
  });

  it("does not offer handovers that create an impossible active or terminal state", () => {
    expect(
      deviceCustodyAllowsChange({
        current: "with_shop",
        target: "with_customer",
        status: "repairing",
      }),
    ).toBe(false);
    expect(
      deviceCustodyAllowsChange({
        current: "with_shop",
        target: "with_customer",
        status: "new",
        exceptionStatus: "cancelled",
      }),
    ).toBe(false);
    expect(
      deviceCustodyAllowsChange({
        current: null,
        target: "with_shop",
        status: "completed",
      }),
    ).toBe(false);
    expect(
      deviceCustodyAllowsChange({
        current: null,
        target: "with_customer",
        status: "completed",
      }),
    ).toBe(true);
    expect(
      deviceCustodyAllowsChange({
        current: null,
        target: "with_customer",
        status: "repairing",
      }),
    ).toBe(true);
  });

  it("clears unlock input whenever the customer keeps the device", () => {
    expect(normalizeUnlockForCustody("with_customer", { method: "pin", value: "1234" })).toEqual({
      method: "none",
    });
    expect(normalizeUnlockForCustody("with_shop", { method: "pin", value: "1234" })).toEqual({
      method: "pin",
      value: "1234",
    });
  });

  it("requires a five-character explanation for terminal custody corrections", () => {
    expect(isDeviceCustodyReasonValid(" 修正 ", 5)).toBe(false);
    expect(isDeviceCustodyReasonValid("历史修正说明", 5)).toBe(true);
  });

  it("renders generic custody audit events as human-readable handovers", () => {
    expect(
      formatDeviceCustodyEvent({
        action: "device_custody_changed",
        from: "with_customer",
        to: "with_shop",
        reason: "客户送机",
      }),
    ).toBe("已确认收机：客户持有 → 门店保管，说明：客户送机");
    expect(
      formatDeviceCustodyEvent({
        action: "device_custody_changed",
        from: "with_shop",
        to: "with_customer",
        credentials_cleared: true,
      }),
    ).toBe("已确认设备归还：门店保管 → 客户持有，解锁信息已清除");
    expect(
      formatDeviceCustodyEvent({
        action: "custody_return_confirmed",
        from: "with_shop",
        to: "with_customer",
      }),
    ).toBe("已确认设备退还：门店保管 → 已归还客户");
    expect(formatDeviceCustodyEvent({ action: "order_updated" })).toBeNull();
  });
});
