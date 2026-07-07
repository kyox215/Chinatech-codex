import { createHmac } from "node:crypto";

import { z } from "zod";

import type { AuditActor } from "@/lib/repairdesk/types";
import { assertPermission } from "@/server/permissions";
import type { PermissionAction, PermissionContext } from "@/server/permissions";

export const repairDeskOfflineOperationTypes = ["order_create", "order_update"] as const;
export type RepairDeskOfflineOperationType = (typeof repairDeskOfflineOperationTypes)[number];

export const repairDeskOfflineOperationStatuses = [
  "started",
  "succeeded",
  "conflict",
  "blocked",
  "failed",
] as const;
export type RepairDeskOfflineOperationStatus = (typeof repairDeskOfflineOperationStatuses)[number];

export const repairDeskOfflineServerResultCodes = [
  "synced",
  "idempotent_replay",
  "idempotency_conflict",
  "stale_version",
  "needs_review",
  "blocked_operation",
  "unauthorized",
  "forbidden",
  "retryable_error",
] as const;
export type RepairDeskOfflineServerResultCode = (typeof repairDeskOfflineServerResultCodes)[number];

export type RepairDeskOfflineHandlerResult =
  | { status: "synced"; serverOrderId?: string }
  | { status: "conflict" }
  | { status: "blocked" }
  | { status: "retryable_error" };

export type RepairDeskOfflineStoredOperation = {
  requestHash: string;
  status: RepairDeskOfflineOperationStatus;
  resultCode?: RepairDeskOfflineServerResultCode;
  responseSummary?: RepairDeskOfflineOperationResponseSummary;
  updatedAt?: string;
};

export type RepairDeskOfflineReplayDecision =
  | { decision: "start" }
  | {
      decision: "replay";
      resultCode: RepairDeskOfflineServerResultCode;
      responseSummary?: RepairDeskOfflineOperationResponseSummary;
    }
  | { decision: "conflict"; resultCode: "idempotency_conflict" }
  | { decision: "blocked"; resultCode: RepairDeskOfflineServerResultCode }
  | { decision: "retryable_error"; resultCode: "retryable_error" }
  | { decision: "recover_stale_started"; resultCode: "retryable_error" };

export type RepairDeskOfflineOperationResponseSummary = {
  serverOrderId?: string;
  publicNo?: string;
  updatedAt?: string;
  resultCode?: RepairDeskOfflineServerResultCode;
};

const text = z.string().trim().min(1).max(512);
const optionalText = z.string().trim().max(512).optional();
const idText = z.string().trim().min(1).max(160);
const isoText = z.string().trim().min(1).max(80);
const moneyAmount = z.coerce.number().finite().min(0).max(999_999);

export const repairDeskOfflineOperationIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9:_-]+$/, "Offline operation id contains unsupported characters.");

const customerSnapshotSchema = z
  .object({
    name: text.max(160),
    phoneRaw: text.max(80),
    phoneE164: optionalText,
    email: z.string().trim().email().max(240).optional(),
    language: z.enum(["it", "zh", "en"]).optional(),
  })
  .strict();

const customerRelationshipPlanSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("existing_customer"),
      customerId: idText,
      customerUpdatedAt: isoText.optional(),
    })
    .strict(),
  z
    .object({
      mode: z.literal("new_customer_local"),
      localCustomerId: repairDeskOfflineOperationIdSchema,
      snapshot: customerSnapshotSchema,
    })
    .strict(),
]);

const deviceSnapshotSchema = z
  .object({
    brand: text.max(120),
    model: text.max(160),
    serialOrImei: optionalText,
    deviceNotes: optionalText,
  })
  .strict();

const deviceRelationshipPlanSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("existing_customer_device"),
      deviceId: idText,
      deviceUpdatedAt: isoText.optional(),
    })
    .strict(),
  z
    .object({
      mode: z.literal("new_customer_device_local"),
      localDeviceId: repairDeskOfflineOperationIdSchema,
      snapshot: deviceSnapshotSchema,
    })
    .strict(),
]);

