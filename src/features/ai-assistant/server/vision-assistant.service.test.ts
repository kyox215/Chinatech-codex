import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ writeAiAssistantAudit: vi.fn() }));

vi.mock("./audit", async (importOriginal) => {
  const original = await importOriginal<typeof import("./audit")>();
  return { ...original, writeAiAssistantAudit: mocks.writeAiAssistantAudit };
});

import {
  AI_ASSISTANT_CONTRACT_VERSION,
  type AiInventoryRecognition,
  type AiInventoryVisionRequest,
} from "@/features/ai-assistant/model/contracts";
import { AiProviderRequestError, type AiAssistantProvider } from "./provider";
import { AiProviderBudgetError, type AiProviderBudgetGateway } from "./provider-budget";
import { aiQuotaExhaustedError } from "./errors";
import { runAiInventoryVisionRecognition } from "./vision-assistant.service";
import { resetAiAssistantLocalRateLimitForTests } from "./request-rate-limit";
import type { AuditActor } from "@/lib/repairdesk/types";

const enabledEnv = {
  AI_ASSISTANT_ENABLED: "1",
  AI_VISION_INTAKE_ENABLED: "1",
  AI_ASSISTANT_STORE_ALLOWLIST: "store-1",
} as const;

const liveVisionEnv = {
  ...enabledEnv,
  AI_ASSISTANT_PROVIDER: "openai",
  AI_ASSISTANT_EXTERNAL_DATA_APPROVED: "1",
  AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED: "1",
  AI_ASSISTANT_BUDGET_APPROVED: "1",
  AI_ASSISTANT_DURABLE_QUOTA_BACKEND: "supabase-v1",
  AI_ASSISTANT_POLICY_VERSION: "ai-runtime-v1",
  AI_ASSISTANT_PRICING_VERSION: "openai-pricing-2026-07-18",
  AI_ASSISTANT_MONTHLY_BUDGET_MICRO_USD: "50000000",
  AI_ASSISTANT_ORDER_TEXT_PER_STORE_DAY: "20",
  AI_ASSISTANT_INVENTORY_VISION_PER_STORE_DAY: "10",
  AI_ASSISTANT_PROVIDER_REQUESTS_GLOBAL_DAY: "300",
  AI_ASSISTANT_REQUESTS_PER_ACTOR_MINUTE: "30",
  AI_ASSISTANT_QUOTA_TIMEZONE: "Europe/Rome",
  AI_ASSISTANT_SAFETY_IDENTIFIER_SECRET: "test-only-safety-secret-with-at-least-32-characters",
  AI_ASSISTANT_REQUEST_FINGERPRINT_SECRET:
    "test-only-fingerprint-secret-with-at-least-32-characters",
} as const;

