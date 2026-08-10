import type {
  AuditActor,
  InventoryAfterSalesStatus,
  InventoryLifecycleBatchProjection,
  InventoryProductListItem,
} from "@/lib/repairdesk/types";
import { requireStoreIdFromActor } from "@/server/repairdesk-shared";
import { can } from "@/server/permissions";
import { getSupabaseAdmin } from "@/server/supabase";
import { resolveInventoryIntakeWarrantyMonths } from "@/features/inventory/server/inventory-warranty-default.repository";

import {
  type InventoryLifecycleCommand,
  type InventoryLifecycleCommandBody,
  type InventoryLifecycleCommandResult,
  type InventoryLifecycleAfterSalesCaseDetail,
  type InventoryLifecycleAfterSalesQueueItem,
  type InventoryLifecycleListSummary,
  type InventoryLifecycleSaleDetail,
} from "../model/contracts";
import {
  assertInventoryLifecycleCommandEnabled,
  assertInventoryLifecycleReadEnabled,
  isInventoryLifecycleCommandEnabledForStore,
  resolveInventoryLifecycleProjectionMode,
} from "./inventory-lifecycle-feature-flags";
import {
  countInventoryLifecycleProjections,
  getInventoryLifecycleAfterSalesNextStatuses,
  projectCompatibleInventoryLifecycle,
  projectExactInventoryLifecycle,
  projectUnavailableInventoryLifecycle,
  type InventoryLifecycleProjectionFacts,
} from "../model/projection";

const commandPermissions: Record<InventoryLifecycleCommand, Parameters<typeof can>[1]> = {
  "acquisition.save": "finance:cost_manage",
  "inspection.save": "inventory:inspection",
  "reservation.create": "reservation:create",
  "payment.append": "payment:collect",
  "sale.complete": "inventory:sale",
  "pickup.confirm": "pickup:confirm",
  "reservation.cancel": "payment:refund_adjust",
  "warranty.adjust": "warranty:adjust",
  "after_sales.create": "after_sales:intake",
  "after_sales.update": "after_sales:update",
  "after_sales.close": "after_sales:update",
};

const errorMessages: Record<string, string> = {
  actor_forbidden: "当前员工没有执行此商品生命周期操作的权限",
  already_reserved: "这个商品已经被其他预订锁定，请刷新后重试",
  balance_remaining: "尾款尚未结清，普通员工不能确认取走",
  conflict: "商品状态刚刚发生变化，请刷新后重试",
  stale_version: "商品状态刚刚发生变化，请刷新后重试",
  deposit_required: "普通预订必须留下定金；免定金请由负责人填写原因",
  feature_disabled: "商品生命周期功能尚未对当前门店开放",
  idempotency_conflict: "本次保存标识已用于不同内容，请刷新后重试",
  invalid_amount: "金额无效，请检查后重试",
  invalid_command: "商品生命周期操作暂不支持",
  invalid_payload: "商品生命周期资料不完整或格式不正确",
  invalid_request: "商品生命周期请求无效",
  invalid_state: "商品当前状态不能执行此操作",
  invalid_transition: "售后状态刚刚发生变化，请刷新后重试",
  not_found: "商品生命周期记录不存在或不属于当前门店",
  internal_error: "商品生命周期服务暂时不可用，请稍后重试",
};

export function assertInventoryAfterSalesClosePreconditions(input: {
  currentStatus: InventoryAfterSalesStatus;
  returnedAt?: string | null;
  currentVersion: number;
  expectedVersion: number;
}) {
  if (input.currentVersion !== input.expectedVersion) {
    throw new InventoryLifecycleHttpError("stale_version", errorMessages.stale_version, 409);
  }
  if (input.currentStatus !== "returned" || !input.returnedAt) {
    throw new InventoryLifecycleHttpError(
      "invalid_state",
      "售后案件必须先登记已返还并记录返还时间，才能关闭",
      409,
    );
  }
}

export function assertInventoryAfterSalesUpdatePreconditions(input: {
  currentStatus: InventoryAfterSalesStatus;
  targetStatus: string;
  currentVersion: number;
  expectedVersion: number;
}) {
  if (input.currentVersion !== input.expectedVersion) {
    throw new InventoryLifecycleHttpError("stale_version", errorMessages.stale_version, 409);
  }
  if (input.currentStatus === "closed") {
    throw new InventoryLifecycleHttpError("invalid_state", errorMessages.invalid_state, 409);
  }
  const allowedStatuses = getInventoryLifecycleAfterSalesNextStatuses(input.currentStatus).filter(
    (status) => status !== "closed",
  );
  if (
    !allowedStatuses.includes(input.targetStatus as Exclude<InventoryAfterSalesStatus, "closed">)
  ) {
    throw new InventoryLifecycleHttpError(
      "invalid_transition",
      errorMessages.invalid_transition,
      409,
    );
  }
}

