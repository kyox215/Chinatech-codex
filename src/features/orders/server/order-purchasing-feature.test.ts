import { afterEach, describe, expect, it, vi } from "vitest";
import { assertOrderPurchasingEnabled, isOrderPurchasingEnabled } from "./order-purchasing-feature";

afterEach(() => vi.unstubAllEnvs());

describe("order purchasing feature gate", () => {
  it("fails closed and only accepts the explicit enabled value", () => {
    vi.stubEnv("REPAIRDESK_ORDER_PURCHASING_ENABLED", "0");
    expect(isOrderPurchasingEnabled()).toBe(false);
    expect(() => assertOrderPurchasingEnabled()).toThrowError(
      expect.objectContaining({ status: 503, code: "ORDER_PURCHASING_DISABLED" }),
    );
    vi.stubEnv("REPAIRDESK_ORDER_PURCHASING_ENABLED", "1");
    expect(isOrderPurchasingEnabled()).toBe(true);
    expect(() => assertOrderPurchasingEnabled()).not.toThrow();
  });
});
