import { repairServiceCatalogItems, resolveRepairServiceCatalogItem } from "@/entities/order";
import type {
  AuditActor,
  CreateOrderCostInput,
  FaultPriceItem,
  OrderLineCostsResult,
  StoreFaultCostDefaultsResult,
  UpdateOrderLineCostsRequest,
  UpdateStoreFaultCostDefaultsRequest,
} from "@/lib/repairdesk/types";
import { CURRENCY_CODE } from "@/lib/money";
import { getSupabaseAdmin } from "@/server/supabase";
import {
  fail,
  maybeString,
  money,
  requiredString,
  requireStoreIdFromActor,
} from "@/server/repairdesk-shared";
import { assertCanManageOrderCosts, assertCanReadOrderCosts } from "./order-cost-feature";

type Row = Record<string, unknown>;

export class CostOperationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CostOperationError";
  }
}

function requireActorId(actor: AuditActor) {
  if (!actor.id) throw new Error("缺少成本操作人");
  return actor.id;
}

function nullableMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return money(value);
}

function assertCostRpcResult(data: unknown, error: { message: string } | null, context: string) {
  fail(error, context);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${context}：数据库返回无效`);
  }
  const result = data as Row;
  if (result.ok === true) return result;
  switch (requiredString(result.code)) {
    case "stale_version":
      throw new CostOperationError("成本已被其他人更新，请刷新后重试", "stale_version", 409);
    case "line_set_mismatch":
      throw new CostOperationError("报价项目已变化，请刷新工单后重试", "line_set_mismatch", 409);
    case "forbidden":
    case "actor_forbidden":
      throw new CostOperationError("无权管理内部成本", "forbidden", 403);
    case "order_not_found":
      throw new CostOperationError("工单不存在或不属于当前店铺", "order_not_found", 404);
    default:
      throw new CostOperationError(
        `${context}：${requiredString(result.code) || "操作被拒绝"}`,
        requiredString(result.code) || "cost_operation_failed",
        422,
      );
  }
}

export async function getStoreFaultCostDefaults(
  expectedStoreId: string,
  actor: AuditActor,
): Promise<StoreFaultCostDefaultsResult> {
  assertCanManageOrderCosts(actor);
  const storeId = requireStoreIdFromActor(actor);
  if (expectedStoreId !== storeId) {
    throw new CostOperationError("店铺上下文已变化，请刷新后重试", "store_context_changed", 409);
  }
  const { data, error } = await getSupabaseAdmin().rpc(
    "repairdesk_read_store_fault_cost_defaults_rpc",
    { p_store_id: storeId, p_actor_id: requireActorId(actor) },
  );
  const result = assertCostRpcResult(data, error, "读取维修项目默认成本失败");
  const rows = Array.isArray(result.items) ? (result.items as Row[]) : [];
  const byKey = new Map(rows.map((row) => [requiredString(row.catalog_key), row]));
  return {
    version: Number(result.version ?? 0),
    currency_code: CURRENCY_CODE,
    items: repairServiceCatalogItems.map((catalog) => {
      const row = byKey.get(catalog.catalogKey);
      return {
        catalog_key: catalog.catalogKey,
        catalog_name: catalog.name,
        default_cost_amount: nullableMoney(row?.default_cost_amount),
      };
    }),
  };
}

export async function updateStoreFaultCostDefaults(
  input: UpdateStoreFaultCostDefaultsRequest,
  actor: AuditActor,
) {
  assertCanManageOrderCosts(actor);
  const storeId = requireStoreIdFromActor(actor);
  if (input.expected_store_id !== storeId) {
    throw new CostOperationError("店铺上下文已变化，请刷新后重试", "store_context_changed", 409);
  }
  const { data, error } = await getSupabaseAdmin().rpc(
    "repairdesk_replace_store_fault_cost_defaults_rpc",
    {
      p_store_id: storeId,
      p_actor_id: requireActorId(actor),
      p_expected_version: input.expected_version,
      p_items: input.items,
    },
  );
  assertCostRpcResult(data, error, "保存维修项目默认成本失败");
  return getStoreFaultCostDefaults(storeId, actor);
}

function faultLines(value: unknown): FaultPriceItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Row;
    const lineId = maybeString(row.line_id);
    const name = maybeString(row.name);
    if (!lineId || !name) return [];
    return [
      {
        line_id: lineId,
        catalog_key: maybeString(row.catalog_key),
        name,
        price: money(row.price),
        currency_code: CURRENCY_CODE,
        note: maybeString(row.note),
      },
    ];
  });
}

export async function getOrderLineCosts(
  orderId: string,
  actor: AuditActor,
): Promise<OrderLineCostsResult> {
  assertCanReadOrderCosts(actor);
  const storeId = requireStoreIdFromActor(actor);
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_read_order_line_costs_rpc", {
    p_store_id: storeId,
    p_order_id: orderId,
    p_actor_id: requireActorId(actor),
  });
  const result = assertCostRpcResult(data, error, "读取工单成本失败");
  const rawFaultPrices = result.fault_prices;
  const lines = faultLines(rawFaultPrices);
  const unidentifiedLineCount = Array.isArray(rawFaultPrices)
    ? rawFaultPrices.filter((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return false;
        return !maybeString((item as Row).line_id) && Boolean(maybeString((item as Row).name));
      }).length
    : 0;
  const rows = Array.isArray(result.items) ? (result.items as Row[]) : [];
  const byLine = new Map(rows.map((row) => [requiredString(row.line_id), row]));
  return {
    order_id: orderId,
    version: Number(result.version ?? 0),
    currency_code: CURRENCY_CODE,
    unidentified_line_count: unidentifiedLineCount,
    items: lines.flatMap((line) => {
      if (!line.line_id) return [];
      const row = byLine.get(line.line_id);
      const catalog = line.catalog_key ? resolveRepairServiceCatalogItem(line) : undefined;
      return [
        {
          line_id: line.line_id,
          catalog_key: catalog?.catalogKey ?? line.catalog_key,
          name: line.name,
          cost_amount: nullableMoney(row?.cost_amount),
          source:
            row?.source === "manual" || row?.source === "manual_blank"
              ? row.source
              : "store_default",
        },
      ];
    }),
  };
}

export async function updateOrderLineCosts(
  orderId: string,
  input: UpdateOrderLineCostsRequest,
  actor: AuditActor,
) {
  assertCanManageOrderCosts(actor);
  const storeId = requireStoreIdFromActor(actor);
  if (input.expected_store_id !== storeId) {
    throw new CostOperationError("店铺上下文已变化，请刷新后重试", "store_context_changed", 409);
  }
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_replace_order_line_costs_rpc", {
    p_store_id: storeId,
    p_order_id: orderId,
    p_actor_id: requireActorId(actor),
    p_expected_version: input.expected_version,
    p_items: input.items.map((item) => ({
      line_id: item.line_id,
      cost_amount: item.mode === "blank" ? null : item.amount,
    })),
  });
  assertCostRpcResult(data, error, "保存工单内部成本失败");
  return getOrderLineCosts(orderId, actor);
}

export async function applyCreateOrderCostInputs(
  orderId: string,
  items: CreateOrderCostInput[],
  actor: AuditActor,
) {
  assertCanManageOrderCosts(actor);
  const explicit = items.filter((item) => item.mode !== "default");
  if (explicit.length === 0) return;
  const storeId = requireStoreIdFromActor(actor);
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_apply_order_cost_inputs_rpc", {
    p_store_id: storeId,
    p_order_id: orderId,
    p_actor_id: requireActorId(actor),
    p_expected_version: 1,
    p_items: explicit.map((item) => ({
      line_id: item.line_id,
      mode: item.mode,
      ...(item.mode === "manual" ? { amount: item.amount } : {}),
    })),
  });
  assertCostRpcResult(data, error, "保存新工单内部成本失败");
}
