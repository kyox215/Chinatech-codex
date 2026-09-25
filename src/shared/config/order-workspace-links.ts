export type NewOrderIntentSource = "dashboard" | "command" | "mobile" | "customer" | "unknown";

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
  const params = new URLSearchParams({ workspace: "new-order", source });
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
    workspace: "order-detail",
    orderId,
    source,
  });
  return `/orders?${params.toString()}`;
}
