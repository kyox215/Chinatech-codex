import { z } from "zod";

/**
 * Server-owned inventory lifecycle commands. The browser submits only a
 * command payload and idempotency key; store/actor identity is injected from
 * the authenticated request context in the BFF.
 */
export const inventoryLifecycleCommandNames = [
  "acquisition.save",
  "inspection.save",
  "reservation.create",
  "payment.append",
  "sale.complete",
  "pickup.confirm",
  "reservation.cancel",
  "warranty.adjust",
  "after_sales.create",
  "after_sales.update",
  "after_sales.close",
] as const;

export type InventoryLifecycleCommand = (typeof inventoryLifecycleCommandNames)[number];

export const inventoryLifecycleCommandSchema = z.enum(inventoryLifecycleCommandNames);

const lifecycleUuid = z.string().uuid();
const lifecycleDate = z.string().datetime({ offset: true });
const lifecycleText = (max: number, min = 1) => z.string().trim().min(min).max(max);
const lifecycleUnitVersion = z.number().int().min(1);
const lifecycleOrderVersion = z.number().int().min(1);
const lifecycleCaseVersion = z.number().int().min(1);
const lifecycleWarrantyVersion = z.number().int().min(0);
const lifecycleMoneyNumber = z
  .number()
  .finite()
  .min(0)
  .max(100_000_000)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, "金额最多两位小数");
const lifecycleMoneyString = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/, "金额格式不正确")
  .transform(Number)
  .pipe(lifecycleMoneyNumber);
const lifecycleMoney = z.union([lifecycleMoneyNumber, lifecycleMoneyString]);
const lifecyclePositiveMoney = lifecycleMoney.refine((value) => value >= 0.01, "金额必须大于零");
const lifecyclePaymentMethod = z.enum(["cash", "card", "bancomat", "transfer", "other"]);
const lifecycleInspectionStatus = z.enum(["not_tested", "normal", "abnormal", "not_applicable"]);
const lifecycleCoverageDecision = z.enum(["pending", "covered", "not_covered"]);
const lifecycleScalar = z.union([z.string().max(256), z.number().finite(), z.boolean(), z.null()]);
const lifecycleChecks = z
  .record(z.string().trim().min(1).max(64), lifecycleScalar)
  .superRefine((value, context) => {
    if (Object.keys(value).length > 32) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "检查项不能超过 32 个" });
    }
  });