export const repairDeskOfflineOrderRelationshipPlanSchema = z
  .object({
    customer: customerRelationshipPlanSchema,
    device: deviceRelationshipPlanSchema,
  })
  .strict();

const faultPriceSchema = z
  .object({
    name: text.max(140),
    price: moneyAmount,
    currency_code: z.literal("EUR").optional(),
    note: optionalText,
  })
  .strict();

const offlineOrderCreateDraftSchema = z
  .object({
    order_type: z.enum(["quick_repair", "dropoff_repair"]),
    issue_description: text.max(2_000),
    internal_tag: optionalText,
    accessory_notes: optionalText,
    warranty_text: optionalText,
    warranty_months: z.coerce.number().int().min(0).max(120).optional(),
    warranty_change_reason: optionalText,
    fault_prices: z.array(faultPriceSchema).max(30).default([]),
    deposit_amount: moneyAmount.optional(),
  })
  .strict();

export const repairDeskOfflineOrderCreateSyncSchema = z
  .object({
    operationId: repairDeskOfflineOperationIdSchema,
    baseClientCreatedAt: isoText,
    payload: z
      .object({
        relationshipPlan: repairDeskOfflineOrderRelationshipPlanSchema,
        order: offlineOrderCreateDraftSchema,
      })
      .strict(),
  })
  .strict();

export type RepairDeskOfflineOrderCreateSyncInput = z.infer<
  typeof repairDeskOfflineOrderCreateSyncSchema
>;

