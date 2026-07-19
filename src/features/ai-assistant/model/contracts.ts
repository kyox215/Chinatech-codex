import { z } from "zod";

import {
  AI_INVENTORY_IMAGE_MAX_DATA_URL_CHARACTERS,
  AI_INVENTORY_IMAGE_MAX_DERIVED_BYTES,
  AI_INVENTORY_IMAGE_MAX_EDGE,
  AI_INVENTORY_IMAGE_MAX_PIXELS,
} from "./inventory-image-policy";

export const AI_ASSISTANT_CONTRACT_VERSION = "ai-assistant-v1" as const;
export const AI_ORDER_PLANNER_PROMPT_VERSION = "order-planner-v3" as const;
export const AI_INVENTORY_RECOGNITION_PROMPT_VERSION = "inventory-label-v1" as const;

export const aiAssistantLocaleSchema = z.enum(["zh-CN", "it-IT", "en"]);
export type AiAssistantLocale = z.infer<typeof aiAssistantLocaleSchema>;

export const aiAssistantConfidenceSchema = z.enum(["high", "review", "unknown"]);
export type AiAssistantConfidence = z.infer<typeof aiAssistantConfidenceSchema>;

export const aiAssistantRequestSchema = z
  .object({
    client_request_id: z.string().uuid().optional(),
    message: z.string().trim().min(1, "请输入问题").max(800, "问题不能超过 800 个字符"),
    locale: aiAssistantLocaleSchema.default("zh-CN"),
  })
  .strict();
export type AiAssistantRequest = z.infer<typeof aiAssistantRequestSchema>;

export const aiAssistantCapabilitiesSchema = z
  .object({
    canUseOrderAssistant: z.boolean(),
    canUseVisionIntake: z.boolean(),
    canApplyInventoryDraft: z.boolean(),
    reason: z.enum(["feature_off", "permission_denied", "rollout_not_enabled"]).optional(),
  })
  .strict();
export type AiAssistantCapabilities = z.infer<typeof aiAssistantCapabilitiesSchema>;

export const aiOrderSearchArgumentsSchema = z
  .object({
    search: z.string().trim().max(120).nullable(),
    device_search: z.string().trim().max(80).nullable(),
    view: z.enum(["active", "archive", "all"]),
    paid: z.enum(["all", "paid", "unpaid"]),
    overdue: z.enum(["approval", "pickup", "any"]).nullable(),
    queue_group: z
      .enum([
        "processing",
        "ordered",
        "arrived",
        "arrived_notified",
        "repaired",
        "repaired_notified",
      ])
      .nullable(),
    financial_review: z.enum(["amount_anomaly"]).nullable(),
    page_size: z.number().int().min(1).max(20),
  })
  .strict();

export const aiOrderSummaryArgumentsSchema = z
  .object({
    order_reference: z.string().trim().min(1).max(120),
  })
  .strict();

export const aiOrderClarificationArgumentsSchema = z
  .object({
    question: z.string().trim().min(1).max(240),
  })
  .strict();

export const aiOrderToolCallSchema = z.discriminatedUnion("name", [
  z
    .object({
      name: z.literal("search_orders"),
      arguments: aiOrderSearchArgumentsSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("get_order_summary"),
      arguments: aiOrderSummaryArgumentsSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("clarify_order_query"),
      arguments: aiOrderClarificationArgumentsSchema,
    })
    .strict(),
]);
export type AiOrderToolCall = z.infer<typeof aiOrderToolCallSchema>;

export const aiOrderCardSchema = z
  .object({
    id: z.string().min(1),
    public_no: z.string().min(1),
    customer_hint: z.string(),
    device_label: z.string(),
    status: z.string(),
    status_label: z.string(),
    updated_at: z.string(),
    href: z.string().startsWith("/orders/"),
  })
  .strict();
export type AiOrderCard = z.infer<typeof aiOrderCardSchema>;

export const aiOrderAssistantResponseSchema = z
  .object({
    request_id: z.string().uuid(),
    contract_version: z.literal(AI_ASSISTANT_CONTRACT_VERSION),
    kind: z.enum(["search_results", "order_summary", "clarification"]),
    message: z.string(),
    cards: z.array(aiOrderCardSchema).max(20),
    total: z.number().int().nonnegative(),
    result_truncated: z.boolean(),
    generated_at: z.string().datetime({ offset: true }),
    source: z.literal("repairdesk"),
  })
  .strict();
export type AiOrderAssistantResponse = z.infer<typeof aiOrderAssistantResponseSchema>;

export const aiInventoryFieldNameSchema = z.enum([
  "brand",
  "model",
  "color",
  "ram_capacity",
  "storage_capacity",
]);
export type AiInventoryFieldName = z.infer<typeof aiInventoryFieldNameSchema>;

