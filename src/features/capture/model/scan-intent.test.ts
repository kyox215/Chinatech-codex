import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearScanSearchIntents,
  consumeScanSearchIntent,
  createScanSearchIntent,
  subscribeScanSearchIntent,
} from "@/features/capture/model/scan-intent";

describe("scan search intents", () => {
  beforeEach(() => {
    clearScanSearchIntents();
  });

  it("stores a scan value for one-time same-tab consumption", () => {
    const intent = createScanSearchIntent("orders", "  490154203237518  ");

    expect(intent).toMatchObject({
      scope: "orders",
      value: "490154203237518",
    });
    expect(consumeScanSearchIntent("orders")).toBe("490154203237518");
    expect(consumeScanSearchIntent("orders")).toBe("");
  });

  it("notifies the matching scope without leaking the value into the event", () => {
    const onOrders = vi.fn();
    const onCustomers = vi.fn();
    const unsubscribeOrders = subscribeScanSearchIntent("orders", onOrders);
    const unsubscribeCustomers = subscribeScanSearchIntent("customers", onCustomers);

    const intent = createScanSearchIntent("orders", "C39ZQ123N70M");

    expect(intent?.id).toBeTruthy();
    expect(onOrders).toHaveBeenCalledWith("C39ZQ123N70M");
    expect(onCustomers).not.toHaveBeenCalled();

    unsubscribeOrders();
    unsubscribeCustomers();
  });
});