export function assertInventoryReservationCreatePreconditions(input: {
  itemId: string;
  itemStatus: string;
  unitItemId: string;
  unitStatus: string;
  unitVersion: number;
  expectedUnitVersion: number;
  activeOrder?: { inventory_item_id?: string } | null;
  activeAfterSales?: { inventory_item_id?: string } | null;
}) {
  if (input.unitVersion !== input.expectedUnitVersion) {
    throw new InventoryLifecycleHttpError("stale_version", errorMessages.stale_version, 409);
  }
  if (
    input.itemStatus !== "listed" ||
    input.unitStatus !== "listed" ||
    input.unitItemId !== input.itemId
  ) {
    throw new InventoryLifecycleHttpError("invalid_state", errorMessages.invalid_state, 409);
  }
  if (input.activeOrder || input.activeAfterSales) {
    throw new InventoryLifecycleHttpError("invalid_state", errorMessages.invalid_state, 409);
  }
}

export class InventoryLifecycleHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "InventoryLifecycleHttpError";
    this.code = code;
    this.status = status;
  }
}

function resultFromRpc(data: unknown): InventoryLifecycleCommandResult {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new InventoryLifecycleHttpError("internal_error", errorMessages.internal_error, 503);
  }
  const result = data as Record<string, unknown>;
  return {
    ok: result.ok === true,
    code: typeof result.code === "string" ? result.code : "internal_error",
    ...(typeof result.sale_order_id === "string" ? { sale_order_id: result.sale_order_id } : {}),
    ...(typeof result.stock_unit_id === "string" ? { stock_unit_id: result.stock_unit_id } : {}),
    ...(typeof result.case_id === "string" ? { case_id: result.case_id } : {}),
    ...(typeof result.payment_id === "string" ? { payment_id: result.payment_id } : {}),
    ...(typeof result.inventory_item_id === "string"
      ? { inventory_item_id: result.inventory_item_id }
      : {}),
    ...(typeof result.balance === "number" ? { balance: result.balance } : {}),
    ...(typeof result.expires_at === "string" ? { expires_at: result.expires_at } : {}),
    ...(typeof result.actual_pickup_at === "string"
      ? { actual_pickup_at: result.actual_pickup_at }
      : {}),
    ...(typeof result.sold_at === "string" ? { sold_at: result.sold_at } : {}),
    ...(typeof result.starts_at === "string" ? { starts_at: result.starts_at } : {}),
    ...(typeof result.ends_at === "string" ? { ends_at: result.ends_at } : {}),
    ...(typeof result.version_no === "number" ? { version_no: result.version_no } : {}),
    ...(typeof result.version === "number" ? { version: result.version } : {}),
    ...(typeof result.order_version === "number" ? { order_version: result.order_version } : {}),
    ...(typeof result.unit_version === "number" ? { unit_version: result.unit_version } : {}),
    ...(typeof result.case_version === "number" ? { case_version: result.case_version } : {}),
    ...(typeof result.warranty_version === "number"
      ? { warranty_version: result.warranty_version }
      : {}),
    ...(typeof result.status === "string" ? { status: result.status } : {}),
  };
}

function lifecycleErrorStatus(code: string) {
  if (code === "actor_forbidden") return 403;
  if (code === "not_found") return 404;
  if (
    [
      "idempotency_conflict",
      "conflict",
      "stale_version",
      "invalid_state",
      "invalid_transition",
      "already_reserved",
      "balance_remaining",
    ].includes(code)
  ) {
    return 409;
  }
  if (["feature_disabled", "feature_error", "internal_error", "internal"].includes(code)) {
    return 503;
  }
  return 400;
}

