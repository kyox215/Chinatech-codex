import { describe, expect, it } from "vitest";
import { nextCustomerWriteVersion } from "./customer-write-version";

describe("customer CAS write version", () => {
  it.each([
    ["2026-09-15T10:00:00.000001Z", "2026-09-15T10:00:00.001Z"],
    ["2026-09-15T10:00:00.000999Z", "2026-09-15T10:00:00.001Z"],
    ["2026-09-15T10:00:00.999999Z", "2026-09-15T10:00:01.000Z"],
    ["2099-01-01T00:00:00.000001Z", "2099-01-01T00:00:00.001Z"],
    ["2026-09-15T12:00:00.000999+02:00", "2026-09-15T10:00:00.001Z"],
  ])(
    "advances beyond microseconds, same milliseconds, future clocks and offsets: %s",
    (expected, next) => {
      expect(nextCustomerWriteVersion(expected, Date.parse("2026-09-15T10:00:00.000Z"))).toBe(next);
    },
  );
  it("uses wall-clock time when it is strictly later", () => {
    expect(
      nextCustomerWriteVersion("2020-01-01T00:00:00Z", Date.parse("2026-09-15T10:00:00Z")),
    ).toBe("2026-09-15T10:00:00.000Z");
  });
  it.each(["", "not-a-version"])("fails closed for %j", (expected) => {
    expect(() => nextCustomerWriteVersion(expected)).toThrow(
      expect.objectContaining({ code: "CUSTOMER_VERSION_REQUIRED" }),
    );
  });
});