export const aiInventoryEvidenceSourceSchema = z.enum([
  "vision",
  "ocr",
  "barcode",
  "merged",
  "unknown",
]);
export type AiInventoryEvidenceSource = z.infer<typeof aiInventoryEvidenceSourceSchema>;

export const aiInventoryFieldCandidateSchema = z
  .object({
    value: z.string().trim().max(120).nullable(),
    confidence: aiAssistantConfidenceSchema,
    evidence: z.string().trim().max(240).nullable(),
    source: aiInventoryEvidenceSourceSchema,
  })
  .strict();
export type AiInventoryFieldCandidate = z.infer<typeof aiInventoryFieldCandidateSchema>;

export const aiInventoryIdentifierTypeSchema = z.enum([
  "imei1",
  "imei2",
  "serial",
  "ean",
  "sku",
  "unknown",
]);
export type AiInventoryIdentifierType = z.infer<typeof aiInventoryIdentifierTypeSchema>;

export const aiInventoryIdentifierCandidateSchema = z
  .object({
    type: aiInventoryIdentifierTypeSchema,
    value: z.string().trim().min(1).max(80),
    confidence: aiAssistantConfidenceSchema,
    evidence: z.string().trim().max(240).nullable(),
    source: aiInventoryEvidenceSourceSchema,
    validation: z.enum(["valid", "invalid", "not_applicable"]),
  })
  .strict();
export type AiInventoryIdentifierCandidate = z.infer<typeof aiInventoryIdentifierCandidateSchema>;

export const aiInventoryConflictSchema = z
  .object({
    target: z.enum(["brand", "model", "color", "ram_capacity", "storage_capacity", "identifiers"]),
    values: z.array(z.string().trim().min(1).max(120)).min(2).max(6),
    sources: z.array(aiInventoryEvidenceSourceSchema).min(2).max(6),
  })
  .strict();
export type AiInventoryConflict = z.infer<typeof aiInventoryConflictSchema>;

export const aiInventoryRecognitionSchema = z
  .object({
    schema_version: z.literal(AI_ASSISTANT_CONTRACT_VERSION),
    fields: z
      .object({
        brand: aiInventoryFieldCandidateSchema,
        model: aiInventoryFieldCandidateSchema,
        color: aiInventoryFieldCandidateSchema,
        ram_capacity: aiInventoryFieldCandidateSchema,
        storage_capacity: aiInventoryFieldCandidateSchema,
      })
      .strict(),
    identifiers: z.array(aiInventoryIdentifierCandidateSchema).max(12),
    conflicts: z.array(aiInventoryConflictSchema).max(12),
    warnings: z.array(z.string().trim().min(1).max(240)).max(12),
    label_claim_only: z.literal(true),
  })
  .strict();
export type AiInventoryRecognition = z.infer<typeof aiInventoryRecognitionSchema>;

export const aiInventoryVisionRequestSchema = z
  .object({
    client_request_id: z.string().uuid(),
    image_data_url: z
      .string()
      .min(32)
      .max(AI_INVENTORY_IMAGE_MAX_DATA_URL_CHARACTERS)
      .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
    mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
    byte_length: z.number().int().min(1).max(AI_INVENTORY_IMAGE_MAX_DERIVED_BYTES),
    width: z.number().int().min(1).max(AI_INVENTORY_IMAGE_MAX_EDGE),
    height: z.number().int().min(1).max(AI_INVENTORY_IMAGE_MAX_EDGE),
    locale: aiAssistantLocaleSchema.default("zh-CN"),
    fixture_key: z.literal("synthetic-redmi-a7-pro-box").optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.width * value.height > AI_INVENTORY_IMAGE_MAX_PIXELS) {
      context.addIssue({
        code: "custom",
        path: ["width"],
        message: "图片像素超过安全限制",
      });
    }
  });
export type AiInventoryVisionRequest = z.infer<typeof aiInventoryVisionRequestSchema>;

export const aiInventoryVisionResponseSchema = z
  .object({
    request_id: z.string().uuid(),
    contract_version: z.literal(AI_ASSISTANT_CONTRACT_VERSION),
    recognition: aiInventoryRecognitionSchema,
    provider: z.enum(["fake", "openai"]),
    model_version: z.string().trim().min(1).max(120),
    generated_at: z.string().datetime({ offset: true }),
  })
  .strict();
export type AiInventoryVisionResponse = z.infer<typeof aiInventoryVisionResponseSchema>;

export const aiOrderSearchArgumentsJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    search: { type: ["string", "null"], maxLength: 120 },
    device_search: {
      type: ["string", "null"],
      maxLength: 80,
      description:
        "Use for a concrete device brand and model. Preserve both parts exactly enough to identify the device; never reduce Apple iPhone 15 to the number 15. Set search=null when this is used.",
    },
    view: { type: "string", enum: ["active", "archive", "all"] },
    paid: { type: "string", enum: ["all", "paid", "unpaid"] },
    overdue: { type: ["string", "null"], enum: ["approval", "pickup", "any", null] },
    queue_group: {
      type: ["string", "null"],
      enum: [
        "processing",
        "ordered",
        "arrived",
        "arrived_notified",
        "repaired",
        "repaired_notified",
        null,
      ],
    },
    financial_review: {
      type: ["string", "null"],
      enum: ["amount_anomaly", null],
      description:
        "Use amount_anomaly only when the user asks for orders whose quote, deposit, balance, paid flag, or payment status is internally inconsistent.",
    },
    page_size: { type: "integer", minimum: 1, maximum: 20 },
  },
  required: [
    "search",
    "device_search",
    "view",
    "paid",
    "overdue",
    "queue_group",
    "financial_review",
    "page_size",
  ],
} as const;

export const aiOrderSummaryArgumentsJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    order_reference: { type: "string", minLength: 1, maxLength: 120 },
  },
  required: ["order_reference"],
} as const;

export const aiOrderClarificationArgumentsJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    question: { type: "string", minLength: 1, maxLength: 240 },
  },
  required: ["question"],
} as const;

const aiInventoryFieldCandidateJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    value: { type: ["string", "null"], maxLength: 120 },
    confidence: { type: "string", enum: ["high", "review", "unknown"] },
    evidence: { type: ["string", "null"], maxLength: 240 },
    source: { type: "string", enum: ["vision", "ocr", "barcode", "merged", "unknown"] },
  },
  required: ["value", "confidence", "evidence", "source"],
} as const;

export const aiInventoryRecognitionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    schema_version: { type: "string", const: AI_ASSISTANT_CONTRACT_VERSION },
    fields: {
      type: "object",
      additionalProperties: false,
      properties: {
        brand: aiInventoryFieldCandidateJsonSchema,
        model: aiInventoryFieldCandidateJsonSchema,
        color: aiInventoryFieldCandidateJsonSchema,
        ram_capacity: aiInventoryFieldCandidateJsonSchema,
        storage_capacity: aiInventoryFieldCandidateJsonSchema,
      },
      required: ["brand", "model", "color", "ram_capacity", "storage_capacity"],
    },
    identifiers: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["imei1", "imei2", "serial", "ean", "sku", "unknown"],
          },
          value: { type: "string", minLength: 1, maxLength: 80 },
          confidence: { type: "string", enum: ["high", "review", "unknown"] },
          evidence: { type: ["string", "null"], maxLength: 240 },
          source: {
            type: "string",
            enum: ["vision", "ocr", "barcode", "merged", "unknown"],
          },
          validation: {
            type: "string",
            enum: ["valid", "invalid", "not_applicable"],
          },
        },
        required: ["type", "value", "confidence", "evidence", "source", "validation"],
      },
    },
    conflicts: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          target: {
            type: "string",
            enum: ["brand", "model", "color", "ram_capacity", "storage_capacity", "identifiers"],
          },
          values: {
            type: "array",
            minItems: 2,
            maxItems: 6,
            items: { type: "string", minLength: 1, maxLength: 120 },
          },
          sources: {
            type: "array",
            minItems: 2,
            maxItems: 6,
            items: {
              type: "string",
              enum: ["vision", "ocr", "barcode", "merged", "unknown"],
            },
          },
        },
        required: ["target", "values", "sources"],
      },
    },
    warnings: {
      type: "array",
      maxItems: 12,
      items: { type: "string", minLength: 1, maxLength: 240 },
    },
    label_claim_only: { type: "boolean", const: true },
  },
  required: [
    "schema_version",
    "fields",
    "identifiers",
    "conflicts",
    "warnings",
    "label_claim_only",
  ],
} as const;

/**
 * Cloud vision is intentionally specification-only. IMEI/SN/barcodes remain a
 * local scan/manual-entry concern even though the shared review contract can
 * merge locally extracted identifiers afterwards.
 */
export const aiInventoryCloudRecognitionJsonSchema = {
  ...aiInventoryRecognitionJsonSchema,
  properties: {
    ...aiInventoryRecognitionJsonSchema.properties,
    identifiers: {
      ...aiInventoryRecognitionJsonSchema.properties.identifiers,
      maxItems: 0,
    },
  },
} as const;
