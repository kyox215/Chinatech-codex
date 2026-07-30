import { describe, expect, it } from "vitest";

import { parseOrderQrPayload } from "./order-qr-payload";

describe("parseOrderQrPayload", () => {
  it.each([
    ["/orders/order_123", "order_123"],
    ["https://www.chinatech.in/orders/order-456/task", "order-456"],
    ["order:abc_789", "abc_789"],
  ])("accepts an exact internal order QR %s", (raw, orderId) => {
    expect(parseOrderQrPayload(raw, "https://www.chinatech.in")).toMatchObject({
      kind: "order_link",
      value: orderId,
      label: "订单二维码",
      targetHref: expect.stringContaining(`orderId=${orderId}`),
    });
  });

  it("accepts the protected customer repair-status QR", () => {
    const token = "A".repeat(43);
    expect(
      parseOrderQrPayload(`https://www.chinatech.in/r#${token}`, "https://www.chinatech.in"),
    ).toMatchObject({
      kind: "customer_status_link",
      targetHref: `/r#${token}`,
      sensitive: true,
    });
  });

  it.each([
    "490154203237518",
    "SN:C39ZQ123N70M",
    "EID:89043051202500726225007991441943",
    "https://example.com/orders/order_123",
    "/orders/order_123?next=/settings",
    "inventory:sku-42",
  ])("rejects non-order or unsafe QR content %s", (raw) => {
    expect(parseOrderQrPayload(raw, "https://www.chinatech.in")).toMatchObject({
      kind: "text",
      value: "",
      label: "不是有效订单二维码",
    });
  });
});
