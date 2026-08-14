export type EntityContextBack = {
  href: "/inventory" | "/orders" | "/customers";
  label: "返回商品库存" | "返回工单列表" | "返回客户列表";
  kind: "inventory" | "orders" | "customers";
};

const inventoryReservedSegments = new Set([
  "after-sales",
  "intake",
  "new",
  "reservations",
  "sales",
]);

const orderReservedSegments = new Set(["new"]);

function isEntitySegment(value: string | undefined, reserved: Set<string>) {
  return Boolean(value && value !== "." && value !== ".." && !reserved.has(value));
}

function normalizedSegments(pathname: string) {
  const path = pathname.split(/[?#]/, 1)[0] ?? "/";
  return path.replace(/^\/+/, "/").replace(/\/+$/, "").split("/").filter(Boolean);
}

/**
 * Resolves only true entity detail/edit routes to their deterministic parent.
 * Collection routes and normal breadcrumb hierarchy intentionally return null.
 */
export function resolveEntityContextBack(pathname: string): EntityContextBack | null {
  const segments = normalizedSegments(pathname);
  const [root, first, second] = segments;

  if (root === "inventory") {
    const isInventoryItemRoute =
      (segments.length === 2 && isEntitySegment(first, inventoryReservedSegments)) ||
      (segments.length === 3 &&
        isEntitySegment(first, inventoryReservedSegments) &&
        ["edit", "reserve", "sell"].includes(second ?? ""));
    const isInventoryLifecycleRoute =
      segments.length === 3 &&
      ((first === "after-sales" && isEntitySegment(second, new Set())) ||
        (first === "reservations" && isEntitySegment(second, new Set())) ||
        (first === "sales" && isEntitySegment(second, new Set())));

    if (isInventoryItemRoute || isInventoryLifecycleRoute) {
      return { href: "/inventory", label: "返回商品库存", kind: "inventory" };
    }
  }

  if (
    root === "orders" &&
    ((segments.length === 2 && isEntitySegment(first, orderReservedSegments)) ||
      (segments.length === 3 && isEntitySegment(first, orderReservedSegments) && second === "task"))
  ) {
    return { href: "/orders", label: "返回工单列表", kind: "orders" };
  }

  if (root === "customers" && segments.length === 2 && isEntitySegment(first, new Set(["new"]))) {
    return { href: "/customers", label: "返回客户列表", kind: "customers" };
  }

  return null;
}
