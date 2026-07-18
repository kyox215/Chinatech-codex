import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ writeAuditLog: vi.fn() }));

vi.mock("@/server/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));

import {
  bucketAiAssistantInputBytes,
  bucketAiAssistantLatency,
  writeAiAssistantAudit,
} from "./audit";

describe("AI assistant audit allowlist", () => {
  beforeEach(() => mocks.writeAuditLog.mockReset());

  it("persists metrics without prompt, OCR, identifiers, images, paths or raw model output", async () => {
    await writeAiAssistantAudit({
      actor: { id: "staff-1", displayName: "Staff", storeId: "store-1" },
      event: "vision_recognition",
      requestId: "00000000-0000-4000-8000-000000000001",
      status: "succeeded",
      provider: "fake",
      modelVersion: "fake-v1",
      promptVersion: "vision-v1",
      schemaVersion: "schema-v1",
      inputImageCount: 1,
      inputBytesBucket: "256k-1m",
      resultCount: 5,
      inputTokens: 120,
      outputTokens: 30,
      latencyBucket: "1-5s",
    });

    const payload = mocks.writeAuditLog.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      action: "vision_recognition",
      entityType: "ai_assistant_request",
      metadata: {
        input_image_count: 1,
        input_token_count: 120,
        output_token_count: 30,
      },
    });
    expect(Object.keys(payload.metadata).sort()).toEqual(
      [
        "input_bytes_bucket",
        "input_image_count",
        "input_token_count",
        "latency_bucket",
        "model_version",
        "output_token_count",
        "prompt_version",
        "provider",
        "result_count",
        "schema_version",
        "status",
      ].sort(),
    );
    expect(JSON.stringify(payload)).not.toMatch(
      /prompt_text|ocr_text|tool_arguments|model_response|raw_output|image_url|imei|serial/i,
    );
  });

  it("uses non-sensitive buckets", () => {
    expect(bucketAiAssistantLatency(999)).toBe("under-1s");
    expect(bucketAiAssistantLatency(60_001)).toBe("over-60s");
    expect(bucketAiAssistantInputBytes(0)).toBe("0");
    expect(bucketAiAssistantInputBytes(4 * 1024 * 1024 + 1)).toBe("over-4m");
  });
});
