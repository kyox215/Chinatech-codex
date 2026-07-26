import { z } from "zod";

import type {
  ApplyInventoryWorkflowV2Input,
  InventoryV2CommercialPatch,
} from "@/lib/repairdesk/types";

const centAmount = z
  .number()
  .finite()
  .min(0)
  .max(9_999_999.99)
  .refine((value) => Number.isInteger(value * 100), "金额最多保留两位小数");

const checkStatus = z.enum(["unchecked", "pass", "fail", "unknown"]);
const inspectionSchema = z
  .object({
    screen_status: checkStatus.optional(),
    touch_status: checkStatus.optional(),
    camera_status: checkStatus.optional(),
    buttons_status: checkStatus.optional(),
    ports_status: checkStatus.optional(),
    speaker_status: checkStatus.optional(),
    microphone_status: checkStatus.optional(),
    wifi_status: checkStatus.optional(),
    bluetooth_status: checkStatus.optional(),
    cellular_status: checkStatus.optional(),
    battery_health: z.number().finite().min(0).max(100).optional(),
    cosmetic_grade: z
      .enum(["unknown", "new", "mint", "good", "fair", "poor", "for_parts"])
      .optional(),
    functional_grade: z
      .enum(["untested", "passed", "needs_repair", "failed", "for_parts"])
      .optional(),
    imei_check_status: checkStatus.optional(),
    activation_lock_status: checkStatus.optional(),
    data_wipe_status: checkStatus.optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const inventoryV2CommercialPatchSchema = z
  .object({
    cost_amount: centAmount.optional(),
    list_price: centAmount.optional(),
    repair_cost_amount: centAmount.optional(),
    fees_amount: centAmount.optional(),
    warranty_months: z.number().int().min(0).max(120).optional(),
    location: z.string().trim().max(200).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict() satisfies z.ZodType<InventoryV2CommercialPatch>;

export const applyInventoryWorkflowV2InputSchema = z
  .object({
    expected_updated_at: z.string().datetime({ offset: true }),
    idempotency_key: z.string().uuid(),
    operation: z.enum(["inspect", "transition", "update_commercials"]),
    target_status: z
      .enum(["intake", "evaluating", "refurbishing", "ready_for_sale", "listed"])
      .optional(),
    inspection: inspectionSchema.optional(),
    commercial_patch: inventoryV2CommercialPatchSchema.optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.operation === "inspect" && !input.inspection) {
      ctx.addIssue({ code: "custom", path: ["inspection"], message: "检测操作必须包含检测结果" });
    }
    if (input.operation === "transition" && !input.target_status) {
      ctx.addIssue({
        code: "custom",
        path: ["target_status"],
        message: "状态推进必须选择目标状态",
      });
    }
    if (
      input.operation === "transition" &&
      (input.inspection !== undefined || input.commercial_patch !== undefined)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["operation"],
        message: "状态推进不能同时修改检测或商业资料",
      });
    }
    if (input.operation === "update_commercials" && input.target_status !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["target_status"],
        message: "商业资料更新不能同时推进状态",
      });
    }
    if (input.operation === "update_commercials" && !input.commercial_patch) {
      ctx.addIssue({ code: "custom", path: ["commercial_patch"], message: "商业资料更新不能为空" });
    }
  }) satisfies z.ZodType<ApplyInventoryWorkflowV2Input>;

export const applyInventoryWorkflowV2BodySchema = z
  .object({
    id: z.string().uuid(),
    input: applyInventoryWorkflowV2InputSchema,
  })
  .strict();