const lifecyclePayloadSchemas = {
  "acquisition.save": z
    .object({
      stock_unit_id: lifecycleUuid,
      expected_unit_version: lifecycleUnitVersion,
      source_type: lifecycleText(64).optional(),
      source_party: lifecycleText(160).optional(),
      acquired_at: lifecycleDate.optional(),
      condition_at_acquisition: lifecycleText(64).optional(),
      cost_amount: lifecycleMoney.optional(),
      payment_method: lifecyclePaymentMethod.optional(),
      reference: lifecycleText(128).optional(),
      notes: lifecycleText(2_000).optional(),
    })
    .strict(),
  "inspection.save": z
    .object({
      stock_unit_id: lifecycleUuid,
      expected_unit_version: lifecycleUnitVersion,
      device_kind: z.enum(["phone", "tablet", "game_console", "computer", "other"]).optional(),
      battery_health: z.number().int().min(0).max(100).nullable().optional(),
      face_id_status: lifecycleInspectionStatus.optional(),
      touch_id_status: lifecycleInspectionStatus.optional(),
      true_tone_status: lifecycleInspectionStatus.optional(),
      activation_lock_status: lifecycleInspectionStatus.optional(),
      data_wipe_status: lifecycleInspectionStatus.optional(),
      imei_status: lifecycleInspectionStatus.optional(),
      checks: lifecycleChecks.optional(),
      notes: lifecycleText(2_000).optional(),
      inspected_at: lifecycleDate.optional(),
    })
    .strict(),
  "reservation.create": z
    .object({
      stock_unit_id: lifecycleUuid,
      expected_unit_version: lifecycleUnitVersion,
      agreed_price: lifecycleMoney,
      customer_id: lifecycleUuid,
      deposit_amount: lifecycleMoney.optional(),
      no_deposit_reason: lifecycleText(500).optional(),
      payment_method: lifecyclePaymentMethod.optional(),
      payment_note: lifecycleText(500).optional(),
      expires_at: lifecycleDate.optional(),
      expected_pickup_at: lifecycleDate.optional(),
    })
    .strict(),
  "payment.append": z
    .object({
      sale_order_id: lifecycleUuid,
      expected_order_version: lifecycleOrderVersion,
      kind: z.enum(["deposit", "balance", "payment", "refund", "reversal"]),
      amount: lifecyclePositiveMoney,
      method: lifecyclePaymentMethod,
      occurred_at: lifecycleDate.optional(),
      reference_last4: z.string().trim().max(4).optional(),
      reversal_of: lifecycleUuid.nullable().optional(),
      note: lifecycleText(500).optional(),
    })
    .strict(),
  "sale.complete": z
    .object({
      sale_order_id: lifecycleUuid,
      expected_order_version: lifecycleOrderVersion,
      expected_unit_version: lifecycleUnitVersion,
      payment_amount: lifecycleMoney.optional(),
      payment_method: lifecyclePaymentMethod.optional(),
      payment_note: lifecycleText(500).optional(),
      sold_at: lifecycleDate.optional(),
    })
    .strict(),
  "pickup.confirm": z
    .object({
      sale_order_id: lifecycleUuid,
      expected_order_version: lifecycleOrderVersion,
      actual_pickup_at: lifecycleDate.optional(),
      warranty_months: z.number().int().min(0).max(120).optional(),
      override_reason: lifecycleText(500).optional(),
    })
    .strict(),
  "reservation.cancel": z
    .object({
      sale_order_id: lifecycleUuid,
      expected_order_version: lifecycleOrderVersion,
      expected_unit_version: lifecycleUnitVersion,
      disposition: z.enum(["refund_pending", "retain", "pending"]),
      reason: lifecycleText(500),
    })
    .strict(),
  "warranty.adjust": z
    .object({
      sale_order_id: lifecycleUuid,
      expected_order_version: lifecycleOrderVersion,
      expected_warranty_version: lifecycleWarrantyVersion,
      months: z.number().int().min(0).max(120),
      starts_at: lifecycleDate.optional(),
      reason: lifecycleText(500),
    })
    .strict(),
  "after_sales.create": z
    .object({
      sale_order_id: lifecycleUuid,
      expected_order_version: lifecycleOrderVersion,
      issue_summary: lifecycleText(2_000),
      coverage_decision: lifecycleCoverageDecision.optional(),
      received_at: lifecycleDate.optional(),
    })
    .strict(),
  "after_sales.update": z
    .object({
      case_id: lifecycleUuid,
      expected_case_version: lifecycleCaseVersion,
      status: z.enum(["open", "in_progress", "waiting_customer", "returned", "closed"]),
      diagnosis: lifecycleText(2_000).optional(),
      coverage_decision: lifecycleCoverageDecision.optional(),
      returned_at: lifecycleDate.optional(),
    })
    .strict(),
  "after_sales.close": z
    .object({
      case_id: lifecycleUuid,
      expected_case_version: lifecycleCaseVersion,
      status: z.literal("closed"),
      diagnosis: lifecycleText(2_000).optional(),
      coverage_decision: lifecycleCoverageDecision.optional(),
    })
    .strict(),
} as const;

function lifecycleCommandBody<Command extends InventoryLifecycleCommand>(
  command: Command,
  payload: (typeof lifecyclePayloadSchemas)[Command],
) {
  return z
    .object({
      command: z.literal(command),
      idempotency_key: lifecycleUuid,
      payload,
    })
    .strict();
}

export const inventoryLifecycleCommandBodySchema = z.discriminatedUnion("command", [
  lifecycleCommandBody("acquisition.save", lifecyclePayloadSchemas["acquisition.save"]),
  lifecycleCommandBody("inspection.save", lifecyclePayloadSchemas["inspection.save"]),
  lifecycleCommandBody("reservation.create", lifecyclePayloadSchemas["reservation.create"]),
  lifecycleCommandBody("payment.append", lifecyclePayloadSchemas["payment.append"]),
  lifecycleCommandBody("sale.complete", lifecyclePayloadSchemas["sale.complete"]),
  lifecycleCommandBody("pickup.confirm", lifecyclePayloadSchemas["pickup.confirm"]),
  lifecycleCommandBody("reservation.cancel", lifecyclePayloadSchemas["reservation.cancel"]),
  lifecycleCommandBody("warranty.adjust", lifecyclePayloadSchemas["warranty.adjust"]),
  lifecycleCommandBody("after_sales.create", lifecyclePayloadSchemas["after_sales.create"]),
  lifecycleCommandBody("after_sales.update", lifecyclePayloadSchemas["after_sales.update"]),
  lifecycleCommandBody("after_sales.close", lifecyclePayloadSchemas["after_sales.close"]),
]);

export type InventoryLifecycleCommandBody = z.infer<typeof inventoryLifecycleCommandBodySchema>;

export interface InventoryLifecycleCommandResult {
  ok: boolean;
  code: string;
  sale_order_id?: string;
  stock_unit_id?: string;
  case_id?: string;
  payment_id?: string;
  inventory_item_id?: string;
  balance?: number;
  expires_at?: string;
  actual_pickup_at?: string;
  sold_at?: string;
  starts_at?: string;
  ends_at?: string;
  version_no?: number;
  version?: number;
  order_version?: number;
  unit_version?: number;
  case_version?: number;
  warranty_version?: number;
  status?: string;
}

