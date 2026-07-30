import { describe, expect, it } from "vitest";

import { isValidGtin, isValidImei, validateProductIdentifiers } from "./device-data";

describe("inventory device data", () => {
  it("validates IMEI and standard GTIN checksums", () => {
    expect(isValidImei("490154203237518")).toBe(true);
    expect(isValidImei("490154203237519")).toBe(false);
    expect(isValidGtin("4006381333931")).toBe(true);
    expect(isValidGtin("4006381333932")).toBe(false);
  });

  it("rejects duplicate cross-kind values and malformed EID", () => {
    expect(
      validateProductIdentifiers([
        { kind: "imei1", value: "490154203237518", source: "manual" },
        { kind: "serial", value: "490154203237518", source: "manual" },
      ]),
    ).toBe("设备标识不能重复");
    expect(validateProductIdentifiers([{ kind: "eid", value: "123", source: "manual" }])).toContain(
      "32 位",
    );
  });
});