export async function runInventoryLifecycleCommand(
  input: InventoryLifecycleCommandBody,
  actor: AuditActor,
): Promise<InventoryLifecycleCommandResult> {
  const storeId = requireStoreIdFromActor(actor);
  if (!actor.id) {
    throw new InventoryLifecycleHttpError("actor_forbidden", "当前员工身份无效，请重新登录", 403);
  }
  if (!can(actor, commandPermissions[input.command])) {
    throw new InventoryLifecycleHttpError("actor_forbidden", errorMessages.actor_forbidden, 403);
  }
  if (
    input.command === "payment.append" &&
    (input.payload.kind === "refund" || input.payload.kind === "reversal") &&
    !can(actor, "payment:refund_adjust")
  ) {
    throw new InventoryLifecycleHttpError("actor_forbidden", errorMessages.actor_forbidden, 403);
  }
  if (input.command === "pickup.confirm" && input.payload.override_reason !== undefined) {
    if (!can(actor, "pickup:override_balance")) {
      throw new InventoryLifecycleHttpError(
        "actor_forbidden",
        "当前员工没有余额未清强制交付权限",
        403,
      );
    }
  }

  assertInventoryLifecycleCommandEnabled(storeId);
  if (input.command === "reservation.create") {
    const supabase = getSupabaseAdmin();
    const { data: unit, error: unitError } = await supabase
      .from("inventory_stock_units")
      .select("id,legacy_inventory_item_id,status,version")
      .eq("store_id", storeId)
      .eq("id", input.payload.stock_unit_id)
      .maybeSingle();
    if (unitError) {
      throw new InventoryLifecycleHttpError("internal_error", errorMessages.internal_error, 503);
    }
    if (!unit) {
      throw new InventoryLifecycleHttpError("not_found", errorMessages.not_found, 404);
    }
    const [itemResult, activeOrderResult, activeAfterSalesResult] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("id,status")
        .eq("store_id", storeId)
        .eq("id", unit.legacy_inventory_item_id)
        .maybeSingle(),
      supabase
        .from("inventory_sale_orders")
        .select("id,inventory_item_id,status")
        .eq("store_id", storeId)
        .eq("stock_unit_id", unit.id)
        .in("status", ["reserved", "sold"])
        .maybeSingle(),
      supabase
        .from("inventory_after_sales_cases")
        .select("id,inventory_item_id,status")
        .eq("store_id", storeId)
        .eq("inventory_item_id", unit.legacy_inventory_item_id)
        .neq("status", "closed")
        .maybeSingle(),
    ]);
    if (itemResult.error || activeOrderResult.error || activeAfterSalesResult.error) {
      throw new InventoryLifecycleHttpError("internal_error", errorMessages.internal_error, 503);
    }
    if (!itemResult.data) {
      throw new InventoryLifecycleHttpError("not_found", errorMessages.not_found, 404);
    }
    assertInventoryReservationCreatePreconditions({
      itemId: String(itemResult.data.id),
      itemStatus: String(itemResult.data.status),
      unitItemId: String(unit.legacy_inventory_item_id),
      unitStatus: String(unit.status),
      unitVersion: Number(unit.version),
      expectedUnitVersion: input.payload.expected_unit_version,
      activeOrder: activeOrderResult.data,
      activeAfterSales: activeAfterSalesResult.data,
    });
  }
  if (input.command === "after_sales.update" || input.command === "after_sales.close") {
    const { data: currentCase, error: currentCaseError } = await getSupabaseAdmin()
      .from("inventory_after_sales_cases")
      .select("status,returned_at,version")
      .eq("store_id", storeId)
      .eq("id", input.payload.case_id)
      .maybeSingle();
    if (currentCaseError) {
      throw new InventoryLifecycleHttpError("internal_error", errorMessages.internal_error, 503);
    }
    if (!currentCase) {
      throw new InventoryLifecycleHttpError("not_found", errorMessages.not_found, 404);
    }
    const currentStatus = currentCase.status as InventoryAfterSalesStatus;
    if (input.command === "after_sales.close") {
      if (String(input.payload.status) !== "closed") {
        throw new InventoryLifecycleHttpError(
          "invalid_payload",
          errorMessages.invalid_payload,
          400,
        );
      }
      assertInventoryAfterSalesClosePreconditions({
        currentStatus,
        returnedAt: currentCase.returned_at,
        currentVersion: Number(currentCase.version),
        expectedVersion: input.payload.expected_case_version,
      });
    } else {
      assertInventoryAfterSalesUpdatePreconditions({
        currentStatus,
        targetStatus: String(input.payload.status),
        currentVersion: Number(currentCase.version),
        expectedVersion: input.payload.expected_case_version,
      });
    }
  }
  const rpcInput =
    input.command === "pickup.confirm" && input.payload.warranty_months === undefined
      ? {
          ...input,
          payload: {
            ...input.payload,
            warranty_months: await resolveInventoryIntakeWarrantyMonths(storeId, undefined),
          },
        }
      : input;
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_inventory_lifecycle_command", {
    p_store_id: storeId,
    p_actor_id: actor.id,
    p_command: rpcInput.command,
    p_idempotency_key: rpcInput.idempotency_key,
    p_payload: rpcInput.payload,
  });
  if (error) {
    throw new InventoryLifecycleHttpError("internal_error", errorMessages.internal_error, 503);
  }

  const result = resultFromRpc(data);
  if (!result.ok) {
    throw new InventoryLifecycleHttpError(
      result.code,
      errorMessages[result.code] ?? "商品生命周期操作失败",
      lifecycleErrorStatus(result.code),
    );
  }
  return result;
}

type SaleOrderRow = {
  id: string;
  inventory_item_id: string;
  stock_unit_id: string;
  status: "reserved" | "sold" | "cancelled";
  agreed_price: number | string;
  reserved_at: string | null;
  expires_at: string | null;
  expected_pickup_at: string | null;
  sold_at: string | null;
  actual_pickup_at: string | null;
  version: number;
};

