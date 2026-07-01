import { describe, expect, it } from "vitest";

import {
  createFallbackRepairOrderPublicNo,
  isRepairOrderPublicNo,
  isRepairOrderPublicNoInsertError,
  normalizeGeneratedRepairOrderPublicNo,
} from "./order-public-no";

describe("repair order public number", () => {
  it("normalizes sequence and rpc-generated order numbers", () => {
    expect(normalizeGeneratedRepairOrderPublicNo("R2027001")).toBe("R2027001");
    expect(normalizeGeneratedRepairOrderPublicNo(2027002)).toBe("R2027002");
    expect(
      normalizeGeneratedRepairOrderPublicNo({
        generate_repair_order_public_no: "R2027003",
      }),
    ).toBe("R2027003");
    expect(normalizeGeneratedRepairOrderPublicNo("TEST-1")).toBeUndefined();
  });

  it("creates numeric fallback numbers that remain valid and differ by attempt", () => {
    const first = createFallbackRepairOrderPublicNo({
      now: new Date("2026-07-01T12:00:00.000Z"),
      attempt: 0,
      entropy: 5,
    });
    const second = createFallbackRepairOrderPublicNo({
      now: new Date("2026-07-01T12:00:00.000Z"),
      attempt: 1,
      entropy: 5,
    });

    expect(isRepairOrderPublicNo(first)).toBe(true);
    expect(isRepairOrderPublicNo(second)).toBe(true);
    expect(first).not.toBe(second);
  });

  it("classifies public number insert failures for retry and friendly errors", () => {
    expect(
      isRepairOrderPublicNoInsertError(
        new Error('null value in column "public_no" of relation "repair_orders"'),
      ),
    ).toBe(true);
    expect(
      isRepairOrderPublicNoInsertError(
        new Error("duplicate key value violates unique constraint repair_orders_public_no_key"),
      ),
    ).toBe(true);
    expect(
      isRepairOrderPublicNoInsertError(
        new Error('null value in column "customer_id" of relation "repair_orders"'),
      ),
    ).toBe(false);
    expect(isRepairOrderPublicNoInsertError(new Error("手机号格式不正确"))).toBe(false);
  });
});
