import { describe, expect, it } from "vitest";

import {
  AI_ASSISTANT_CONTRACT_VERSION,
  aiAssistantRequestSchema,
  aiInventoryRecognitionJsonSchema,
  aiInventoryRecognitionSchema,
  aiInventoryVisionRequestSchema,
  aiOrderSearchArgumentsJsonSchema,
  aiOrderToolCallSchema,
} from "./contracts";

describe("AI assistant contracts", () => {
  it("rejects extra request and tool fields", () => {
    expect(() =>
      aiAssistantRequestSchema.parse({ message: "查找今天的工单", locale: "zh-CN", store_id: "x" }),
    ).toThrow();
    expect(() =>
      aiOrderToolCallSchema.parse({
        name: "get_order_summary",
        arguments: { order_reference: "R-1001", store_id: "other-store" },
      }),
    ).toThrow();
    expect(() =>
      aiInventoryVisionRequestSchema.parse({
        client_request_id: "00000000-0000-4000-8000-000000000203",
        image_data_url: "data:image/jpeg;base64,/9j/wAA=",
        mime_type: "image/jpeg",
        byte_length: 5,
        width: 1,
        height: 1,
        locale: "zh-CN",
        store_id: "other-store",
      }),
    ).toThrow();
  });

  it("keeps every strict JSON-schema object closed and required", () => {
    expect(aiOrderSearchArgumentsJsonSchema.additionalProperties).toBe(false);
    expect(aiOrderSearchArgumentsJsonSchema.required).toEqual(
      Object.keys(aiOrderSearchArgumentsJsonSchema.properties),
    );
    expect(aiInventoryRecognitionJsonSchema.additionalProperties).toBe(false);
    expect(aiInventoryRecognitionJsonSchema.properties.fields.additionalProperties).toBe(false);
    expect(aiInventoryRecognitionJsonSchema.properties.identifiers.items.additionalProperties).toBe(
      false,
    );
    expect(aiInventoryRecognitionJsonSchema.properties.conflicts.items.additionalProperties).toBe(
      false,
    );
  });

  it("requires unknown fields to remain explicitly empty", () => {
    expect(() =>
      aiInventoryRecognitionSchema.parse({
        schema_version: AI_ASSISTANT_CONTRACT_VERSION,
        fields: {
          brand: { value: "Redmi", confidence: "high", evidence: "label", source: "vision" },
        },
        identifiers: [],
        conflicts: [],
        warnings: [],
        label_claim_only: true,
      }),
    ).toThrow();
  });
});
