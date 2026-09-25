import {
  parseNewOrderPrefill,
  type NewOrderPrefill,
} from "@/features/orders/model/new-order-intent";

const workspaceParam = "workspace";
const workspaceNewOrder = "new-order";
const workspaceOrderDetail = "order-detail";
const workspaceIntentParams = [
  workspaceParam,
  "orderId",
  "source",
  "intakeSession",
  "customerId",
  "deviceId",
  "imei",
  "serial",
] as const;

type SearchParamsReader = {
  get(name: string): string | null;
  toString(): string;
};

export type OrderWorkspaceIntent =
  | { kind: "new-order"; prefill: NewOrderPrefill }
  | { kind: "order-detail"; orderId: string; source: string };

export type OrderDetailReturnSource = "customer" | "orders";

export {
  buildNewOrderWorkspaceHref,
  buildOrderDetailWorkspaceHref,
} from "@/shared/config/order-workspace-links";

export function parseOrderWorkspaceIntent(
  searchParams: Pick<SearchParamsReader, "get">,
): OrderWorkspaceIntent | null {
  const workspace = searchParams.get(workspaceParam);
  if (workspace === workspaceNewOrder) {
    return {
      kind: "new-order",
      prefill: parseNewOrderPrefill({
        intakeSession: searchParams.get("intakeSession") ?? undefined,
        customerId: searchParams.get("customerId") ?? undefined,
        deviceId: searchParams.get("deviceId") ?? undefined,
        imei: searchParams.get("imei") ?? undefined,
        serial: searchParams.get("serial") ?? undefined,
      }),
    };
  }
  if (workspace !== workspaceOrderDetail) return null;
  const orderId = normalizeRouteValue(searchParams.get("orderId"), 128);
  const source = normalizeRouteValue(searchParams.get("source"), 64);
  return orderId ? { kind: "order-detail", orderId, source } : null;
}

export function getOrderDetailReturnSource(source: string): OrderDetailReturnSource {
  return source === "customer" ? "customer" : "orders";
}

export function buildOrderDetailPageHref(
  orderId: string,
  { from }: { from: OrderDetailReturnSource },
) {
  return `/orders/${encodeURIComponent(orderId)}?from=${from}`;
}

export function buildOrderDetailReturnHref(
  from: string | null,
  customerId: string | null | undefined,
) {
  if (from === "customer" && customerId) {
    return `/customers/${encodeURIComponent(customerId)}`;
  }
  return "/orders";
}

export function getOrderWorkspaceIntentKey(intent: OrderWorkspaceIntent | null) {
  if (!intent) return null;
  if (intent.kind === "order-detail") return JSON.stringify([intent.kind, intent.orderId]);
  // The parsed key includes intakeSession; the remaining normalized fields avoid
  // delimiter collisions without letting list search/source become editor identity.
  const { key, customerId, deviceId, identifier } = intent.prefill;
  return JSON.stringify([intent.kind, key, customerId, deviceId, identifier]);
}

export function clearOrderWorkspaceIntentHref(searchParams: Pick<SearchParamsReader, "toString">) {
  const params = new URLSearchParams(searchParams.toString());
  workspaceIntentParams.forEach((name) => params.delete(name));
  const query = params.toString();
  return query ? `/orders?${query}` : "/orders";
}

function normalizeRouteValue(value: string | null, maxLength: number) {
  return Array.from((value ?? "").trim())
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .slice(0, maxLength);
}
