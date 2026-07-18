import type {
  AllocateOrderPartInput,
  AuditActor,
  CreatePartCatalogItemInput,
  OrderPartAllocation,
  PartCatalogItem,
  PartPurchaseLot,
  PartsProcurementResult,
  ReceivePartLotInput,
  ReleaseOrderPartInput,
} from "@/lib/repairdesk/types";
import { getSupabaseAdmin } from "@/server/supabase";
import {
  fail,
  maybeString,
  requiredString,
  requireStoreIdFromActor,
} from "@/server/repairdesk-shared";

import { assertCanAllocatePartsCosts } from "./procurement-feature";

type Row = Record<string, unknown>;

export class ProcurementOperationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProcurementOperationError";
  }
}

function actorId(actor: AuditActor) {
  if (!actor.id) throw new ProcurementOperationError("缺少采购成本操作人", "missing_actor", 403);
  return actor.id;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function rpcResult(data: unknown, error: { message: string } | null, fallback: string) {
  fail(error, fallback);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(fallback);
  const result = data as Row;
  if (result.ok === true) return result;
  const code = requiredString(result.code) || "procurement_operation_failed";
  const statuses: Record<string, number> = {
    actor_forbidden: 403,
    order_not_found: 404,
    order_line_not_found: 404,
    cost_line_not_found: 404,
    part_not_found: 404,
    supplier_not_found: 404,
    lot_not_found: 404,
    allocation_not_found: 404,
    invalid_input: 422,
    sku_conflict: 409,
    idempotency_conflict: 409,
    line_already_allocated: 409,
    insufficient_quantity: 409,
    allocation_already_released: 409,
  };
  const messages: Record<string, string> = {
    actor_forbidden: "无权管理配件采购成本",
    order_not_found: "工单不存在或不属于当前店铺",
    order_line_not_found: "报价项目不存在或工单已不可分配配件",
    cost_line_not_found: "报价项目成本尚未建立",
    part_not_found: "配件目录项目不存在",
    supplier_not_found: "供应商不存在或已停用",
    lot_not_found: "采购批次不存在",
    allocation_not_found: "配件分配记录不存在",
    invalid_input: "配件采购数据无效",
    sku_conflict: "当前店铺已存在相同 SKU",
    idempotency_conflict: "重复操作标识与原请求不一致",
    line_already_allocated: "该报价项目已经分配了配件批次",
    insufficient_quantity: `采购批次数量不足（可用 ${numberValue(result.available_quantity)}）`,
    allocation_already_released: "该配件分配已经释放",
  };
  throw new ProcurementOperationError(messages[code] ?? fallback, code, statuses[code] ?? 422);
}

function partItem(value: unknown): PartCatalogItem | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Row;
  const id = maybeString(row.id);
  if (!id) return undefined;
  return {
    id,
    sku: requiredString(row.sku),
    name: requiredString(row.name),
    catalog_key: maybeString(row.catalog_key),
    compatible_models: stringArray(row.compatible_models),
    active: row.active === true,
    weighted_average_unit_cost_eur:
      row.weighted_average_unit_cost_eur === null ||
      row.weighted_average_unit_cost_eur === undefined
        ? null
        : numberValue(row.weighted_average_unit_cost_eur),
    available_quantity: numberValue(row.available_quantity),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

function lotItem(value: unknown): PartPurchaseLot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Row;
  const id = maybeString(row.id);
  if (!id) return undefined;
  return {
    id,
    part_item_id: requiredString(row.part_item_id),
    part_sku: requiredString(row.part_sku),
    part_name: requiredString(row.part_name),
    catalog_key: maybeString(row.catalog_key),
    supplier_id: maybeString(row.supplier_id),
    supplier_name: maybeString(row.supplier_name),
    lot_code: requiredString(row.lot_code),
    supplier_document_ref: maybeString(row.supplier_document_ref),
    received_quantity: numberValue(row.received_quantity),
    available_quantity: numberValue(row.available_quantity),
    original_unit_cost: numberValue(row.original_unit_cost),
    original_currency_code: requiredString(row.original_currency_code),
    fx_rate_to_eur: numberValue(row.fx_rate_to_eur),
    fx_rate_at: requiredString(row.fx_rate_at),
    fx_rate_source: requiredString(row.fx_rate_source),
    unit_cost_eur: numberValue(row.unit_cost_eur),
    evidence_status: row.evidence_status === "reconciled" ? "reconciled" : "confirmed",
    received_at: requiredString(row.received_at),
  };
}

function allocationItem(value: unknown): OrderPartAllocation | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Row;
  const id = maybeString(row.id);
  if (!id) return undefined;
  return {
    id,
    order_id: requiredString(row.order_id),
    line_id: requiredString(row.line_id),
    lot_id: requiredString(row.lot_id),
    part_item_id: requiredString(row.part_item_id),
    supplier_id: maybeString(row.supplier_id),
    quantity: numberValue(row.quantity),
    part_sku: requiredString(row.part_sku),
    part_name: requiredString(row.part_name),
    supplier_name: maybeString(row.supplier_name),
    unit_cost_eur: numberValue(row.unit_cost_eur),
    total_cost_eur: numberValue(row.total_cost_eur),
    state: row.state === "released" ? "released" : "allocated",
    allocated_at: requiredString(row.allocated_at),
    released_at: maybeString(row.released_at),
    release_reason: maybeString(row.release_reason),
  };
}

