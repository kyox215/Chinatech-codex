import type { AiAssistantRequestKind, AiBillableUsage } from "./cost-policy";

export type AiProviderBudgetReservation = {
  reservationId: string;
  clientRequestId: string;
  policyVersion: string;
  reservedMicroUsd: bigint;
  expiresAt: string;
};

export type AiProviderBudgetRequestIdentity = {
  storeId: string;
  actorId: string;
  clientRequestId: string;
  requestFingerprintHmac: string;
};

export interface AiProviderBudgetGateway {
  readonly durability: "process_local" | "durable";
  reserve(
    input: AiProviderBudgetRequestIdentity & {
      requestKind: AiAssistantRequestKind;
      policyVersion: string;
      pricingVersion: string;
      model: string;
      reservedMicroUsd: bigint;
    },
  ): Promise<AiProviderBudgetReservation>;
  settle(
    input: AiProviderBudgetRequestIdentity & {
      outcome: "completed" | "sent_unknown" | "not_sent";
      usage?: AiBillableUsage;
      estimatedMicroUsd?: bigint;
      providerAttemptCount?: 1;
    },
  ): Promise<void>;
}

export function assertDurableAiProviderBudgetGateway(
  gateway: AiProviderBudgetGateway | undefined,
): asserts gateway is AiProviderBudgetGateway {
  if (!gateway || gateway.durability !== "durable") {
    throw new Error("durable AI provider budget gateway is required");
  }
}
