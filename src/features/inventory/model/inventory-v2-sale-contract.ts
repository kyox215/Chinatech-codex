import { z } from "zod";

import type {
  CompleteInventorySaleV2Input,
  InventoryV2WarrantySnapshot,
} from "@/lib/repairdesk/types";

const centAmount = z
  .number()
  .finite()
  .positive("金额必须大于 0")
  .max(9_999_999.99, "金额超出允许范围")
  .refine((value) => Number.isInteger(value * 100), "金额最多保留两位小数");

export const inventoryV2WarrantySnapshotSchema = z
  .object({
    version: z.string().trim().min(1).max(64),
    language: z.enum(["it", "zh", "en"]),
    terms: z.array(z.string().trim().min(1).max(500)).min(1).max(24),
    disclosed_defects: z.array(z.string().trim().min(1).max(500)).max(24).optional(),
  })
  .strict() satisfies z.ZodType<InventoryV2WarrantySnapshot>;

export const completeInventorySaleV2InputSchema = z
  .object({
    expected_updated_at: z.string().datetime({ offset: true }),
    idempotency_key: z.string().uuid(),
    buyer_customer_id: z.string().trim().min(1).max(128).optional(),
    sale_price: centAmount,
    payment_amount: centAmount,
    payment_method: z.string().trim().min(1).max(64),
    sale_channel: z.string().trim().min(1).max(64),
    warranty_months: z.number().int().min(0).max(120),
    warranty_snapshot: inventoryV2WarrantySnapshotSchema,
    fiscal_status: z.enum(["not_required", "pending", "recorded"]),
    fiscal_reference: z.string().trim().min(1).max(128).optional(),
    sold_at: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.sale_price !== input.payment_amount) {
      ctx.addIssue({
        code: "custom",
        path: ["payment_amount"],
        message: "首版原子成交只支持一次全额收款",
      });
    }
    if (input.fiscal_status === "recorded" && !input.fiscal_reference) {
      ctx.addIssue({
        code: "custom",
        path: ["fiscal_reference"],
        message: "已登记财政凭证时必须填写外部凭证引用",
      });
    }
  }) satisfies z.ZodType<CompleteInventorySaleV2Input>;

export const completeInventorySaleV2BodySchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    input: completeInventorySaleV2InputSchema,
  })
  .strict();
