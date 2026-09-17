import { describe, expect, it } from "vitest";
import { translateMessage } from "@/shared/i18n/messages";

import {
  formatWarrantyText,
  localizeWarrantyText,
  normalizeWarrantyPayload,
  parseWarrantyMonths,
  warrantyReasonRequired,
} from "./order-warranty";

describe("order warranty rules", () => {
  it.each([
    ["zh-CN", ["无保修", "3个月", "6个月", "12个月", "两年"]],
    ["it-IT", ["Nessuna garanzia", "3 mesi", "6 mesi", "12 mesi", "Due anni"]],
    ["en", ["No warranty", "3 months", "6 months", "12 months", "Two years"]],
  ] as const)(
    "localizes all supported durations in %s without changing canonical values",
    (locale, labels) => {
      const canonical = ["无保修", "3个月", "6个月", "12个月", "两年"];
      [0, 3, 6, 12, 24].forEach((months, index) => {
        const label = localizeWarrantyText(months, (key, values) =>
          translateMessage(locale, key, values),
        );
        expect(label).toBe(labels[index]);
        expect(formatWarrantyText(months)).toBe(canonical[index]);
        if (locale !== "zh-CN") expect(label).not.toMatch(/个月|两年|无保修/);
      });
    },
  );

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