export async function getPartsProcurement(
  orderId: string | undefined,
  actor: AuditActor,
): Promise<PartsProcurementResult> {
  assertCanAllocatePartsCosts(actor);
  const storeId = requireStoreIdFromActor(actor);
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_read_parts_procurement_rpc", {
    p_store_id: storeId,
    p_actor_id: actorId(actor),
    p_order_id: orderId ?? null,
  });
  const result = rpcResult(data, error, "读取配件采购成本失败");
  return {
    items: (Array.isArray(result.items) ? result.items : []).flatMap(
      (item) => partItem(item) ?? [],
    ),
    lots: (Array.isArray(result.lots) ? result.lots : []).flatMap((item) => lotItem(item) ?? []),
    suppliers: (Array.isArray(result.suppliers) ? result.suppliers : []).flatMap((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const row = value as Row;
      const id = maybeString(row.id);
      const name = maybeString(row.name);
      return id && name ? [{ id, name }] : [];
    }),
    allocations: (Array.isArray(result.allocations) ? result.allocations : []).flatMap(
      (item) => allocationItem(item) ?? [],
    ),
  };
}

export async function createPartCatalogItem(input: CreatePartCatalogItemInput, actor: AuditActor) {
  assertCanAllocatePartsCosts(actor);
  const storeId = requireStoreIdFromActor(actor);
  if (input.expected_store_id !== storeId) {
    throw new ProcurementOperationError(
      "店铺上下文已变化，请刷新后重试",
      "store_context_changed",
      409,
    );
  }
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_create_part_catalog_item_rpc", {
    p_store_id: storeId,
    p_actor_id: actorId(actor),
    p_sku: input.sku,
    p_name: input.name,
    p_catalog_key: input.catalog_key ?? null,
    p_compatible_models: input.compatible_models,
    p_idempotency_key: input.idempotency_key,
  });
  const result = rpcResult(data, error, "创建配件目录失败");
  return { id: requiredString(result.id), replayed: result.code === "idempotent_replay" };
}

export async function receivePartLot(input: ReceivePartLotInput, actor: AuditActor) {
  assertCanAllocatePartsCosts(actor);
  const storeId = requireStoreIdFromActor(actor);
  if (input.expected_store_id !== storeId) {
    throw new ProcurementOperationError(
      "店铺上下文已变化，请刷新后重试",
      "store_context_changed",
      409,
    );
  }
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_receive_part_lot_rpc", {
    p_store_id: storeId,
    p_actor_id: actorId(actor),
    p_part_item_id: input.part_item_id,
    p_supplier_id: input.supplier_id ?? null,
    p_lot_code: input.lot_code,
    p_supplier_document_ref: input.supplier_document_ref ?? null,
    p_quantity: input.quantity,
    p_original_unit_cost: input.original_unit_cost,
    p_original_currency_code: input.original_currency_code,
    p_fx_rate_to_eur: input.fx_rate_to_eur,
    p_fx_rate_at: input.fx_rate_at,
    p_fx_rate_source: input.fx_rate_source,
    p_idempotency_key: input.idempotency_key,
  });
  const result = rpcResult(data, error, "登记配件采购批次失败");
  return { id: requiredString(result.id), replayed: result.code === "idempotent_replay" };
}

export async function allocateOrderPart(
  orderId: string,
  input: AllocateOrderPartInput,
  actor: AuditActor,
) {
  assertCanAllocatePartsCosts(actor);
  const storeId = requireStoreIdFromActor(actor);
  if (input.expected_store_id !== storeId) {
    throw new ProcurementOperationError(
      "店铺上下文已变化，请刷新后重试",
      "store_context_changed",
      409,
    );
  }
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_allocate_order_part_rpc", {
    p_store_id: storeId,
    p_order_id: orderId,
    p_actor_id: actorId(actor),
    p_line_id: input.line_id,
    p_lot_id: input.lot_id,
    p_quantity: input.quantity,
    p_idempotency_key: input.idempotency_key,
  });
  const result = rpcResult(data, error, "分配配件采购批次失败");
  return {
    id: requiredString(result.id),
    cost_amount: numberValue(result.cost_amount),
    replayed: result.code === "idempotent_replay",
  };
}

export async function releaseOrderPart(input: ReleaseOrderPartInput, actor: AuditActor) {
  assertCanAllocatePartsCosts(actor);
  const storeId = requireStoreIdFromActor(actor);
  if (input.expected_store_id !== storeId) {
    throw new ProcurementOperationError(
      "店铺上下文已变化，请刷新后重试",
      "store_context_changed",
      409,
    );
  }
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_release_order_part_rpc", {
    p_store_id: storeId,
    p_allocation_id: input.allocation_id,
    p_actor_id: actorId(actor),
    p_reason: input.reason,
    p_idempotency_key: input.idempotency_key,
  });
  const result = rpcResult(data, error, "释放配件采购批次失败");
  return { id: requiredString(result.id), replayed: result.code === "idempotent_replay" };
}
