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
    expect(config?.presets.map((preset) => preset.label)).toContain("风险不可接受");
    expect(getDefaultOrderTransitionReason("unfixed_pickup")).toBe("");
  });

  it("does not claim unrecorded quote or customer acknowledgement facts", () => {
    const serialized = JSON.stringify([
      getOrderTransitionReasonConfig("mail_in_progress"),
      getOrderTransitionReasonConfig("unfixed_pickup"),
    ]);

    expect(serialized).not.toContain("已报价");
    expect(serialized).not.toContain("客户已知悉");
  });

  it("does not require unknown custom statuses to define presets", () => {
    expect(getOrderTransitionReasonConfig("custom_status")).toBeUndefined();
    expect(getDefaultOrderTransitionReason("custom_status")).toBe("");
  });
});
