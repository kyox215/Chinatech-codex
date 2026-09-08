import { z } from "zod";
import type { StoreOutputIdentity } from "@/entities/store/model/store-output-identity";

const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
const cents = z.number().int().min(0).max(10_000_000_000);
const version = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const inventorySalesLanguageSchema = z.enum(["it", "en", "zh"]);
export const inventorySalesPaymentSchema = z
  .object({
    amount_cents: cents.refine((value) => value > 0, "收款必须大于零"),
    method: z.enum(["cash", "card", "bancomat", "transfer", "other"]),
    occurred_at: timestamp,
    note: z.string().trim().max(500).optional(),
  })
  .strict();
const concurrency = {
  inventory_item_id: uuid,
  stock_unit_id: uuid,
  expected_item_updated_at: timestamp,
  expected_unit_version: version,
};
const delivery = { deliver: z.boolean().default(false), delivered_at: timestamp.optional() };
export const inventorySalesCommandBodySchema = z
  .discriminatedUnion("command", [
    z
      .object({
        command: z.literal("sale.create"),
        idempotency_key: uuid,
        payload: z
          .object({
            ...concurrency,
            ...delivery,
            customer_id: uuid,
            price_cents: cents.refine((value) => value > 0, "售价必须大于零"),
            agreed_at: timestamp,
            payment: inventorySalesPaymentSchema,
            warranty_months: z.union([z.literal(12), z.literal(24)]).default(24),
            used_device: z.boolean(),
            shortening_agreed: z.boolean().default(false),
            shortening_agreed_at: timestamp.optional(),
            terms_version: z.literal("inventory-sales-2026-09-v1"),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        command: z.literal("payment.append"),
        idempotency_key: uuid,
        payload: z
          .object({
            ...concurrency,
            ...delivery,
            sale_order_id: uuid,
            expected_order_version: version,
            payment: inventorySalesPaymentSchema,
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        command: z.literal("pickup.confirm"),
        idempotency_key: uuid,
        payload: z
          .object({
            ...concurrency,
            sale_order_id: uuid,
            expected_order_version: version,
            delivered_at: timestamp,
          })
          .strict(),
      })
      .strict(),
  ])
  .superRefine((input, context) => {
    const payload = input.payload;
    if ("deliver" in payload && payload.deliver !== Boolean(payload.delivered_at)) {
      context.addIssue({
        code: "custom",
        path: ["payload", "delivered_at"],
        message: "交付操作必须提供实际交付时间",
      });
    }
    if (input.command === "sale.create") {
      const create = input.payload;
      if (
        create.warranty_months === 12 &&
        (!create.used_device || !create.shortening_agreed || !create.shortening_agreed_at)
      ) {
        context.addIssue({
          code: "custom",
          path: ["payload", "warranty_months"],
          message: "二手12个月保修须记录客户明确同意",
        });
      }
      if (create.payment && create.payment.amount_cents > create.price_cents) {
        context.addIssue({ code: "custom", path: ["payload", "payment"], message: "不能超收" });
      }
      if (create.deliver && create.payment?.amount_cents !== create.price_cents) {
        context.addIssue({
          code: "custom",
          path: ["payload", "deliver"],
          message: "余款未结清，不能交付",
        });
      }
    }
  });

export const inventorySalesIdBodySchema = z.object({ id: uuid }).strict();
export const inventorySalesListBodySchema = z
  .object({
    queue: z
      .enum(["all", "available", "awaiting_payment", "paid_pending_pickup", "delivered"])
      .default("all"),
    search: z.string().trim().max(100).default(""),
    offset: z.number().int().min(0).max(100000).default(0),
    limit: z.number().int().min(1).max(100).default(30),
    categories: z
      .array(z.enum(["phone", "tablet", "computer", "game_console", "other"]))
      .max(5)
      .optional(),
    statuses: z
      .array(z.enum(["in_stock", "reserved", "sold", "removed", "returned"]))
      .max(5)
      .optional(),
    brands: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    locations: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  })
  .strict();
export type InventorySalesListInput = z.infer<typeof inventorySalesListBodySchema>;
export const inventorySalesReceiptBodySchema = z
  .object({
    id: uuid,
    kind: z.enum(["sale", "payment", "warranty"]),
    payment_id: uuid.optional(),
    language: inventorySalesLanguageSchema.optional(),
  })
  .strict()
  .refine(
    (value) => (value.kind === "payment") === Boolean(value.payment_id),
    "收款凭证必须指定本笔ID",
  );

export type InventorySalesCommandBody = z.infer<typeof inventorySalesCommandBodySchema>;
export type InventorySalesCommand = InventorySalesCommandBody["command"];
export type InventorySalesReceiptInput = z.infer<typeof inventorySalesReceiptBodySchema>;
export type InventorySalesLanguage = z.infer<typeof inventorySalesLanguageSchema>;
export type InventorySalesPayment = z.infer<typeof inventorySalesPaymentSchema> & {
  id: string;
  sequence: number;
  receipt_number: string;
  paid_after_cents: number;
  balance_after_cents: number;
  recorded_at: string;
};
export interface InventorySalesCommandResult {
  ok: true;
  code: "completed" | "idempotent_replay";
  sale_order_id: string;
  inventory_item_id: string;
  stock_unit_id: string;
  payment_id?: string;
  item_updated_at: string;
  unit_version: number;
  order_version: number;
  paid_cents: number;
  balance_cents: number;
  status: "awaiting_payment" | "paid_pending_pickup" | "delivered";
}
export interface InventorySalesOrder {
  id: string;
  sale_number: string;
  inventory_item_id: string;
  stock_unit_id: string;
  customer_id: string;
  price_cents: number;
  paid_cents: number;
  balance_cents: number;
  status: InventorySalesCommandResult["status"];
  version: number;
  agreed_at: string;
  recorded_at: string;
  delivered_at: string | null;
  warranty_months: 12 | 24;
  used_device: boolean;
  shortening_agreed: boolean;
  shortening_agreed_at: string | null;
  terms_version: string;
}
export interface InventorySalesSummary {
  inventory_item_id: string;
  stock_unit_id: string | null;
  item_updated_at: string;
  unit_version: number | null;
  item_status: string;
  inspection_missing: string[];
  inspection_href: string;
  inspection: {
    imei_check_status: string;
    activation_lock_status: string;
    data_wipe_status: string;
    functional_grade: string;
    cosmetic_grade: string;
    list_price_cents: number | null;
  };
  capabilities: InventorySalesCapabilities;
  allowed_actions: InventorySalesCommand[];
  order: InventorySalesOrder | null;
}
export interface InventorySalesDetail extends InventorySalesSummary {
  customer: { name: string; phone: string } | null;
  payments: InventorySalesPayment[];
  warranty: { starts_at: string; starts_on: string; ends_on: string; months: 12 | 24 } | null;
}
export interface InventorySalesReceiptDocument {
  kind: InventorySalesReceiptInput["kind"];
  language: InventorySalesLanguage;
  payment_id?: string;
  order: InventorySalesOrder;
  payments: InventorySalesPayment[];
  warranty: InventorySalesDetail["warranty"];
  customer: { name: string; phone: string };
  product: InventorySalesProductSummary;
  store: { name: string; address: string; phone: string; email: string; footer: string };
}
export interface InventorySalesReceipt {
  store_id: string;
  kind: InventorySalesReceiptInput["kind"];
  language: InventorySalesLanguage;
  output_identity: StoreOutputIdentity;
  document: InventorySalesReceiptDocument | null;
}
export interface InventorySalesProductSummary {
  name: string;
  sku: string;
  identifier: string;
  identifier_label: "IMEI" | "SN";
  category: string;
  storage: string | null;
  ram: string | null;
  color: string | null;
}
export interface InventorySalesCapabilities {
  ui_enabled: boolean;
  commands_enabled: boolean;
  can_reserve: boolean;
  can_collect: boolean;
  can_collect_and_deliver: boolean;
  can_deliver: boolean;
  can_inspect: boolean;
  can_prepare_for_sale: boolean;
  inspection_block_reason:
    | "workflow_disabled"
    | "permission_denied"
    | "stock_unit_required"
    | "sale_in_progress"
    | null;
  prepare_block_reason:
    | "workflow_disabled"
    | "permission_denied"
    | "stock_unit_required"
    | "sale_in_progress"
    | null;
  inspection_command_path: "inventory/v2/workflow/apply";
  print_kinds: InventorySalesReceiptInput["kind"][];
}
export interface InventorySalesList {
  facets?: { brands: string[]; locations: string[] };
  rows: (InventorySalesSummary & {
    product: InventorySalesProductSummary;
    customer: { name: string; phone: string } | null;
  })[];
  counts: {
    all: number;
    available: number;
    awaiting_payment: number;
    paid_pending_pickup: number;
    delivered: number;
  };
  total: number;
  offset: number;
  limit: number;
  capabilities: InventorySalesCapabilities;
}