describe("inventory vision assistant service", () => {
  beforeEach(() => {
    mocks.writeAiAssistantAudit.mockReset();
    resetAiAssistantLocalRateLimitForTests();
  });

  it("checks feature and permission gates before image or provider processing", async () => {
    const provider = providerFor();
    await expect(run({ provider, env: {} })).rejects.toMatchObject({
      code: "AI_DISABLED",
      status: 404,
    });
    expect(provider.recognizeInventoryLabel).not.toHaveBeenCalled();

    await expect(
      run({ provider, actor: { ...owner, role: "viewer", storeRole: "viewer" } }),
    ).rejects.toMatchObject({ code: "AI_NOT_AUTHORIZED", status: 403 });
    expect(provider.recognizeInventoryLabel).not.toHaveBeenCalled();
  });

  it("enforces quota before invoking the provider", async () => {
    const provider = providerFor();
    await expect(
      run({
        provider,
        consumeQuota: vi.fn(() => {
          throw aiQuotaExhaustedError();
        }),
      }),
    ).rejects.toMatchObject({ code: "AI_QUOTA_EXHAUSTED", status: 429 });
    expect(provider.recognizeInventoryLabel).not.toHaveBeenCalled();
  });

  it("validates and returns only strict fake-provider recognition output", async () => {
    const provider = providerFor();
    const response = await run({ provider, now: () => new Date("2026-07-18T12:00:00.000Z") });

    expect(response).toMatchObject({
      contract_version: AI_ASSISTANT_CONTRACT_VERSION,
      provider: "fake",
      model_version: "fake-vision-test",
      recognition: { fields: { model: { value: "A7 Pro" } }, label_claim_only: true },
    });
    expect(provider.recognizeInventoryLabel).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: "image/jpeg", locale: "zh-CN" }),
    );
    expect(mocks.writeAiAssistantAudit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        event: "vision_recognition",
        status: "succeeded",
        provider: "fake",
        inputImageCount: 1,
        resultCount: 5,
      }),
    );
    expect(JSON.stringify(mocks.writeAiAssistantAudit.mock.calls)).not.toContain("data:image");
  });

  it("rejects malformed derived image claims before provider execution", async () => {
    const provider = providerFor();
    const consumeQuota = vi.fn();
    const input = validInput();
    await expect(
      run({
        provider,
        consumeQuota,
        input: { ...input, byte_length: input.byte_length + 1 },
      }),
    ).rejects.toMatchObject({ code: "AI_INVALID_INPUT", status: 400 });
    expect(consumeQuota).not.toHaveBeenCalled();
    expect(provider.recognizeInventoryLabel).not.toHaveBeenCalled();
    expect(mocks.writeAiAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorCode: "AI_INVALID_INPUT" }),
    );
  });

  it("maps provider and protocol failures to safe envelopes", async () => {
    const failedProvider = providerFor();
    vi.mocked(failedProvider.recognizeInventoryLabel).mockRejectedValueOnce(
      new Error("SECRET provider response and URL"),
    );
    await expect(run({ provider: failedProvider })).rejects.toMatchObject({
      code: "AI_PROVIDER_UNAVAILABLE",
      message: "AI 图片识别暂时不可用，请使用手工录入",
    });

    const invalidProvider = providerFor();
    vi.mocked(invalidProvider.recognizeInventoryLabel).mockResolvedValueOnce({
      recognition: { secret: "SECRET protocol payload" } as unknown as AiInventoryRecognition,
      metadata: { provider: "fake", model: "fake-vision-test", latencyMs: 4 },
    });
    await expect(run({ provider: invalidProvider })).rejects.toMatchObject({
      code: "AI_PROVIDER_PROTOCOL_ERROR",
      status: 502,
    });
  });

  it("maps Node provider deadline timeouts to the stable timeout envelope", async () => {
    const provider = providerFor();
    vi.mocked(provider.recognizeInventoryLabel).mockRejectedValueOnce(
      new DOMException("provider deadline", "TimeoutError"),
    );

    await expect(run({ provider })).rejects.toMatchObject({
      code: "AI_PROVIDER_TIMEOUT",
      status: 504,
    });
    expect(mocks.writeAiAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorCode: "AI_PROVIDER_TIMEOUT" }),
    );
  });

  it("fails closed if a non-fake provider reaches the Phase 2 service", async () => {
    const provider = providerFor();
    Object.defineProperty(provider, "name", { value: "openai" });
    await expect(run({ provider })).rejects.toMatchObject({
      code: "AI_MISCONFIGURED",
      status: 503,
    });
    expect(provider.recognizeInventoryLabel).not.toHaveBeenCalled();
  });

  it("runs the live vision budget lifecycle before returning strict recognition", async () => {
    const events: string[] = [];
    const provider = openAiProviderFor(events);
    const gateway = durableGateway(events);
    const input = { ...validInput(), client_request_id: "00000000-0000-4000-8000-000000000103" };

    const response = await run({ provider, gateway, env: liveVisionEnv, input });

    expect(response).toMatchObject({
      provider: "openai",
      model_version: "gpt-4o-mini-2024-07-18",
      recognition: { identifiers: [], label_claim_only: true },
    });
    expect(events).toEqual(["reserve", "provider", "settle:completed"]);
    expect(gateway.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        clientRequestId: input.client_request_id,
        requestKind: "inventory_vision",
        reservedMicroUsd: 8115n,
      }),
    );
    expect(gateway.settle).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "completed", estimatedMicroUsd: 27n }),
    );
  });

  it("blocks live vision before provider dispatch when the durable quota rejects", async () => {
    const provider = openAiProviderFor();
    const gateway = durableGateway();
    vi.mocked(gateway.reserve).mockRejectedValueOnce(
      new AiProviderBudgetError("quota", "monthly_budget_reached"),
    );

    await expect(run({ provider, gateway, env: liveVisionEnv })).rejects.toMatchObject({
      code: "AI_QUOTA_EXHAUSTED",
      status: 429,
    });
    expect(provider.recognizeInventoryLabel).not.toHaveBeenCalled();
    expect(gateway.settle).not.toHaveBeenCalled();
  });

  it("holds sent-unknown live vision reservations and releases only not-sent failures", async () => {
    const unknownProvider = openAiProviderFor();
    const unknownGateway = durableGateway();
    vi.mocked(unknownProvider.recognizeInventoryLabel).mockRejectedValueOnce(
      new AiProviderRequestError("transport", "sent_unknown"),
    );
    await expect(
      run({ provider: unknownProvider, gateway: unknownGateway, env: liveVisionEnv }),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_UNAVAILABLE" });
    expect(unknownGateway.settle).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "sent_unknown" }),
    );

    const notSentProvider = openAiProviderFor();
    const notSentGateway = durableGateway();
    vi.mocked(notSentProvider.recognizeInventoryLabel).mockRejectedValueOnce(
      new AiProviderRequestError("configuration", "not_sent"),
    );
    await expect(
      run({ provider: notSentProvider, gateway: notSentGateway, env: liveVisionEnv }),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_UNAVAILABLE" });
    expect(notSentGateway.settle).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "not_sent" }),
    );
  });

  it("fails closed without logging provider details when required audit persistence fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.writeAiAssistantAudit.mockRejectedValueOnce(new Error("SECRET audit database detail"));

    await expect(run({ provider: providerFor() })).rejects.toMatchObject({
      code: "AI_AUDIT_UNAVAILABLE",
      status: 503,
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("SECRET");
    consoleError.mockRestore();
  });
});

