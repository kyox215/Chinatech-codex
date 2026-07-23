import { describe, expect, it } from "vitest";

import {
  buildNewOrderWorkspaceHref,
  buildOrderDetailWorkspaceHref,
  clearOrderWorkspaceIntentHref,
  parseOrderWorkspaceIntent,
} from "./order-workspace-intent";

describe("order workspace intent", () => {
  it("builds and parses a prefilled new-order workspace URL", () => {
    const href = buildNewOrderWorkspaceHref({
      source: "customer",
      sessionId: "session-1",
      customerId: "customer 1",
      deviceId: "device/1",
    });
    expect(href).toBe(
      "/orders?workspace=new-order&source=customer&intakeSession=session-1&customerId=customer+1&deviceId=device%2F1",
    );

    const params = new URLSearchParams(href.split("?")[1]);
    expect(parseOrderWorkspaceIntent(params)).toEqual({
      kind: "new-order",
      prefill: {
        key: "session-1:customer 1:device/1:",
        customerId: "customer 1",
        deviceId: "device/1",
      },
    });
  });

  it("builds and parses an order-detail workspace URL", () => {
    const href = buildOrderDetailWorkspaceHref("order/1", { source: "profit" });
    expect(href).toBe("/orders?workspace=order-detail&orderId=order%2F1&source=profit");
    expect(parseOrderWorkspaceIntent(new URLSearchParams(href.split("?")[1]))).toEqual({
      kind: "order-detail",
      orderId: "order/1",
    });
  });

  it("rejects incomplete detail intents and clears only workspace parameters", () => {
    expect(
      parseOrderWorkspaceIntent(new URLSearchParams("workspace=order-detail&source=customer")),
    ).toBeNull();
    expect(
      clearOrderWorkspaceIntentHref({
        toString: () => "q=iphone&workspace=order-detail&orderId=ord-1&source=command",
      }),
    ).toBe("/orders?q=iphone");
  });
});
