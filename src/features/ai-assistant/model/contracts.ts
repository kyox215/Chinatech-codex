import { z } from "zod";

import {
  AI_INVENTORY_IMAGE_MAX_DATA_URL_CHARACTERS,
  AI_INVENTORY_IMAGE_MAX_DERIVED_BYTES,
  AI_INVENTORY_IMAGE_MAX_EDGE,
  AI_INVENTORY_IMAGE_MAX_PIXELS,
} from "./inventory-image-policy";

export const AI_ASSISTANT_CONTRACT_VERSION = "ai-assistant-v1" as const;
export const AI_ORDER_ASSISTANT_CONTRACT_VERSION = "ai-order-assistant-v4" as const;
export const AI_ORDER_PLANNER_PROMPT_VERSION = "order-planner-v7" as const;
export const AI_INVENTORY_RECOGNITION_PROMPT_VERSION = "inventory-label-v1" as const;

export const aiAssistantLocaleSchema = z.enum(["zh-CN", "it-IT", "en"]);
export type AiAssistantLocale = z.infer<typeof aiAssistantLocaleSchema>;

export const aiAssistantProcessingModeSchema = z.enum(["local", "model"]);
export type AiAssistantProcessingMode = z.infer<typeof aiAssistantProcessingModeSchema>;

export const aiAssistantConfidenceSchema = z.enum(["high", "review", "unknown"]);
export type AiAssistantConfidence = z.infer<typeof aiAssistantConfidenceSchema>;

export const aiAssistantRequestSchema = z
  .object({
    client_request_id: z.string().uuid().optional(),
    message: z.string().trim().min(1, "请输入问题").max(800, "问题不能超过 800 个字符"),
    locale: aiAssistantLocaleSchema.default("zh-CN"),
    processing_mode: aiAssistantProcessingModeSchema.optional(),
    page: z.number().int().min(1).max(500).optional(),
    continuation_token: z.string().trim().min(32).max(2048).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const page = value.page ?? 1;
    if (page > 1 && !value.continuation_token) {
      context.addIssue({
        code: "custom",
        path: ["continuation_token"],
        message: "继续加载需要有效的查询令牌",
      });
    }
    if (value.continuation_token && page < 2) {
      context.addIssue({
        code: "custom",
        path: ["page"],
        message: "继续加载页码必须大于 1",
      });
    }
  });
export type AiAssistantRequest = z.infer<typeof aiAssistantRequestSchema>;

export const aiAssistantCapabilitiesSchema = z
  .object({
    canUseOrderAssistant: z.boolean(),
    canUseOrderModel: z.boolean().optional(),
    canUseOrderInlineActions: z.boolean(),
    canUseVisionIntake: z.boolean(),
    canApplyInventoryDraft: z.boolean(),
    reason: z.enum(["feature_off", "permission_denied", "rollout_not_enabled"]).optional(),
  })
  .strict();
export type AiAssistantCapabilities = z.infer<typeof aiAssistantCapabilitiesSchema>;

export const aiAssistantUsageMetricSchema = z
  .object({
    provider_request_count: z.number().int().nonnegative(),
    input_token_count: z.number().int().nonnegative(),
    cached_input_token_count: z.number().int().nonnegative(),
    output_token_count: z.number().int().nonnegative(),
    settled_cost_microusd: z.number().int().nonnegative(),
    reserved_cost_microusd: z.number().int().nonnegative(),
  })
  .strict();
export type AiAssistantUsageMetric = z.infer<typeof aiAssistantUsageMetricSchema>;

export const aiAssistantUsageKindMetricSchema = aiAssistantUsageMetricSchema
  .extend({ request_limit: z.number().int().nonnegative().nullable() })
  .strict();
export type AiAssistantUsageKindMetric = z.infer<typeof aiAssistantUsageKindMetricSchema>;

export const aiAssistantUsageSummarySchema = z
  .object({
    generated_at: z.string().datetime({ offset: true }),
    window_start_at: z.string().datetime({ offset: true }),
    timezone: z.string().trim().min(1).max(80),
    today: aiAssistantUsageMetricSchema,
    last_30_days: aiAssistantUsageMetricSchema,
    today_by_kind: z
      .object({
        order_text: aiAssistantUsageKindMetricSchema,
        inventory_vision: aiAssistantUsageKindMetricSchema,
      })
      .strict(),
    source: z.literal("repairdesk_usage_ledger"),
  })
  .strict();
export type AiAssistantUsageSummary = z.infer<typeof aiAssistantUsageSummarySchema>;

const aiOrderDateFieldSchema = z.enum(["created_at", "updated_at", "completed_at"]);
const aiOrderCalendarDateExpressionSchema = z.enum([
  "all_time",
  "today",
  "yesterday",
  "current_calendar_week",
  "previous_calendar_week",
  "current_calendar_month",
  "previous_calendar_month",
  "current_calendar_quarter",
  "previous_calendar_quarter",
  "current_calendar_year",
  "previous_calendar_year",
]);
const aiOrderCalendarDateFilterSchema = z
  .object({
    expression: aiOrderCalendarDateExpressionSchema,
    field: aiOrderDateFieldSchema,
  })
  .strict();
