import { describe, expect, it, vi } from "vitest";

import {
  assertDurableAiProviderBudgetGateway,
  type AiProviderBudgetGateway,
} from "./provider-budget";

describe("AI provider budget contract", () => {
  it("rejects absent and process-local gateways for paid calls", () => {
    expect(() => assertDurableAiProviderBudgetGateway(undefined)).toThrow(/durable/);
    const local = {
      durability: "process_local",
      reserve: vi.fn(),
      settle: vi.fn(),
    } satisfies AiProviderBudgetGateway;
    expect(() => assertDurableAiProviderBudgetGateway(local)).toThrow(/durable/);
  });

  it("carries the same transient identity required by reserve/finalize/release RPCs", async () => {
    const reserve = vi.fn<AiProviderBudgetGateway["reserve"]>(async () => ({
      reservationId: "reservation-1",
      clientRequestId: "client-request-1",
      policyVersion: "ai-runtime-v1",
      reservedMicroUsd: 308n,
      expiresAt: "2026-07-18T12:10:00.000Z",
    }));
    const settle = vi.fn<AiProviderBudgetGateway["settle"]>(async () => undefined);
    const gateway = { durability: "durable", reserve, settle } satisfies AiProviderBudgetGateway;
    const identity = {
      storeId: "store-1",
      actorId: "staff-1",
      clientRequestId: "client-request-1",
      requestFingerprintHmac: "a".repeat(43),
    };

    await gateway.reserve({
      ...identity,
      requestKind: "order_text",
      policyVersion: "ai-runtime-v1",
      pricingVersion: "openai-pricing-2026-07-18",
      model: "gpt-5-nano-2025-08-07",
      reservedMicroUsd: 308n,
    });
    await gateway.settle({ ...identity, outcome: "not_sent" });

    expect(reserve).toHaveBeenCalledWith(expect.objectContaining(identity));
    expect(settle).toHaveBeenCalledWith(expect.objectContaining(identity));
  });
});
