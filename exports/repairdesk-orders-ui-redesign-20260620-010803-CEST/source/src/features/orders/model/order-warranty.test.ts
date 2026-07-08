import { describe, expect, it } from "vitest";

import {
  formatWarrantyText,
  normalizeWarrantyPayload,
  parseWarrantyMonths,
  warrantyReasonRequired,
} from "./order-warranty";

describe("order warranty rules", () => {
  it("parses legacy warranty text into supported months", () => {
    expect(parseWarrantyMonths("6个月")).toBe(6);
    expect(parseWarrantyMonths("90天质保")).toBe(3);
    expect(parseWarrantyMonths("两年")).toBe(24);
    expect(parseWarrantyMonths("无保修")).toBe(0);
  });

  it("formats warranty labels", () => {
    expect(formatWarrantyText(0)).toBe("无保修");
    expect(formatWarrantyText(6)).toBe("6个月");
    expect(formatWarrantyText(24)).toBe("两年");
  });

  it("requires a reason when warranty differs from store default", () => {
    expect(warrantyReasonRequired(6, 6)).toBe(false);
    expect(warrantyReasonRequired(12, 6)).toBe(true);
    expect(() =>
      normalizeWarrantyPayload({
        warranty_months: 12,
        defaultWarrantyMonths: 6,
      }),
    ).toThrow("非默认质保需要填写原因");
    expect(
      normalizeWarrantyPayload({
        warranty_months: 12,
        warranty_change_reason: "客户购买延保",
        defaultWarrantyMonths: 6,
      }),
    ).toMatchObject({
      warranty_months: 12,
      warranty_text: "12个月",
      warranty_change_reason: "客户购买延保",
    });
  });
});