const aiOrderRollingDateFilterSchema = z
  .object({
    expression: z.literal("rolling_period"),
    field: aiOrderDateFieldSchema,
    amount: z.number().int().min(1).max(120),
    unit: z.enum(["day", "week", "month", "year"]),
  })
  .strict();
const calendarDateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const aiOrderAbsoluteDateFilterSchema = z
  .object({
    expression: z.literal("absolute_range"),
    field: aiOrderDateFieldSchema,
    from: calendarDateStringSchema.nullable(),
    to: calendarDateStringSchema.nullable(),
  })
  .strict();

export const aiOrderDateFilterSchema = z
  .discriminatedUnion("expression", [
    aiOrderCalendarDateFilterSchema,
    aiOrderRollingDateFilterSchema,
    aiOrderAbsoluteDateFilterSchema,
  ])
  .superRefine((value, context) => {
    if (value.expression !== "absolute_range") return;
    if (!value.from && !value.to) {
      context.addIssue({ code: "custom", path: ["from"], message: "日期范围不能为空" });
    }
    for (const [key, date] of [
      ["from", value.from],
      ["to", value.to],
    ] as const) {
      if (date && !isRealCalendarDate(date)) {
        context.addIssue({ code: "custom", path: [key], message: "日期无效" });
      }
    }
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({ code: "custom", path: ["to"], message: "结束日期不能早于开始日期" });
    }
  });
export type AiOrderDateFilter = z.infer<typeof aiOrderDateFilterSchema>;

function isRealCalendarDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return (
    year >= 1900 &&
    year <= 2199 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

export const aiOrderConstraintEvidenceFieldSchema = z.enum([
  "search",
  "device_search",
  "view",
  "paid",
  "overdue",
  "queue_group",
  "financial_review",
  "date_filter",
  "service_group",
  "completed_only",
  "parts_status",
]);
export type AiOrderConstraintEvidenceField = z.infer<typeof aiOrderConstraintEvidenceFieldSchema>;

export const aiOrderConstraintEvidenceSchema = z
  .object({
    field: aiOrderConstraintEvidenceFieldSchema,
    quote: z.string().trim().min(1).max(80),
  })
  .strict();
export type AiOrderConstraintEvidence = z.infer<typeof aiOrderConstraintEvidenceSchema>;

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
    date_filter: aiOrderDateFilterSchema.nullable(),
    service_group: z
      .enum([
        "display",
        "battery",
        "charging",
        "camera",
        "liquid",
        "mainboard",
        "system",
        "back-cover",
        "face",
        "speaker",
        "microphone",
        "button",
      ])
      .nullable(),
    completed_only: z.boolean(),
    parts_status: z.enum(["needed", "ordered", "arrived", "out_of_stock"]).nullable(),
    evidence: z.array(aiOrderConstraintEvidenceSchema).max(12).optional(),
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

export const aiOrderAppliedFilterSchema = z
  .object({
    key: z.string().trim().min(1).max(48),
    label: z.string().trim().min(1).max(80),
    value: z.string().trim().min(1).max(120),
    evidence: z.enum(["exact", "quoted", "order_level"]),
    source: z.enum(["user_explicit", "system_default", "server_derived"]),
  })
  .strict();
export type AiOrderAppliedFilter = z.infer<typeof aiOrderAppliedFilterSchema>;

export const aiOrderInterpretationStatusSchema = z.enum([
  "confirmed",
  "defaulted",
  "corrected",
  "needs_confirmation",
  "permission_limited",
]);
export type AiOrderInterpretationStatus = z.infer<typeof aiOrderInterpretationStatusSchema>;

export const aiOrderInlineActionKindSchema = z.enum(["mark_parts_ordered"]);
export type AiOrderInlineActionKind = z.infer<typeof aiOrderInlineActionKindSchema>;

export const aiOrderInlineActionCandidateSchema = z
  .object({
    action: aiOrderInlineActionKindSchema,
    label: z.string().trim().min(1).max(60),
    description: z.string().trim().min(1).max(240),
    requires_confirmation: z.literal(true),
  })
  .strict();
export type AiOrderInlineActionCandidate = z.infer<typeof aiOrderInlineActionCandidateSchema>;

export const aiOrderCardSchema = z
  .object({
    id: z.string().min(1),
    public_no: z.string().min(1),
    customer_hint: z.string(),
    device_label: z.string(),
    status: z.string(),
    status_label: z.string(),
    updated_at: z.string(),
    completed_at: z.string().nullable(),
    parts_status: z
      .enum(["not_required", "needed", "ordered", "arrived", "out_of_stock"])
      .nullable(),
    matched_reasons: z.array(z.string().trim().min(1).max(120)).max(8),
    allowed_actions: z.array(aiOrderInlineActionCandidateSchema).max(3),
    href: z.string().regex(/^\/orders(?:\/|\?)/),
  })
  .strict();
export type AiOrderCard = z.infer<typeof aiOrderCardSchema>;

export const aiOrderAssistantResponseSchema = z
  .object({
    request_id: z.string().uuid(),
    contract_version: z.literal(AI_ORDER_ASSISTANT_CONTRACT_VERSION),
    kind: z.enum(["search_results", "order_summary", "clarification"]),
    interpretation_status: aiOrderInterpretationStatusSchema,
    message: z.string(),
    applied_filters: z.array(aiOrderAppliedFilterSchema).max(12),
    cards: z.array(aiOrderCardSchema).max(20),
    total: z.number().int().nonnegative(),
    result_truncated: z.boolean(),
    page: z.number().int().min(1).max(500),
    page_size: z.number().int().min(1).max(20),
    has_more: z.boolean(),
    continuation_token: z.string().trim().min(32).max(2048).nullable(),
    generated_at: z.string().datetime({ offset: true }),
    source: z.literal("repairdesk"),
  })
  .strict();
export type AiOrderAssistantResponse = z.infer<typeof aiOrderAssistantResponseSchema>;

export const aiOrderInlineActionRequestSchema = z
  .object({
    order_id: z.string().trim().min(1).max(128),
    action: aiOrderInlineActionKindSchema,
    confirm_public_no: z.string().trim().min(1).max(80),
    expected_updated_at: z.string().datetime({ offset: true }),
    idempotency_key: z.string().uuid(),
  })
  .strict();
export type AiOrderInlineActionRequest = z.infer<typeof aiOrderInlineActionRequestSchema>;

export const aiOrderInlineActionResponseSchema = z
  .object({
    ok: z.literal(true),
    action: aiOrderInlineActionKindSchema,
    message: z.string().trim().min(1).max(240),
    card: aiOrderCardSchema,
  })
  .strict();
export type AiOrderInlineActionResponse = z.infer<typeof aiOrderInlineActionResponseSchema>;

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
    date_filter: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            expression: {
              type: "string",
              enum: [
                "all_time",
                "today",
                "yesterday",
                "current_calendar_week",
                "previous_calendar_week",
                "current_calendar_month",
                "previous_calendar_month",
                "current_calendar_quarter",
                "previous_calendar_quarter",
                "current_calendar_year",
                "previous_calendar_year",
              ],
            },
            field: {
              type: "string",
              enum: ["created_at", "updated_at", "completed_at"],
            },
          },
          required: ["expression", "field"],
        },
        {
          type: "object",
          additionalProperties: false,
          properties: {
            expression: { type: "string", const: "rolling_period" },
            field: {
              type: "string",
              enum: ["created_at", "updated_at", "completed_at"],
            },
            amount: { type: "integer", minimum: 1, maximum: 120 },
            unit: { type: "string", enum: ["day", "week", "month", "year"] },
          },
          required: ["expression", "field", "amount", "unit"],
        },
        {
          type: "object",
          additionalProperties: false,
          properties: {
            expression: { type: "string", const: "absolute_range" },
            field: {
              type: "string",
              enum: ["created_at", "updated_at", "completed_at"],
            },
            from: {
              type: ["string", "null"],
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            },
            to: {
              type: ["string", "null"],
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            },
          },
          required: ["expression", "field", "from", "to"],
        },
        { type: "null" },
      ],
      description:
        "Use a symbolic calendar expression, a rolling period, or an explicit local calendar range. The trusted server validates it against the user's text and resolves it in the store timezone; never calculate UTC timestamps. Never replace an unsupported period with a different one.",
    },
    service_group: {
      type: ["string", "null"],
      enum: [
        "display",
        "battery",
        "charging",
        "camera",
        "liquid",
        "mainboard",
        "system",
        "back-cover",
        "face",
        "speaker",
        "microphone",
        "button",
        null,
      ],
      description:
        "Matches a recorded quote/service catalog group only. It is not proof that the physical repair was performed.",
    },
    completed_only: {
      type: "boolean",
      description:
        "True only when the user explicitly asks for completed, repaired-finished, or historical performed work. This combines completion evidence with any quoted service-group evidence.",
    },
    parts_status: {
      type: ["string", "null"],
      enum: ["needed", "ordered", "arrived", "out_of_stock", null],
      description:
        "Current order-level parts marker. needed means the stored marker only; it does not imply a supplier purchase order exists.",
    },
    evidence: {
      type: "array",
      maxItems: 12,
      description:
        "For every non-default constraint, include the shortest exact quote from the user message that supports that field. The server independently validates each quote before execution.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          field: {
            type: "string",
            enum: [
              "search",
              "device_search",
              "view",
              "paid",
              "overdue",
              "queue_group",
              "financial_review",
              "date_filter",
              "service_group",
              "completed_only",
              "parts_status",
            ],
          },
          quote: { type: "string", minLength: 1, maxLength: 80 },
        },
        required: ["field", "quote"],
      },
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
    "date_filter",
    "service_group",
    "completed_only",
    "parts_status",
    "evidence",
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
