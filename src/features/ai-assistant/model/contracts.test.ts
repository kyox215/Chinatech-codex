import { describe, expect, it } from "vitest";

import {
  AI_ASSISTANT_CONTRACT_VERSION,
  aiAssistantRequestSchema,
  aiInventoryRecognitionJsonSchema,
  aiInventoryRecognitionSchema,
  aiInventoryVisionRequestSchema,
  aiOrderInlineActionRequestSchema,
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

  it("accepts only the two declared processing modes and keeps legacy requests compatible", () => {
    expect(
      aiAssistantRequestSchema.parse({
        message: "苹果15",
        locale: "zh-CN",
        processing_mode: "local",
      }),
    ).toMatchObject({ processing_mode: "local" });
    expect(
      aiAssistantRequestSchema.parse({ message: "苹果15", locale: "zh-CN" }),
    ).not.toHaveProperty("processing_mode");
    expect(() =>
      aiAssistantRequestSchema.parse({
        message: "苹果15",
        locale: "zh-CN",
        processing_mode: "automatic",
      }),
    ).toThrow();
  });

  it("requires a bounded continuation token for every page after the first", () => {
    const continuationToken = "signed-continuation-token-with-more-than-32-characters";
    expect(
      aiAssistantRequestSchema.parse({
        message: "苹果15",
        locale: "zh-CN",
        page: 2,
        continuation_token: continuationToken,
      }),
    ).toMatchObject({ page: 2, continuation_token: continuationToken });
    expect(() =>
      aiAssistantRequestSchema.parse({ message: "苹果15", locale: "zh-CN", page: 2 }),
    ).toThrow();
    expect(() =>
      aiAssistantRequestSchema.parse({
        message: "苹果15",
        locale: "zh-CN",
        page: 1,
        continuation_token: continuationToken,
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

  it("accepts calendar, rolling, and strict absolute dates with evidence-qualified fields", () => {
    expect(
      aiOrderToolCallSchema.parse({
        name: "search_orders",
        arguments: {
          search: null,
          device_search: "Samsung A12",
          view: "all",
          paid: "all",
          overdue: null,
          queue_group: null,
          financial_review: null,
          date_filter: { expression: "current_calendar_month", field: "completed_at" },
          service_group: "display",
          completed_only: true,
          parts_status: null,
          page_size: 8,
        },
      }),
    ).toMatchObject({ name: "search_orders" });
    expect(
      aiOrderToolCallSchema.parse({
        name: "search_orders",
        arguments: {
          search: null,
          device_search: "iPhone 15",
          view: "all",
          paid: "all",
          overdue: null,
          queue_group: null,
          financial_review: null,
          date_filter: {
            expression: "rolling_period",
            field: "created_at",
            amount: 18,
            unit: "month",
          },
          service_group: null,
          completed_only: false,
          parts_status: null,
          page_size: 8,
        },
      }),
    ).toMatchObject({ name: "search_orders" });
    expect(
      aiOrderToolCallSchema.parse({
        name: "search_orders",
        arguments: {
          search: null,
          device_search: null,
          view: "all",
          paid: "all",
          overdue: null,
          queue_group: null,
          financial_review: null,
          date_filter: {
            expression: "absolute_range",
            field: "completed_at",
            from: "2024-02-01",
            to: "2025-11-30",
          },
          service_group: "display",
          completed_only: true,
          parts_status: null,
          page_size: 8,
        },
      }),
    ).toMatchObject({ name: "search_orders" });
    expect(() =>
      aiOrderToolCallSchema.parse({
        name: "search_orders",
        arguments: {
          search: null,
          device_search: null,
          view: "all",
          paid: "all",
          overdue: null,
          queue_group: null,
          financial_review: null,
          date_filter: {
            expression: "custom_utc",
            field: "created_at",
            from: "2026-07-01T00:00:00Z",
          },
          service_group: null,
          completed_only: false,
          parts_status: null,
          page_size: 8,
        },
      }),
    ).toThrow();
    for (const date_filter of [
      {
        expression: "absolute_range",
        field: "created_at",
        from: "2026-02-30",
        to: "2026-03-01",
      },
      {
        expression: "absolute_range",
        field: "created_at",
        from: "2026-07-20",
        to: "2026-07-01",
      },
      {
        expression: "rolling_period",
        field: "created_at",
        amount: 121,
        unit: "month",
      },
    ]) {
      expect(() =>
        aiOrderToolCallSchema.parse({
          name: "search_orders",
          arguments: {
            search: null,
            device_search: null,
            view: "all",
            paid: "all",
            overdue: null,
            queue_group: null,
            financial_review: null,
            date_filter,
            service_group: null,
            completed_only: false,
            parts_status: null,
            page_size: 8,
          },
        }),
      ).toThrow();
    }
  });

  it("keeps inline action confirmation bounded and caller-scope free", () => {
    expect(
      aiOrderInlineActionRequestSchema.parse({
        order_id: "order-1",
        action: "mark_parts_ordered",
        confirm_public_no: "R2026001",
        expected_updated_at: "2026-07-19T10:00:00.000Z",
        idempotency_key: "00000000-0000-4000-8000-000000000701",
      }),
    ).not.toHaveProperty("store_id");
    expect(() =>
      aiOrderInlineActionRequestSchema.parse({
        order_id: "order-1",
        action: "mark_parts_ordered",
        confirm_public_no: "R2026001",
        expected_updated_at: "2026-07-19T10:00:00.000Z",
        idempotency_key: "00000000-0000-4000-8000-000000000701",
        store_id: "other-store",
      }),
    ).toThrow();
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