export type InventoryLifecycleInspectionStatus =
  | "not_tested"
  | "normal"
  | "abnormal"
  | "not_applicable";

export type InventoryLifecyclePaymentKind =
  | "deposit"
  | "balance"
  | "payment"
  | "refund"
  | "reversal";

export type InventoryLifecyclePaymentMethod = "cash" | "card" | "bancomat" | "transfer" | "other";

export type InventoryLifecycleWarrantyBasis = "legal" | "commercial";

export interface InventoryLifecycleInspectionSummary {
  battery_health: number | null;
  face_id_status: InventoryLifecycleInspectionStatus;
  touch_id_status: InventoryLifecycleInspectionStatus;
  true_tone_status: InventoryLifecycleInspectionStatus;
  activation_lock_status: InventoryLifecycleInspectionStatus;
  data_wipe_status: InventoryLifecycleInspectionStatus;
  imei_status: InventoryLifecycleInspectionStatus;
  inspected_at: string;
}

export interface InventoryLifecycleWarrantySummary {
  version_no: number;
  basis: InventoryLifecycleWarrantyBasis;
  months: number;
  starts_at?: string;
  ends_at?: string;
}

export interface InventoryLifecycleAfterSalesSummary {
  case_id: string;
  sale_order_id: string;
  inventory_item_id: string;
  status: InventoryAfterSalesStatus;
  coverage_decision?: InventoryLifecycleCoverageDecision;
  received_at: string;
  version: number;
}

export type InventoryLifecycleCoverageDecision = z.infer<typeof lifecycleCoverageDecision>;

export type InventoryAfterSalesStatus =
  | "open"
  | "in_progress"
  | "waiting_customer"
  | "returned"
  | "closed";

export interface InventoryLifecycleListSummary {
  item_id: string;
  stock_unit_id: string;
  sku: string;
  business_status:
    | "in_stock"
    | "reserved"
    | "sold_pending_pickup"
    | "delivered"
    | "after_sales"
    | "removed";
  reservation_expires_at?: string;
  expected_pickup_at?: string;
  actual_pickup_at?: string;
  warranty_ends_at?: string;
  unit_version?: number;
  order_version?: number;
  case_version?: number;
  warranty_version?: number;
  after_sales_status?: InventoryAfterSalesStatus;
  sale_order_id?: string;
  status?: "reserved" | "sold" | "cancelled";
  agreed_price?: number;
  signed_paid_amount?: number;
  balance?: number;
  reserved_at?: string;
  sold_at?: string;
  allowed_actions: InventoryLifecycleCommand[];
  inspection?: InventoryLifecycleInspectionSummary;
  commercial_warranty?: InventoryLifecycleWarrantySummary;
  after_sales?: InventoryLifecycleAfterSalesSummary;
}

export interface InventoryLifecycleSaleDetail extends InventoryLifecycleListSummary {
  sale_order_id: string;
  inventory_item_id: string;
  stock_unit_id: string;
  status: "reserved" | "sold" | "cancelled";
  agreed_price: number;
  signed_paid_amount: number;
  balance: number;
  payments: Array<{
    kind: InventoryLifecyclePaymentKind;
    amount: number;
    method: InventoryLifecyclePaymentMethod;
    occurred_at: string;
  }>;
}

export interface InventoryLifecycleAfterSalesQueueItem {
  case_id: string;
  sale_order_id: string;
  inventory_item_id: string;
  stock_unit_id: string;
  sku: string;
  status: InventoryAfterSalesStatus;
  issue_summary: string;
  coverage_decision?: InventoryLifecycleCoverageDecision;
  received_at: string;
  returned_at?: string;
  version: number;
  order_version: number;
  allowed_actions: InventoryLifecycleCommand[];
}

export interface InventoryLifecycleAfterSalesCaseDetail extends InventoryLifecycleAfterSalesQueueItem {
  diagnosis?: string;
  closed_at?: string;
  sale?: InventoryLifecycleSaleDetail;
  events: Array<{
    event_type: string;
    from_status?: string;
    to_status?: string;
    occurred_at: string;
  }>;
}

export function inventoryLifecycleCommandRequiresManager(
  command: InventoryLifecycleCommand,
): boolean {
  return ["reservation.cancel", "warranty.adjust"].includes(command);
}

export function inventoryLifecycleCommandRequiresPickupOverrideReason(
  command: InventoryLifecycleCommand,
  payload: Record<string, unknown>,
): boolean {
  return command === "pickup.confirm" && Number(payload.balance ?? 0) > 0;
}
