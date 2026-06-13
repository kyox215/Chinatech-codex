import { describe, expect, it } from "vitest";

import {
  getDefaultOrderTransitionReason,
  getOrderTransitionReasonConfig,
  orderTransitionRequiresReason,
} from "@/features/orders/model/order-transition-reasons";

describe("order transition reason presets", () => {
  it("requires reasons for cancellation and unfixed pickup", () => {
    expect(orderTransitionRequiresReason("cancelled")).toBe(true);
    expect(orderTransitionRequiresReason("unfixed_pickup")).toBe(true);
    expect(orderTransitionRequiresReason("diagnosing")).toBe(false);
  });

  it("provides guided reasons for customer pickup without repair", () => {
    const config = getOrderTransitionReasonConfig("unfixed_pickup");

    expect(config?.title).toContain("未修取机");
    expect(config?.presets.map((preset) => preset.label)).toContain("维修风险过高");
    expect(getDefaultOrderTransitionReason("unfixed_pickup")).toContain("客户确认");
  });

  it("does not require unknown custom statuses to define presets", () => {
    expect(getOrderTransitionReasonConfig("custom_status")).toBeUndefined();
    expect(getDefaultOrderTransitionReason("custom_status")).toBe("");
  });
});