const offlineOrderUpdateChangesSchema = z
  .object({
    device_brand: optionalText,
    device_model: optionalText,
    device_imei: optionalText,
    device_notes: optionalText,
    issue_description: optionalText,
    diagnosis_result: optionalText,
    internal_tag: optionalText,
    accessory_notes: optionalText,
    warranty_text: optionalText,
    warranty_months: z.coerce.number().int().min(0).max(120).optional(),
    warranty_change_reason: optionalText,
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, {
    message: "Offline order update must include at least one allowed change.",
  });

export const repairDeskOfflineOrderUpdateSyncSchema = z
  .object({
    operationId: repairDeskOfflineOperationIdSchema,
    baseClientCreatedAt: isoText,
    payload: z
      .object({
        serverOrderId: idText,
        baseUpdatedAt: isoText,
        changes: offlineOrderUpdateChangesSchema,
      })
      .strict(),
  })
  .strict();

export type RepairDeskOfflineOrderUpdateSyncInput = z.infer<
  typeof repairDeskOfflineOrderUpdateSyncSchema
>;

export type RepairDeskOfflineOrderUpdateChanges = z.infer<typeof offlineOrderUpdateChangesSchema>;

export const repairDeskOfflineOrderSyncSchemas = {
  create: repairDeskOfflineOrderCreateSyncSchema,
  update: repairDeskOfflineOrderUpdateSyncSchema,
} as const;

const unsafeMetadataKeyFragments = [
  "accessrequest",
  "approval",
  "attachment",
  "cancel",
  "capture",
  "delete",
  "device_unlock",
  "email",
  "imei",
  "inventory",
  "member",
  "message",
  "paid",
  "password",
  "payment",
  "phone",
  "pin",
  "recipient",
  "role",
  "secret",
  "setting",
  "sms",
  "serial",
  "signed",
  "status",
  "storage",
  "stock",
  "token",
  "transition",
  "unlock",
  "upload",
  "whatsapp",
  "workflow",
] as const;

export function assertRepairDeskOfflineOperationMetadataSafe(value: unknown): void {
  const unsafePath = findUnsafeMetadataPath(value);
  if (unsafePath) {
    throw new Error(`Offline operation metadata contains sensitive field: ${unsafePath}.`);
  }
}

export function createRepairDeskOfflineCanonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function createRepairDeskOfflineRequestHash(value: unknown, secret: string): string {
  if (secret.length < 16) {
    throw new Error("Offline request hash secret must be at least 16 characters.");
  }

  return createHmac("sha256", secret)
    .update(createRepairDeskOfflineCanonicalJson(value))
    .digest("hex");
}

export function resolveRepairDeskOfflineOperationReplay(
  existing: RepairDeskOfflineStoredOperation | null | undefined,
  requestHash: string,
  options: { now?: Date; staleStartedAfterMs?: number } = {},
): RepairDeskOfflineReplayDecision {
  if (!existing) return { decision: "start" };
  if (existing.requestHash !== requestHash) {
    return { decision: "conflict", resultCode: "idempotency_conflict" };
  }

  if (existing.status === "succeeded") {
    return {
      decision: "replay",
      resultCode: existing.resultCode ?? "idempotent_replay",
      responseSummary: existing.responseSummary,
    };
  }

  if (existing.status === "conflict") {
    return { decision: "conflict", resultCode: "idempotency_conflict" };
  }

  if (existing.status === "blocked") {
    return { decision: "blocked", resultCode: existing.resultCode ?? "needs_review" };
  }

  if (existing.status === "started" && isStaleStartedOperation(existing, options)) {
    return { decision: "recover_stale_started", resultCode: "retryable_error" };
  }

  return { decision: "retryable_error", resultCode: "retryable_error" };
}

export function mapRepairDeskOfflineServerResultCodeToHandlerResult(
  resultCode: RepairDeskOfflineServerResultCode,
  responseSummary: RepairDeskOfflineOperationResponseSummary = {},
): RepairDeskOfflineHandlerResult {
  if (resultCode === "synced" || resultCode === "idempotent_replay") {
    return { status: "synced", serverOrderId: responseSummary.serverOrderId };
  }

  if (resultCode === "idempotency_conflict" || resultCode === "stale_version") {
    return { status: "conflict" };
  }

  if (
    resultCode === "needs_review" ||
    resultCode === "blocked_operation" ||
    resultCode === "unauthorized" ||
    resultCode === "forbidden"
  ) {
    return { status: "blocked" };
  }

  return { status: "retryable_error" };
}

export function assertRepairDeskOfflineOrderCreatePermission(actor: AuditActor): void {
  assertPermission(actor, "order:create");
}

export function assertRepairDeskOfflineOrderUpdatePermission(
  actor: AuditActor,
  changes: RepairDeskOfflineOrderUpdateChanges,
  context: PermissionContext = {},
): void {
  for (const action of resolveRepairDeskOfflineOrderUpdateActions(changes)) {
    assertPermission(actor, action, context);
  }
}

export function resolveRepairDeskOfflineOrderUpdateActions(
  changes: RepairDeskOfflineOrderUpdateChanges,
): PermissionAction[] {
  const actions = new Set<PermissionAction>();
  const repairFields = new Set(["diagnosis_result", "device_notes"]);

  for (const key of Object.keys(changes)) {
    actions.add(repairFields.has(key) ? "order:update_repair" : "order:update_intake");
  }

  return [...actions];
}

function canonicalize(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("Offline request payload contains non-finite number.");
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : canonicalize(item)));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }

  throw new Error("Offline request payload contains unsupported value.");
}

function isStaleStartedOperation(
  existing: RepairDeskOfflineStoredOperation,
  options: { now?: Date; staleStartedAfterMs?: number },
): boolean {
  const updatedAt = existing.updatedAt ? Date.parse(existing.updatedAt) : Number.NaN;
  if (!Number.isFinite(updatedAt)) return false;

  const now = options.now ?? new Date();
  const staleStartedAfterMs = options.staleStartedAfterMs ?? 5 * 60 * 1_000;
  return now.getTime() - updatedAt >= staleStartedAfterMs;
}

function findUnsafeMetadataPath(value: unknown, path = "$"): string | null {
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const child = findUnsafeMetadataPath(value[index], `${path}[${index}]`);
      if (child) return child;
    }
    return null;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (unsafeMetadataKeyFragments.some((fragment) => normalizedKey.includes(fragment))) {
      return `${path}.${key}`;
    }

    const childPath = findUnsafeMetadataPath(child, `${path}.${key}`);
    if (childPath) return childPath;
  }

  return null;
}