const owner: AuditActor = {
  id: "staff-owner",
  displayName: "Owner",
  role: "owner",
  storeRole: "owner",
  storeId: "store-1",
  activeMembershipId: "membership-owner",
};

function run({
  provider,
  actor = owner,
  env = enabledEnv,
  input = validInput(),
  consumeQuota,
  gateway,
  now,
}: {
  provider: AiAssistantProvider;
  actor?: AuditActor;
  env?: typeof enabledEnv | Record<string, string>;
  input?: AiInventoryVisionRequest;
  consumeQuota?: () => unknown;
  gateway?: AiProviderBudgetGateway;
  now?: () => Date;
}) {
  return runAiInventoryVisionRecognition({
    actor,
    input,
    dependencies: { provider, env, consumeQuota, budgetGateway: gateway, now },
  });
}

function openAiProviderFor(orderOfEvents: string[] = []): AiAssistantProvider {
  return {
    name: "openai",
    planOrderQuery: vi.fn(async () => {
      throw new Error("not used in vision tests");
    }),
    recognizeInventoryLabel: vi.fn(async () => {
      orderOfEvents.push("provider");
      return {
        recognition: recognition(),
        metadata: {
          provider: "openai" as const,
          model: "gpt-4o-mini-2024-07-18",
          requestId: "req_test_vision",
          usage: {
            inputTokens: 100,
            cachedInputTokens: 10,
            cacheWriteTokens: 0,
            outputTokens: 20,
            reasoningTokens: 0,
            totalTokens: 120,
          },
          attempts: 1 as const,
          latencyMs: 50,
        },
      };
    }),
  };
}

function durableGateway(orderOfEvents: string[] = []): AiProviderBudgetGateway {
  return {
    durability: "durable",
    reserve: vi.fn(async (input) => {
      orderOfEvents.push("reserve");
      return {
        reservationId: "00000000-0000-4000-8000-000000000104",
        clientRequestId: input.clientRequestId,
        policyVersion: input.policyVersion,
        reservedMicroUsd: input.reservedMicroUsd,
        expiresAt: "2026-07-18T12:10:00.000Z",
      };
    }),
    settle: vi.fn<AiProviderBudgetGateway["settle"]>(async (input) => {
      orderOfEvents.push(`settle:${input.outcome}`);
      if (input.outcome === "completed") {
        return { state: "succeeded", estimatedMicroUsd: 27n };
      }
      if (input.outcome === "not_sent") return { state: "failed_pre_dispatch" };
      return { state: "held_for_stale_settlement" };
    }),
  };
}

function providerFor(): AiAssistantProvider {
  return {
    name: "fake",
    planOrderQuery: vi.fn(async () => {
      throw new Error("not used in vision tests");
    }),
    recognizeInventoryLabel: vi.fn(async () => ({
      recognition: recognition(),
      metadata: { provider: "fake" as const, model: "fake-vision-test", latencyMs: 4 },
    })),
  };
}

function recognition(): AiInventoryRecognition {
  const field = (value: string) => ({
    value,
    confidence: "review" as const,
    evidence: "synthetic label",
    source: "vision" as const,
  });
  return {
    schema_version: AI_ASSISTANT_CONTRACT_VERSION,
    fields: {
      brand: field("Redmi"),
      model: field("A7 Pro"),
      color: field("Black"),
      ram_capacity: field("4 GB"),
      storage_capacity: field("64 GB"),
    },
    identifiers: [],
    conflicts: [],
    warnings: ["仅为合成标签声明"],
    label_claim_only: true,
  };
}

function validInput(): AiInventoryVisionRequest {
  const bytes = jpeg(3, 2);
  return {
    image_data_url: `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`,
    mime_type: "image/jpeg",
    byte_length: bytes.length,
    width: 3,
    height: 2,
    locale: "zh-CN",
    fixture_key: "synthetic-redmi-a7-pro-box",
  };
}

function jpeg(width: number, height: number) {
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x07,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0xff,
    0xd9,
  ]);
}
