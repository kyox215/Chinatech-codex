import { describe, expect, it } from "vitest";

import { resolveEntityContextBack } from "./entity-context-routes";

describe("entity context route resolver", () => {
  it.each([
    ["/inventory/abc", "/inventory", "返回商品库存"],
    ["/inventory/abc/edit", "/inventory", "返回商品库存"],
    ["/inventory/abc/reserve", "/inventory", "返回商品库存"],
    ["/inventory/abc/sell", "/inventory", "返回商品库存"],
    ["/inventory/after-sales/case-1", "/inventory", "返回商品库存"],
    ["/inventory/reservations/res-1", "/inventory", "返回商品库存"],
    ["/inventory/sales/sale-1", "/inventory", "返回商品库存"],
    ["/orders/order-1", "/orders", "返回工单列表"],
    ["/orders/order-1/task", "/orders", "返回工单列表"],
    ["/customers/customer-1", "/customers", "返回客户列表"],
  ])("maps %s to %s with label %s", (pathname, href, label) => {
    expect(resolveEntityContextBack(pathname)).toMatchObject({ href, label });
  });

  it.each([
    "/",
    "/inventory",
    "/inventory/new",
    "/inventory/after-sales",
    "/inventory/reservations",
    "/inventory/sales",
    "/orders",
    "/orders/new",
    "/customers",
    "/customers/new",
    "/orders/order-1/notes",
    "/inventory/abc/unknown",
  ])("does not replace ordinary hierarchy on %s", (pathname) => {
    expect(resolveEntityContextBack(pathname)).toBeNull();
  });

  it("normalizes a trailing slash and ignores query/hash text", () => {
    expect(resolveEntityContextBack("/customers/customer-1/?tab=history#activity")).toMatchObject({
      href: "/customers",
      label: "返回客户列表",
    });
  });
});
