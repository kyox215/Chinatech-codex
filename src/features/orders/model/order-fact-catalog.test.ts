import { describe, expect, it } from "vitest";

import {
  buildFactCompatibilityText,
  diagnosticFindingOptions,
  ORDER_FACT_CATALOG_REVISION,
  reportedSymptomOptions,
} from "./order-fact-catalog";

describe("order fact catalog compatibility composer", () => {
  it("keeps customer symptoms, technician findings, and repair items in distinct catalogs", () => {
    expect(reportedSymptomOptions.map((item) => item.code)).toContain("will_not_charge");
    expect(diagnosticFindingOptions.map((item) => item.code)).toContain("charging_port_fault");
    expect(diagnosticFindingOptions.map((item) => item.code)).not.toContain("will_not_charge");
  });

  it("composes stable legacy text without overwriting free text", () => {
    expect(
      buildFactCompatibilityText({
        existingText: "客户说昨晚开始出现问题",
        field: "reported_symptom",
        codes: ["will_not_charge", "battery_drains_fast"],
        catalogRevision: ORDER_FACT_CATALOG_REVISION,
      }),
    ).toBe("客户说昨晚开始出现问题\n客户症状：无法充电、电池耗电很快");
  });

  it("preserves stale codes by blocking instead of guessing a replacement", () => {
    expect(() =>
      buildFactCompatibilityText({
        existingText: "原始描述",
        field: "reported_symptom",
        codes: ["retired_code"],
        catalogRevision: "old-revision",
      }),
    ).toThrow("点选目录已更新");
  });

  it("requires explicit text only for Other", () => {
    expect(() =>
      buildFactCompatibilityText({
        existingText: "",
        field: "diagnostic_finding",
        codes: ["other"],
        otherNote: "  ",
      }),
    ).toThrow("请填写其他内容");
  });

  it("removes only the generated compatibility line after an explicit clear", () => {
    expect(
      buildFactCompatibilityText({
        existingText: "客户原话保留\n客户症状：无法充电",
        field: "reported_symptom",
        codes: [],
        clearExistingSelection: true,
      }),
    ).toBe("客户原话保留");
  });
});
