import { describe, expect, it } from "vitest";

import { parseOrderQrPayload } from "./order-qr-payload";

const legacyToken = "A".repeat(43);
const stableToken = `v2.a.${"B".repeat(22)}.b.${"C".repeat(43)}`;

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

  it.each([
    [`https://www.chinatech.in/r#${legacyToken}`, `/r#${legacyToken}`],
    [legacyToken, `/r#${legacyToken}`],
    [stableToken, `/r#${stableToken}`],
  ])("accepts and redacts the protected customer repair-status QR %s", (raw, targetHref) => {
    expect(parseOrderQrPayload(raw, "https://www.chinatech.in")).toEqual({
      kind: "customer_status_link",
      raw: "",
      value: "",
      label: "客户维修状态二维码",
      targetHref,
      sensitive: true,
    });
  });

  it.each([
    `/r?next=x#${legacyToken}`,
    `/r/extra#${legacyToken}`,
    `//www.chinatech.in/r#${legacyToken}`,
    `https://www.chinatech.in.evil.example/r#${legacyToken}`,
    `https://evil.example/r#${legacyToken}`,
    `https://user:password@www.chinatech.in/r#${legacyToken}`,
    `https://www.chinatech.in:444/r#${legacyToken}`,
    `https:\\www.chinatech.in\\r#${legacyToken}`,
    `/r#${legacyToken}\u0000`,
    "v2.not-a-complete-token",
    "/r#v2.not-a-complete-token",
  ])("redacts an invalid customer-status candidate %s", (raw) => {
    expect(parseOrderQrPayload(raw, "https://www.chinatech.in")).toEqual({
      kind: "customer_status_link",
      raw: "",
      value: "",
      label: "无效客户工单二维码",
      sensitive: true,
    });
  });

  it.each([
    `https://[invalid/r#${legacyToken}`,
    `parser-error::${stableToken}::trailing`,
    `https://[invalid/r#prefix.${legacyToken}`,
    `https://[invalid/r#${legacyToken}.trailing`,
    `https://[invalid/r#prefix.${stableToken}`,
    `https://[invalid/r#${stableToken}.trailing`,
  ])("redacts an exact protected token segment after parser failure %s", (raw) => {
    expect(parseOrderQrPayload(raw, "https://www.chinatech.in")).toEqual({
      kind: "customer_status_link",
      raw: "",
      value: "",
      label: "无效客户工单二维码",
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
    expect(parseOrderQrPayload(raw, "https://www.chinatech.in")).toEqual({
      kind: "text",
      raw,
      value: "",
      label: "不是有效订单二维码",
    });
  });

  it.each([
    `${legacyToken}A`,
    `https://[invalid/r#${legacyToken}A.trailing`,
    `https://[invalid/r#${stableToken}A.trailing`,
  ])("does not redact a credential lookalike without an exact delimited segment %s", (raw) => {
    expect(parseOrderQrPayload(raw, "https://www.chinatech.in")).toEqual({
      kind: "text",
      raw,
      value: "",
      label: "不是有效订单二维码",
    });
  });
});
