import { describe, expect, it } from "vitest";

import { buildNewOrderHref, parseNewOrderPrefill } from "./new-order-intent";

describe("new order intent", () => {
  it("builds a non-sensitive session URL for a fresh intake", () => {
    expect(buildNewOrderHref({ source: "dashboard", sessionId: "session-2" })).toBe(
      "/orders/new?source=dashboard&intakeSession=session-2",
    );
  });

  it("normalizes allowed prefill fields into a stable key", () => {
    expect(
      parseNewOrderPrefill({
        intakeSession: " session-a ",
        customerId: "customer-a",
        deviceId: ["device-a", "ignored"],
        imei: " 12345 ",
        unexpected: "secret",
      }),
    ).toEqual({
      key: "session-a:customer-a:device-a:12345",
      customerId: "customer-a",
      deviceId: "device-a",
      identifier: "12345",
    });
  });
});
