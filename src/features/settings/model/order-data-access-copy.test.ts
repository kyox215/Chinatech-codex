import { describe, expect, it } from "vitest";

import {
  getOrderDataAccessDescription,
  getOrderDataAccessSummary,
} from "@/features/settings/model/order-data-access-copy";

describe("order data access copy", () => {
  it("explains that a disabled feature does not mean lost orders", () => {
    const capability = {
      code: "feature_disabled" as const,
      can_export: false,
      can_apply: false,
    };
    expect(getOrderDataAccessSummary(capability)).toContain("工单数据不受影响");
    expect(getOrderDataAccessDescription(capability)).toContain("不代表工单丢失");
  });

  it("distinguishes a primary owner from an owner membership", () => {
    const description = getOrderDataAccessDescription({
      code: "primary_owner_required",
      can_export: false,
      can_apply: false,
    });
    expect(description).toContain("显示为店主");
    expect(description).toContain("主创建者");
  });
});