function numeric(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveInventoryLifecycleAllowedActions(
  actor: AuditActor,
  state: {
    businessStatus: InventoryLifecycleListSummary["business_status"];
    orderStatus?: SaleOrderRow["status"];
    balance: number;
    hasActiveCase: boolean;
    afterSalesStatus?: InventoryAfterSalesStatus;
    returnedAt?: string | null;
  },
): InventoryLifecycleCommand[] {
  const actions: InventoryLifecycleCommand[] = [];
  if (state.businessStatus !== "removed" && can(actor, "inventory:inspection")) {
    actions.push("inspection.save");
  }
  if (state.businessStatus === "in_stock" && can(actor, "finance:cost_manage")) {
    actions.push("acquisition.save");
  }
  if (state.businessStatus === "in_stock" && can(actor, "reservation:create")) {
    actions.push("reservation.create");
  }
  if (state.orderStatus === "reserved") {
    if (state.balance > 0 && can(actor, "payment:collect")) actions.push("payment.append");
    if (state.balance === 0 && can(actor, "inventory:sale")) actions.push("sale.complete");
    if (can(actor, "payment:refund_adjust")) actions.push("reservation.cancel");
  }
  if (state.businessStatus === "sold_pending_pickup" && can(actor, "pickup:confirm")) {
    if (state.balance === 0 || can(actor, "pickup:override_balance"))
      actions.push("pickup.confirm");
  }
  if (state.businessStatus === "delivered" && can(actor, "warranty:adjust")) {
    actions.push("warranty.adjust");
  }
  if (
    state.businessStatus === "delivered" &&
    !state.hasActiveCase &&
    can(actor, "after_sales:intake")
  ) {
    actions.push("after_sales.create");
  }
  if (state.hasActiveCase && can(actor, "after_sales:update")) {
    const nextStatuses = state.afterSalesStatus
      ? getInventoryLifecycleAfterSalesNextStatuses(state.afterSalesStatus)
      : [];
    if (nextStatuses.some((status) => status !== "closed")) actions.push("after_sales.update");
    if (nextStatuses.includes("closed") && state.returnedAt) actions.push("after_sales.close");
  }
  return actions;
}

function resolveInventoryLifecycleCommandActions(
  storeId: string,
  actor: AuditActor,
  state: Parameters<typeof resolveInventoryLifecycleAllowedActions>[1],
) {
  return isInventoryLifecycleCommandEnabledForStore(storeId)
    ? resolveInventoryLifecycleAllowedActions(actor, state)
    : [];
}

type InventoryLifecycleBatchUnitRow = {
  id: string;
  legacy_inventory_item_id: string;
  status: string;
  version: number;
};

type InventoryLifecycleBatchOrderRow = {
  id: string;
  inventory_item_id: string;
  stock_unit_id: string;
  status: "reserved" | "sold";
  agreed_price: number | string;
  reserved_at: string | null;
  expires_at: string | null;
  expected_pickup_at: string | null;
  sold_at: string | null;
  actual_pickup_at: string | null;
  version: number;
  updated_at?: string | null;
};

type InventoryLifecycleBatchCaseRow = {
  id: string;
  sale_order_id: string;
  status: "open" | "in_progress" | "waiting_customer" | "returned" | "closed";
  returned_at: string | null;
};

/**
 * Adds one minimized lifecycle projection per current list item. Exact mode
 * intentionally performs fixed-size batch reads (never one query per card).
 */
export async function enrichInventoryProductLifecycle(
  items: InventoryProductListItem[],
  actor: AuditActor,
): Promise<{
  items: InventoryProductListItem[];
  lifecycle_projection: InventoryLifecycleBatchProjection;
}> {
  const storeId = requireStoreIdFromActor(actor);
  const mode = resolveInventoryLifecycleProjectionMode(storeId);
  if (mode === "compatible") {
    const projections = items.map((item) =>
      projectCompatibleInventoryLifecycle(item.legacy_status ?? item.status),
    );
    return {
      items: items.map((item, index) => ({ ...item, lifecycle: projections[index] })),
      lifecycle_projection: { mode, counts: countInventoryLifecycleProjections(projections) },
    };
  }
  if (mode === "unavailable") {
    const projections = items.map(() => projectUnavailableInventoryLifecycle());
    return {
      items: items.map((item, index) => ({ ...item, lifecycle: projections[index] })),
      lifecycle_projection: { mode, counts: {} },
    };
  }
  if (!items.length) {
    return { items, lifecycle_projection: { mode: "exact", counts: {} } };
  }

  const itemIds = items.map((item) => item.id);
  const supabase = getSupabaseAdmin();
  const [unitsResult, ordersResult] = await Promise.all([
    supabase
      .from("inventory_stock_units")
      .select("id,legacy_inventory_item_id,status,version")
      .eq("store_id", storeId)
      .in("legacy_inventory_item_id", itemIds),
    supabase
      .from("inventory_sale_orders")
      .select(
        "id,inventory_item_id,stock_unit_id,status,agreed_price,reserved_at,expires_at,expected_pickup_at,sold_at,actual_pickup_at,version,updated_at",
      )
      .eq("store_id", storeId)
      .in("inventory_item_id", itemIds)
      .in("status", ["reserved", "sold"])
      .order("updated_at", { ascending: false }),
  ]);
  if (unitsResult.error || ordersResult.error) {
    throw new InventoryLifecycleHttpError("internal_error", errorMessages.internal_error, 503);
  }

  const unitByItem = new Map<string, InventoryLifecycleBatchUnitRow>();
  for (const row of (unitsResult.data ?? []) as unknown as InventoryLifecycleBatchUnitRow[]) {
    if (!unitByItem.has(String(row.legacy_inventory_item_id))) {
      unitByItem.set(String(row.legacy_inventory_item_id), row);
    }
  }
  const orderByItem = new Map<string, InventoryLifecycleBatchOrderRow>();
  for (const row of (ordersResult.data ?? []) as unknown as InventoryLifecycleBatchOrderRow[]) {
    const itemId = String(row.inventory_item_id);
    if (!orderByItem.has(itemId)) orderByItem.set(itemId, row);
  }

  const orders = [...orderByItem.values()];
  const orderIds = orders.map((row) => String(row.id));
  const [paymentsResult, casesResult] = await Promise.all([
    orderIds.length
      ? supabase
          .from("inventory_sale_payment_entries")
          .select("sale_order_id,kind,amount")
          .eq("store_id", storeId)
          .in("sale_order_id", orderIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? supabase
          .from("inventory_after_sales_cases")
          .select("id,sale_order_id,status,returned_at,updated_at")
          .eq("store_id", storeId)
          .in("sale_order_id", orderIds)
          .neq("status", "closed")
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (paymentsResult.error || casesResult.error) {
    throw new InventoryLifecycleHttpError("internal_error", errorMessages.internal_error, 503);
  }

  const paidByOrder = new Map<string, number>();
  for (const row of (paymentsResult.data ?? []) as Array<Record<string, unknown>>) {
    const orderId = String(row.sale_order_id ?? "");
    if (!orderId) continue;
    const sign = ["refund", "reversal"].includes(String(row.kind)) ? -1 : 1;
    paidByOrder.set(orderId, (paidByOrder.get(orderId) ?? 0) + sign * numeric(row.amount));
  }
  const caseByOrder = new Map<string, InventoryLifecycleBatchCaseRow>();
  for (const row of (casesResult.data ?? []) as unknown as InventoryLifecycleBatchCaseRow[]) {
    if (!caseByOrder.has(String(row.sale_order_id))) {
      caseByOrder.set(String(row.sale_order_id), row);
    }
  }

  const projections = items.map((item) => {
    const unit = unitByItem.get(item.id);
    const order = orderByItem.get(item.id);
    const activeCase = order ? caseByOrder.get(String(order.id)) : undefined;
    const balance = order
      ? Math.max(
          0,
          Math.round(
            (numeric(order.agreed_price) - (paidByOrder.get(String(order.id)) ?? 0)) * 100,
          ) / 100,
        )
      : undefined;
    const businessStatus: InventoryLifecycleListSummary["business_status"] = activeCase
      ? "after_sales"
      : order?.status === "reserved"
        ? "reserved"
        : order?.status === "sold"
          ? order.actual_pickup_at
            ? "delivered"
            : "sold_pending_pickup"
          : ["cancelled", "recycled"].includes(item.status)
            ? "removed"
            : "in_stock";
    const actions = resolveInventoryLifecycleCommandActions(storeId, actor, {
      businessStatus,
      orderStatus: order?.status,
      balance: balance ?? 0,
      hasActiveCase: Boolean(activeCase),
      afterSalesStatus: activeCase?.status,
      returnedAt: activeCase?.returned_at,
    });
    const facts: InventoryLifecycleProjectionFacts = {
      legacyStatus: item.legacy_status ?? item.status,
      unitStatus: unit?.status ?? null,
      order: order
        ? {
            status: order.status,
            reservedAt: order.reserved_at,
            reservationExpiresAt: order.expires_at,
            expectedPickupAt: order.expected_pickup_at,
            soldAt: order.sold_at,
            actualPickupAt: order.actual_pickup_at,
          }
        : undefined,
      afterSales: activeCase
        ? { status: activeCase.status, returnedAt: activeCase.returned_at }
        : undefined,
      balance,
      allowedActions: actions,
    };
    return projectExactInventoryLifecycle(facts);
  });

  return {
    items: items.map((item, index) => ({ ...item, lifecycle: projections[index] })),
    lifecycle_projection: {
      mode: "exact",
      counts: countInventoryLifecycleProjections(projections),
    },
  };
}

async function projectLifecycleSale(
  order: SaleOrderRow,
  actor: AuditActor,
): Promise<InventoryLifecycleSaleDetail | null> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const [productResult, unitResult, paymentsResult, inspectionResult, warrantyResult, caseResult] =
    await Promise.all([
      supabase
        .from("inventory_items")
        .select("public_no,status,warranty_until")
        .eq("store_id", storeId)
        .eq("id", order.inventory_item_id)
        .maybeSingle(),
      supabase
        .from("inventory_stock_units")
        .select("version,status")
        .eq("store_id", storeId)
        .eq("id", order.stock_unit_id)
        .maybeSingle(),
      supabase
        .from("inventory_sale_payment_entries")
        .select("kind,amount,method,occurred_at")
        .eq("store_id", storeId)
        .eq("sale_order_id", order.id)
        .order("occurred_at", { ascending: true }),
      supabase
        .from("inventory_device_inspections")
        .select(
          "battery_health,face_id_status,touch_id_status,true_tone_status,activation_lock_status,data_wipe_status,imei_status,inspected_at",
        )
        .eq("store_id", storeId)
        .eq("stock_unit_id", order.stock_unit_id)
        .order("inspected_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("inventory_warranty_versions")
        .select("version_no,basis,months,starts_at,ends_at")
        .eq("store_id", storeId)
        .eq("sale_order_id", order.id)
        .eq("basis", "commercial")
        .order("version_no", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("inventory_after_sales_cases")
        .select("id,status,coverage_decision,received_at,returned_at,version")
        .eq("store_id", storeId)
        .eq("sale_order_id", order.id)
        .neq("status", "closed")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  if (
    productResult.error ||
    unitResult.error ||
    paymentsResult.error ||
    inspectionResult.error ||
    warrantyResult.error ||
    caseResult.error
  ) {
    throw new InventoryLifecycleHttpError("internal_error", errorMessages.internal_error, 503);
  }
  if (!productResult.data || !unitResult.data) return null;

  const signedPaidAmount = (paymentsResult.data ?? []).reduce((total, payment) => {
    const sign = ["refund", "reversal"].includes(String(payment.kind)) ? -1 : 1;
    return total + sign * numeric(payment.amount);
  }, 0);
  const agreedPrice = numeric(order.agreed_price);
  const balance = Math.max(0, Math.round((agreedPrice - signedPaidAmount) * 100) / 100);
  const activeCase = caseResult.data;
  const businessStatus: InventoryLifecycleListSummary["business_status"] = activeCase
    ? "after_sales"
    : order.status === "reserved"
      ? "reserved"
      : order.status === "sold"
        ? order.actual_pickup_at
          ? "delivered"
          : "sold_pending_pickup"
        : "removed";
  const actions = resolveInventoryLifecycleCommandActions(storeId, actor, {
    businessStatus,
    orderStatus: order.status,
    balance,
    hasActiveCase: Boolean(activeCase),
    afterSalesStatus: activeCase?.status,
    returnedAt: activeCase?.returned_at,
  });
  const inspection = inspectionResult.data;
  const warranty = warrantyResult.data;
  const projection = projectExactInventoryLifecycle({
    legacyStatus: productResult.data.status,
    unitStatus: unitResult.data.status,
    order: {
      status: order.status,
      reservedAt: order.reserved_at,
      reservationExpiresAt: order.expires_at,
      expectedPickupAt: order.expected_pickup_at,
      soldAt: order.sold_at,
      actualPickupAt: order.actual_pickup_at,
    },
    afterSales: activeCase
      ? { status: activeCase.status, returnedAt: activeCase.returned_at }
      : undefined,
    balance,
    warrantyEndsAt: productResult.data.warranty_until,
    allowedActions: actions,
  });

  return {
    item_id: order.inventory_item_id,
    inventory_item_id: order.inventory_item_id,
    stock_unit_id: order.stock_unit_id,
    sku: String(productResult.data.public_no),
    business_status: businessStatus,
    sale_order_id: order.id,
    status: order.status,
    agreed_price: agreedPrice,
    signed_paid_amount: signedPaidAmount,
    balance,
    payments: (paymentsResult.data ?? []).map((payment) => ({
      kind: payment.kind,
      amount: numeric(payment.amount),
      method: payment.method,
      occurred_at: String(payment.occurred_at),
    })),
    allowed_actions: projection.allowed_actions,
    projection,
    order_version: Number(order.version),
    unit_version: Number(unitResult.data.version),
    ...(order.reserved_at ? { reserved_at: String(order.reserved_at) } : {}),
    ...(order.expires_at ? { reservation_expires_at: String(order.expires_at) } : {}),
    ...(order.expected_pickup_at ? { expected_pickup_at: String(order.expected_pickup_at) } : {}),
    ...(order.sold_at ? { sold_at: String(order.sold_at) } : {}),
    ...(order.actual_pickup_at ? { actual_pickup_at: String(order.actual_pickup_at) } : {}),
    ...(productResult.data.warranty_until
      ? { warranty_ends_at: String(productResult.data.warranty_until) }
      : {}),
    ...(inspection
      ? {
          inspection: {
            battery_health:
              inspection.battery_health === null ? null : Number(inspection.battery_health),
            face_id_status: inspection.face_id_status,
            touch_id_status: inspection.touch_id_status,
            true_tone_status: inspection.true_tone_status,
            activation_lock_status: inspection.activation_lock_status,
            data_wipe_status: inspection.data_wipe_status,
            imei_status: inspection.imei_status,
            inspected_at: String(inspection.inspected_at),
          },
        }
      : {}),
    ...(warranty
      ? {
          warranty_version: Number(warranty.version_no),
          commercial_warranty: {
            version_no: Number(warranty.version_no),
            basis: warranty.basis,
            months: Number(warranty.months),
            ...(warranty.starts_at ? { starts_at: String(warranty.starts_at) } : {}),
            ...(warranty.ends_at ? { ends_at: String(warranty.ends_at) } : {}),
          },
        }
      : {}),
    ...(activeCase
      ? {
          case_version: Number(activeCase.version),
          after_sales_status: activeCase.status,
          after_sales: {
            case_id: String(activeCase.id),
            sale_order_id: order.id,
            inventory_item_id: order.inventory_item_id,
            status: activeCase.status,
            ...(activeCase.coverage_decision
              ? { coverage_decision: activeCase.coverage_decision }
              : {}),
            received_at: String(activeCase.received_at),
            version: Number(activeCase.version),
          },
        }
      : {}),
  };
}

export async function readInventoryLifecycleSummary(
  inventoryItemId: string,
  actor: AuditActor,
): Promise<InventoryLifecycleListSummary | null> {
  const storeId = requireStoreIdFromActor(actor);
  if (!can(actor, "inventory:read")) {
    throw new InventoryLifecycleHttpError("actor_forbidden", "当前员工没有查看库存的权限", 403);
  }
  assertInventoryLifecycleReadEnabled(storeId);

  const supabase = getSupabaseAdmin();
  const { data: unit, error: unitError } = await supabase
    .from("inventory_stock_units")
    .select("id,legacy_inventory_item_id,status,version")
    .eq("store_id", storeId)
    .eq("legacy_inventory_item_id", inventoryItemId)
    .maybeSingle();
  if (unitError)
    throw new InventoryLifecycleHttpError("internal_error", errorMessages.internal_error, 503);
  if (!unit) return null;

  const [{ data: product, error: productError }, { data: order, error: orderError }] =
    await Promise.all([
      supabase
        .from("inventory_items")
        .select("public_no,status,warranty_until")
        .eq("store_id", storeId)
        .eq("id", inventoryItemId)
        .maybeSingle(),
      supabase
        .from("inventory_sale_orders")
        .select(
          "id,inventory_item_id,stock_unit_id,status,agreed_price,reserved_at,expires_at,expected_pickup_at,sold_at,actual_pickup_at,version",
        )
        .eq("store_id", storeId)
        .eq("inventory_item_id", inventoryItemId)
        .in("status", ["reserved", "sold"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  if (productError || orderError) {
    throw new InventoryLifecycleHttpError("internal_error", errorMessages.internal_error, 503);
  }
  if (!product) return null;

  if (order) return projectLifecycleSale(order as SaleOrderRow, actor);
  const businessStatus: InventoryLifecycleListSummary["business_status"] = [
    "cancelled",
    "recycled",
  ].includes(String(unit.status))
    ? "removed"
    : "in_stock";
  const allowedActions = resolveInventoryLifecycleCommandActions(storeId, actor, {
    businessStatus,
    balance: 0,
    hasActiveCase: false,
  });
  const projection = projectExactInventoryLifecycle({
    legacyStatus: product.status,
    unitStatus: unit.status,
    warrantyEndsAt: product.warranty_until,
    allowedActions,
  });
  return {
    item_id: inventoryItemId,
    stock_unit_id: String(unit.id),
    sku: String(product.public_no),
    business_status: businessStatus,
    ...(product.warranty_until ? { warranty_ends_at: String(product.warranty_until) } : {}),
    ...(typeof unit.version === "number" ? { unit_version: unit.version } : {}),
    allowed_actions: projection.allowed_actions,
    projection,
  };
}

export async function readInventoryLifecycleSale(
  saleOrderId: string,
  actor: AuditActor,
): Promise<InventoryLifecycleSaleDetail | null> {
  const storeId = requireStoreIdFromActor(actor);
  if (!can(actor, "inventory:read")) {
    throw new InventoryLifecycleHttpError("actor_forbidden", "当前员工没有查看库存的权限", 403);
  }
  assertInventoryLifecycleReadEnabled(storeId);
  const { data, error } = await getSupabaseAdmin()
    .from("inventory_sale_orders")
    .select(
      "id,inventory_item_id,stock_unit_id,status,agreed_price,reserved_at,expires_at,expected_pickup_at,sold_at,actual_pickup_at,version",
    )
    .eq("store_id", storeId)
    .eq("id", saleOrderId)
    .maybeSingle();
  if (error)
    throw new InventoryLifecycleHttpError("internal_error", errorMessages.internal_error, 503);
  return data ? projectLifecycleSale(data as SaleOrderRow, actor) : null;
}

export async function readInventoryLifecycleAfterSalesQueue(
  actor: AuditActor,
): Promise<InventoryLifecycleAfterSalesQueueItem[]> {
  const storeId = requireStoreIdFromActor(actor);
  if (!can(actor, "inventory:read") || !can(actor, "after_sales:intake")) {
    throw new InventoryLifecycleHttpError("actor_forbidden", "当前员工没有查看售后队列的权限", 403);
  }
  assertInventoryLifecycleReadEnabled(storeId);
  const supabase = getSupabaseAdmin();
  const { data: cases, error } = await supabase
    .from("inventory_after_sales_cases")
    .select(
      "id,sale_order_id,inventory_item_id,status,issue_summary,coverage_decision,received_at,returned_at,version",
    )
    .eq("store_id", storeId)
    .neq("status", "closed")
    .order("received_at", { ascending: false })
    .limit(100);
  if (error)
    throw new InventoryLifecycleHttpError("internal_error", errorMessages.internal_error, 503);
  if (!cases?.length) return [];
  const orderIds = cases.map((row) => String(row.sale_order_id));
  const itemIds = cases.map((row) => String(row.inventory_item_id));
  const [{ data: orders, error: orderError }, { data: products, error: productError }] =
    await Promise.all([
      supabase
        .from("inventory_sale_orders")
        .select("id,stock_unit_id,version")
        .eq("store_id", storeId)
        .in("id", orderIds),
      supabase
        .from("inventory_items")
        .select("id,public_no")
        .eq("store_id", storeId)
        .in("id", itemIds),
    ]);
  if (orderError || productError) {
    throw new InventoryLifecycleHttpError("internal_error", errorMessages.internal_error, 503);
  }
  const orderMap = new Map((orders ?? []).map((row) => [String(row.id), row]));
  const productMap = new Map((products ?? []).map((row) => [String(row.id), row]));
  return cases.flatMap((row) => {
    const order = orderMap.get(String(row.sale_order_id));
    const product = productMap.get(String(row.inventory_item_id));
    if (!order || !product) return [];
    const allowedNextStatuses = getInventoryLifecycleAfterSalesNextStatuses(row.status);
    const allowedActions: InventoryLifecycleCommand[] =
      isInventoryLifecycleCommandEnabledForStore(storeId) && can(actor, "after_sales:update")
        ? [
            ...(allowedNextStatuses.some((status) => status !== "closed")
              ? (["after_sales.update"] as const)
              : []),
            ...(allowedNextStatuses.includes("closed") && row.returned_at
              ? (["after_sales.close"] as const)
              : []),
          ]
        : [];
    return [
      {
        case_id: String(row.id),
        sale_order_id: String(row.sale_order_id),
        inventory_item_id: String(row.inventory_item_id),
        stock_unit_id: String(order.stock_unit_id),
        sku: String(product.public_no),
        status: row.status,
        issue_summary: String(row.issue_summary),
        ...(row.coverage_decision ? { coverage_decision: row.coverage_decision } : {}),
        received_at: String(row.received_at),
        ...(row.returned_at ? { returned_at: String(row.returned_at) } : {}),
        version: Number(row.version),
        order_version: Number(order.version),
        allowed_actions: allowedActions,
        allowed_next_statuses: allowedNextStatuses,
      },
    ];
  });
}

export async function readInventoryLifecycleAfterSalesCase(
  caseId: string,
  actor: AuditActor,
): Promise<InventoryLifecycleAfterSalesCaseDetail | null> {
  const storeId = requireStoreIdFromActor(actor);
  if (!can(actor, "inventory:read") || !can(actor, "after_sales:update")) {
    throw new InventoryLifecycleHttpError(
      "actor_forbidden",
      "当前员工没有查看售后诊断详情的权限",
      403,
    );
  }
  assertInventoryLifecycleReadEnabled(storeId);
  const supabase = getSupabaseAdmin();
  const { data: caseRow, error: caseError } = await supabase
    .from("inventory_after_sales_cases")
    .select(
      "id,sale_order_id,inventory_item_id,status,issue_summary,diagnosis,coverage_decision,received_at,returned_at,closed_at,version",
    )
    .eq("store_id", storeId)
    .eq("id", caseId)
    .maybeSingle();
  if (caseError)
    throw new InventoryLifecycleHttpError("internal_error", errorMessages.internal_error, 503);
  if (!caseRow) return null;
  const [orderResult, productResult, eventsResult, sale] = await Promise.all([
    supabase
      .from("inventory_sale_orders")
      .select("stock_unit_id,version")
      .eq("store_id", storeId)
      .eq("id", caseRow.sale_order_id)
      .maybeSingle(),
    supabase
      .from("inventory_items")
      .select("public_no")
      .eq("store_id", storeId)
      .eq("id", caseRow.inventory_item_id)
      .maybeSingle(),
    supabase
      .from("inventory_after_sales_events")
      .select("event_type,from_status,to_status,occurred_at")
      .eq("store_id", storeId)
      .eq("case_id", caseId)
      .order("occurred_at", { ascending: false })
      .limit(100),
    readInventoryLifecycleSale(String(caseRow.sale_order_id), actor),
  ]);
  if (orderResult.error || productResult.error || eventsResult.error)
    throw new InventoryLifecycleHttpError("internal_error", errorMessages.internal_error, 503);
  if (!orderResult.data || !productResult.data) return null;
  const allowedNextStatuses = getInventoryLifecycleAfterSalesNextStatuses(caseRow.status);
  const allowedActions: InventoryLifecycleCommand[] =
    isInventoryLifecycleCommandEnabledForStore(storeId) && can(actor, "after_sales:update")
      ? [
          ...(allowedNextStatuses.some((status) => status !== "closed")
            ? (["after_sales.update"] as const)
            : []),
          ...(allowedNextStatuses.includes("closed") && caseRow.returned_at
            ? (["after_sales.close"] as const)
            : []),
        ]
      : [];
  return {
    case_id: String(caseRow.id),
    sale_order_id: String(caseRow.sale_order_id),
    inventory_item_id: String(caseRow.inventory_item_id),
    stock_unit_id: String(orderResult.data.stock_unit_id),
    sku: String(productResult.data.public_no),
    status: caseRow.status,
    issue_summary: String(caseRow.issue_summary),
    ...(caseRow.diagnosis ? { diagnosis: String(caseRow.diagnosis) } : {}),
    ...(caseRow.coverage_decision ? { coverage_decision: caseRow.coverage_decision } : {}),
    received_at: String(caseRow.received_at),
    ...(caseRow.returned_at ? { returned_at: String(caseRow.returned_at) } : {}),
    ...(caseRow.closed_at ? { closed_at: String(caseRow.closed_at) } : {}),
    version: Number(caseRow.version),
    order_version: Number(orderResult.data.version),
    allowed_actions: allowedActions,
    allowed_next_statuses: allowedNextStatuses,
    sale: sale ?? undefined,
    events: (eventsResult.data ?? []).map((event) => ({
      event_type: String(event.event_type),
      ...(event.from_status ? { from_status: String(event.from_status) } : {}),
      ...(event.to_status ? { to_status: String(event.to_status) } : {}),
      occurred_at: String(event.occurred_at),
    })),
  };
}
