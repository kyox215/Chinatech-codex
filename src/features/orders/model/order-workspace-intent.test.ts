import { describe, expect, it } from "vitest";

import {
  buildNewOrderWorkspaceHref,
  buildOrderDetailWorkspaceHref,
  clearOrderWorkspaceIntentHref,
  getOrderWorkspaceIntentKey,
  parseOrderWorkspaceIntent,
} from "./order-workspace-intent";

describe("order workspace intent", () => {
  it("keeps the semantic identity across search, source, parameter order and normalized prefill changes", () => {
    const first = parseOrderWorkspaceIntent(
      new URLSearchParams(
        "workspace=new-order&intakeSession=session-1&customerId=customer-1&deviceId=device-1&imei=synthetic-serial&q=first&source=customer",
      ),
    );
    const replay = parseOrderWorkspaceIntent(
      new URLSearchParams(
        "source=command&q=second&serial=+synthetic-serial+&deviceId=device-1&customerId=+customer-1+&intakeSession=+session-1+&workspace=new-order",
      ),
    );
    expect(getOrderWorkspaceIntentKey(first)).not.toBeNull();
    expect(getOrderWorkspaceIntentKey(replay)).toBe(getOrderWorkspaceIntentKey(first));
  });

  it("distinguishes explicit new sessions, changed prefill and detail intents", () => {
    const keyFor = (query: string) =>
      getOrderWorkspaceIntentKey(parseOrderWorkspaceIntent(new URLSearchParams(query)));
    const key = keyFor("workspace=new-order&intakeSession=session-1&customerId=customer-1");
    expect(keyFor("workspace=new-order&intakeSession=session-2&customerId=customer-1")).not.toBe(
      key,
    );
    expect(keyFor("workspace=new-order&intakeSession=session-1&customerId=customer-2")).not.toBe(
      key,
    );
    expect(
      keyFor("workspace=new-order&intakeSession=session-1&customerId=customer-1&deviceId=device-1"),
    ).not.toBe(key);
    expect(
      keyFor("workspace=new-order&intakeSession=session-1&customerId=customer-1&imei=identifier-1"),
    ).not.toBe(key);
    expect(keyFor("workspace=order-detail&orderId=customer-1")).not.toBe(key);
    expect(keyFor("q=only-list-search")).toBeNull();
  });

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
