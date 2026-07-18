import { z } from "zod";

import type { CreateInventoryUnitV2Input } from "@/lib/repairdesk/types";

const optionalShortText = z.string().trim().min(1).max(160).optional();
const money = z
  .number()
  .finite()
  .min(0)
  .max(9_999_999.99)
  .refine((value) => Number.isInteger(value * 100), "金额最多保留两位小数");

export function normalizeInventoryV2Identifier(value: string) {
  return value
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

export function isValidInventoryV2Imei(value: string) {
  const normalized = normalizeInventoryV2Identifier(value);
  if (!/^\d{15}$/.test(normalized)) return false;
  const sum = [...normalized].reduce((total, character, index) => {
    let digit = Number(character);
    if ((index + 1) % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    return total + digit;
  }, 0);
  return sum % 10 === 0;
}

const identifierSchema = z
  .object({
    kind: z.enum(["imei1", "imei2", "serial", "eid", "ean", "sku"]),
    value: z.string().trim().min(3).max(128),
    slot: z.number().int().min(1).max(8).optional(),
    source: z.enum(["manual", "scan", "ai_confirmed"]),
    primary: z.boolean(),
  })
  .strict()
  .superRefine((identifier, ctx) => {
    if (["imei1", "imei2"].includes(identifier.kind) && !isValidInventoryV2Imei(identifier.value)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "IMEI 校验未通过" });
    }
  });

export const createInventoryUnitV2InputSchema = z
  .object({
    idempotency_key: z.string().uuid(),
    source_type: z.enum(["supplier_purchase", "repair_resale", "manual_stock"]),
    customer_id: z.string().trim().min(1).max(128).optional(),
    supplier_id: z.string().trim().min(1).max(128).optional(),
    category: z.string().trim().min(1).max(64),
    brand: z.string().trim().min(1).max(120),
    model: z.string().trim().min(1).max(160),
    ram_capacity: optionalShortText,
    storage_capacity: optionalShortText,
    color: optionalShortText,
    identifiers: z.array(identifierSchema).min(1).max(8),
    cost_amount: money,
    list_price: money,
    warranty_months: z.number().int().min(0).max(120),
    location: z.string().trim().min(1).max(120).optional(),
    notes: z.string().trim().min(1).max(2_000).optional(),
    standardization_status: z.enum(["standard", "unstandardized", "needs_review"]),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.identifiers.filter((identifier) => identifier.primary).length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["identifiers"],
        message: "必须选择一个主要 IMEI 或序列号",
      });
    }
    const primaryIdentifier = input.identifiers.find((identifier) => identifier.primary);
    if (primaryIdentifier && !["imei1", "imei2", "serial"].includes(primaryIdentifier.kind)) {
      ctx.addIssue({
        code: "custom",
        path: ["identifiers"],
        message: "主要标识必须是 IMEI 或序列号",
      });
    }
    const normalized = input.identifiers.map((identifier) =>
      normalizeInventoryV2Identifier(identifier.value),
    );
    if (new Set(normalized).size !== normalized.length) {
      ctx.addIssue({ code: "custom", path: ["identifiers"], message: "标识符不能重复" });
    }
    if (input.source_type === "supplier_purchase" && !input.supplier_id) {
      ctx.addIssue({ code: "custom", path: ["supplier_id"], message: "请选择供应商" });
    }
    if (input.source_type === "supplier_purchase" && input.customer_id) {
      ctx.addIssue({
        code: "custom",
        path: ["customer_id"],
        message: "供应商采购不能关联客户来源",
      });
    }
    if (input.source_type === "repair_resale" && !input.customer_id) {
      ctx.addIssue({ code: "custom", path: ["customer_id"], message: "请选择关联客户" });
    }
    if (input.source_type === "repair_resale" && input.supplier_id) {
      ctx.addIssue({
        code: "custom",
        path: ["supplier_id"],
        message: "维修转售不能关联供应商来源",
      });
    }
    if (input.source_type === "manual_stock") {
      if (input.customer_id || input.supplier_id) {
        ctx.addIssue({
          code: "custom",
          path: ["source_type"],
          message: "其他入库不能保留旧的客户或供应商来源",
        });
      }
      if (!input.notes) {
        ctx.addIssue({ code: "custom", path: ["notes"], message: "其他入库必须填写来源说明" });
      }
    }
  }) satisfies z.ZodType<CreateInventoryUnitV2Input>;

export const createInventoryUnitV2BodySchema = z
  .object({ input: createInventoryUnitV2InputSchema })
  .strict();
