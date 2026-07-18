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
import type { AiAssistantProvider } from "./provider";
import { aiQuotaExhaustedError } from "./errors";
import { runAiInventoryVisionRecognition } from "./vision-assistant.service";
import { resetAiAssistantLocalRateLimitForTests } from "./request-rate-limit";
import type { AuditActor } from "@/lib/repairdesk/types";

const enabledEnv = {
  AI_ASSISTANT_ENABLED: "1",
  AI_VISION_INTAKE_ENABLED: "1",
  AI_ASSISTANT_STORE_ALLOWLIST: "store-1",
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
  now,
}: {
  provider: AiAssistantProvider;
  actor?: AuditActor;
  env?: typeof enabledEnv | Record<string, string>;
  input?: AiInventoryVisionRequest;
  consumeQuota?: () => unknown;
  now?: () => Date;
}) {
  return runAiInventoryVisionRecognition({
    actor,
    input,
    dependencies: { provider, env, consumeQuota, now },
  });
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
