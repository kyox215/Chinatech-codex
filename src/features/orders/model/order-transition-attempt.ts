import { classifyOrderTransitionFailure } from "./order-bulk-transition";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import type { OrderTransitionItem } from "@/lib/repairdesk/types";
import type { RepairOrderStatus } from "@/lib/mock/enums";

export type OrderTransitionAttempt = OrderTransitionItem & {
  intent: string;
};

/** Keep both the original version and key after a lost response, even if a refetch arrives. */
export function getOrderTransitionAttempt(
  previous: OrderTransitionAttempt | undefined,
  input: { scope: string; id: string; to: RepairOrderStatus; reason?: string; updatedAt: string },
): OrderTransitionAttempt {
  const intent = JSON.stringify([input.scope, input.id, input.to, input.reason ?? ""]);
  return previous?.intent === intent
    ? previous
    : {
        intent,
        id: input.id,
        expected_updated_at: input.updatedAt,
        idempotency_key: crypto.randomUUID(),
      };
}

export function isDefinitiveTransitionFailure(error: unknown) {
  if (!(error instanceof RepairDeskApiError) || error.status >= 500) return false;
  // Legacy routes may return HTTP 400 after an uncertain database/audit write.
  if ([401, 403, 404, 409].includes(error.status)) return true;
  const classification = classifyOrderTransitionFailure(error);
  return classification !== "UNAVAILABLE" && classification !== "TRANSITION_FAILED";
}
