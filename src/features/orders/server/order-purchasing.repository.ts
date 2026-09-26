import type {
  AuditActor,
  BatchOrderPurchasesInput,
  BatchOrderPurchasesResult,
  OrderPurchaseLine,
  OrderPurchasingBoardResult,
  SaveOrderPurchaseInput,
} from "@/lib/repairdesk/types";
import { getSupabaseAdmin } from "@/server/supabase";
import { fail, requireStoreIdFromActor } from "@/server/repairdesk-shared";

type JsonRecord = Record<string, unknown>;

export class OrderPurchasingOperationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: JsonRecord,
  ) {
    super(message);
    this.name = "OrderPurchasingOperationError";
  }
}

export async function readOrderPurchasingBoard(
  input: { expected_store_id: string; order_ids: string[] },
  actor: AuditActor,
): Promise<OrderPurchasingBoardResult> {
  const storeId = requireMatchingStore(input.expected_store_id, actor);
  const actorId = requireActorId(actor);
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_read_order_purchasing", {
    p_store_id: storeId,
    p_actor_id: actorId,
    p_order_ids: input.order_ids,
  });
  failMissingMigration(error);
  fail(error, "读取工单采购表失败");
  const result = record(data);
  if (result.ok !== true) throw operationFailure(string(result.code), result);
  return {
    groups: array(result.groups).map((group) => {
      const value = record(group);
      return { order_id: requiredString(value.order_id), lines: array(value.lines).map(readLine) };
    }),
    suppliers: array(result.suppliers).map((supplier) => {
      const value = record(supplier);
      return { id: requiredString(value.id), name: requiredString(value.name) };
    }),
    permissions: {
      canManage: record(result.permissions).canManage === true,
      canAssignSupplier: record(result.permissions).canAssignSupplier === true,
    },
  };
}

export async function saveOrderPurchase(
  input: SaveOrderPurchaseInput,
  actor: AuditActor,
): Promise<{ line: OrderPurchaseLine; replayed: boolean }> {
  const storeId = requireMatchingStore(input.expected_store_id, actor);
  const actorId = requireActorId(actor);
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_save_order_purchase", {
    p_store_id: storeId,
    p_actor_id: actorId,
    p_purchase_id: input.id ?? null,
    p_order_id: input.order_id,
    p_line_id: input.line_id ?? null,
    p_part_name: input.part_name,
    p_supplier_id: input.supplier_id,
    p_unit_cost_eur: input.unit_cost_eur,
    p_quantity: input.quantity,
    p_status: input.status,
    p_expected_revision: input.expected_revision,
    p_idempotency_key: input.idempotency_key,
  });
  failMissingMigration(error);
  fail(error, "保存工单采购明细失败");
  const result = record(data);
  if (result.ok !== true) throw operationFailure(string(result.code), result);
  return { line: readLine(result.line), replayed: result.replayed === true };
}

export async function batchOrderPurchases(
  input: BatchOrderPurchasesInput,
  actor: AuditActor,
): Promise<BatchOrderPurchasesResult> {
  const storeId = requireMatchingStore(input.expected_store_id, actor);
  const actorId = requireActorId(actor);
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_batch_order_purchases", {
    p_store_id: storeId,
    p_actor_id: actorId,
    p_operation: input.operation,
    p_items: input.items,
    p_supplier_id: input.supplier_id ?? null,
    p_idempotency_key: input.idempotency_key,
  });
  failMissingMigration(error);
  fail(error, "批量更新工单采购明细失败");
  const result = record(data);
  if (result.ok !== true) throw operationFailure(string(result.code), result);
  return {
    replayed: result.replayed === true,
    results: array(result.results).map((item) => {
      const value = record(item);
      const revision = optionalInteger(value.revision);
      const code = optionalString(value.code);
      return {
        id: requiredString(value.id),
        ok: value.ok === true,
        ...(code ? { code } : {}),
        ...(revision === undefined ? {} : { revision }),
      };
    }),
  };
}

function readLine(value: unknown): OrderPurchaseLine {
  const row = record(value);
  return {
    id: requiredString(row.id),
    order_id: requiredString(row.order_id),
    line_id: nullableString(row.line_id),
    part_name: requiredString(row.part_name),
    supplier_id: nullableString(row.supplier_id),
    supplier_name: nullableString(row.supplier_name),
    unit_cost_eur: nullableString(row.unit_cost_eur),
    quantity: requiredInteger(row.quantity),
    status: requiredString(row.status) as OrderPurchaseLine["status"],
    revision: requiredInteger(row.revision),
    ordered_at: nullableString(row.ordered_at),
    arrived_at: nullableString(row.arrived_at),
    updated_at: requiredString(row.updated_at),
  };
}

function requireMatchingStore(expectedStoreId: string, actor: AuditActor) {
  const storeId = requireStoreIdFromActor(actor);
  if (storeId !== expectedStoreId) throw operationFailure("invalid_target");
  return storeId;
}

function requireActorId(actor: AuditActor) {
  if (!actor.id) throw operationFailure("actor_forbidden");
  return actor.id;
}

function failMissingMigration(error: unknown) {
  if (!error || typeof error !== "object") return;
  const candidate = error as { code?: string; message?: string };
  if (candidate.code === "PGRST202" || candidate.code === "42883") {
    throw new Error("工单采购数据库迁移尚未应用，请联系店主");
  }
}

function operationFailure(code: string, details?: JsonRecord) {
  const messages: Record<string, string> = {
    actor_forbidden: "当前员工没有查看或管理采购成本的权限",
    invalid_target: "采购操作的店铺目标无效",
    invalid_input: "采购数据无效",
    order_not_found: "工单不存在",
    order_voided: "作废工单不能新增或修改采购明细",
    line_not_found: "报价项目不属于该工单",
    supplier_not_found: "供应商不存在或已停用",
    purchase_not_found: "采购明细不存在",
    stale_revision: "采购明细已被其他操作更新，请刷新后重试",
    invalid_transition: "当前采购状态不允许执行此操作",
    incomplete_order: "标记下单前必须填写供应商和采购单价",
    idempotency_conflict: "该操作标识已用于不同请求，请刷新后重试",
  };
  const status = code === "actor_forbidden" ? 403 : code.endsWith("not_found") ? 404 : 409;
  return new OrderPurchasingOperationError(
    messages[code] ?? "工单采购操作失败",
    code.toUpperCase() || "ORDER_PURCHASING_FAILED",
    status,
    details,
  );
}

function record(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("工单采购数据库返回无效");
  }
  return value as JsonRecord;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("工单采购数据库返回无效");
  return value;
}
function string(value: unknown) {
  return typeof value === "string" ? value : "";
}
function requiredString(value: unknown) {
  const result = string(value);
  if (!result) throw new Error("工单采购数据库返回缺少字段");
  return result;
}
function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}
function nullableString(value: unknown) {
  return value === null || value === undefined ? null : requiredString(value);
}
function requiredInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error("工单采购数据库返回无效数字");
  }
  return value;
}
function optionalInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;
}
