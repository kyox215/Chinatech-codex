import {
  parseNewOrderPrefill,
  type NewOrderIntentSource,
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
  | { kind: "order-detail"; orderId: string };

export function buildNewOrderWorkspaceHref({
  source,
  sessionId,
  customerId,
  deviceId,
  identifier,
}: {
  source: NewOrderIntentSource;
  sessionId?: string;
  customerId?: string;
  deviceId?: string;
  identifier?: string;
}) {
  const params = new URLSearchParams({ workspace: workspaceNewOrder, source });
  if (sessionId) params.set("intakeSession", sessionId);
  if (customerId) params.set("customerId", customerId);
  if (deviceId) params.set("deviceId", deviceId);
  if (identifier) params.set("imei", identifier);
  return `/orders?${params.toString()}`;
}

export function buildOrderDetailWorkspaceHref(
  orderId: string,
  { source = "unknown" }: { source?: string } = {},
) {
  const params = new URLSearchParams({
    workspace: workspaceOrderDetail,
    orderId,
    source,
  });
  return `/orders?${params.toString()}`;
}

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
  return orderId ? { kind: "order-detail", orderId } : null;
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
