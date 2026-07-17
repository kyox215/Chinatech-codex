import { describe, expect, it } from "vitest";

import { resolveOrderDetailPrimaryAction } from "./order-detail-primary-action";

const defaults = {
  status: "new" as const,
  notifyStatus: "not_sent" as const,
  approvalDecisionAvailable: false,
  flowAvailable: true,
  notificationAvailable: true,
  paymentAvailable: false,
};

describe("resolveOrderDetailPrimaryAction", () => {
  it("prioritizes a real approval decision", () => {
    expect(resolveOrderDetailPrimaryAction({ ...defaults, approvalDecisionAvailable: true })).toBe(
      "approval",
    );
  });

  it("recommends notifying after a quote or completed repair", () => {
    expect(resolveOrderDetailPrimaryAction({ ...defaults, status: "quoted" })).toBe("notify");
    expect(resolveOrderDetailPrimaryAction({ ...defaults, status: "repaired" })).toBe("notify");
  });

  it("does not repeat a notification that was already sent", () => {
    expect(
      resolveOrderDetailPrimaryAction({
        ...defaults,
        status: "repaired",
        notifyStatus: "sent",
      }),
    ).toBe("flow");
  });

  it("recommends collecting an available balance at pickup", () => {
    expect(
      resolveOrderDetailPrimaryAction({
        ...defaults,
        status: "waiting_pickup",
        paymentAvailable: true,
      }),
    ).toBe("payment");
  });

  it("falls back to workflow and returns no action when every capability is blocked", () => {
    expect(resolveOrderDetailPrimaryAction(defaults)).toBe("flow");
    expect(
      resolveOrderDetailPrimaryAction({
        ...defaults,
        flowAvailable: false,
        notificationAvailable: false,
        paymentAvailable: false,
      }),
    ).toBeNull();
  });

  it("never promotes an action for cancelled orders", () => {
    expect(
      resolveOrderDetailPrimaryAction({
        ...defaults,
        status: "cancelled",
        flowAvailable: false,
        paymentAvailable: true,
      }),
    ).toBeNull();
    expect(
      resolveOrderDetailPrimaryAction({
        ...defaults,
        status: "repaired",
        cancelled: true,
        flowAvailable: false,
      }),
    ).toBeNull();
  });

  it("only promotes payment for a completed order when a balance remains collectible", () => {
    expect(
      resolveOrderDetailPrimaryAction({
        ...defaults,
        status: "completed",
        flowAvailable: false,
        paymentAvailable: false,
      }),
    ).toBeNull();
    expect(
      resolveOrderDetailPrimaryAction({
        ...defaults,
        status: "completed",
        flowAvailable: false,
        paymentAvailable: true,
      }),
    ).toBe("payment");
  });

  it("does not promote WhatsApp solely because contact details exist", () => {
    expect(
      resolveOrderDetailPrimaryAction({
        ...defaults,
        flowAvailable: false,
        notificationAvailable: true,
      }),
    ).toBeNull();
  });
});
