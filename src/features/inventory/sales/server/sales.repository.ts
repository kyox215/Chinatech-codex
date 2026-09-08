import { writeAuditLog } from "@/server/audit";
import { consumeSensitiveIdentifierRead } from "@/features/inventory/server/inventory-sensitive-identifier-read";
import type { AuditActor } from "@/lib/repairdesk/types";
import { requireStoreIdFromActor } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";
import { resolveStoreOutputIdentity } from "@/entities/store/model/store-output-identity";
import { assertInventoryV2WorkflowAccess } from "@/features/inventory/server/inventory-v2-access";
import { can } from "@/server/permissions";
import {
  inventorySalesCommandBodySchema,
  inventorySalesReceiptBodySchema,
  inventorySalesListBodySchema,
  type InventorySalesList,
  type InventorySalesListInput,
  type InventorySalesCapabilities,
  type InventorySalesReceiptDocument,
  type InventorySalesCommandBody,
  type InventorySalesCommandResult,
  type InventorySalesDetail,
  type InventorySalesReceipt,
  type InventorySalesReceiptInput,
  type InventorySalesSummary,
} from "../model/contracts";
import {
  assertInventorySalesCommandAccess,
  assertInventorySalesReadAccess,
  InventorySalesError,
  isInventorySalesEnabled,
} from "./sales-access";

const conflictCodes = new Set([
  "stale_version",
  "idempotency_conflict",
  "already_sold",
  "invalid_state",
  "reference_conflict",
  "historical_store_identity_incomplete",
]);
const messages: Record<string, string> = {
  actor_forbidden: "当前员工没有执行此售卖操作的权限",
  stale_version: "商品或销售单已变化，请刷新后重试",
  idempotency_conflict: "本次操作标识已用于其他内容",
  already_sold: "这件商品已有销售单，请刷新后查看",
  stock_unit_required: "历史商品缺少实物库存记录，不能创建交易",
  inspection_blocked: "检测或上架要求尚未通过，请打开商品检测资料补全",
  overpayment: "本次收款超过待收余款",
  balance_remaining: "余款尚未结清，不能交付",
  invalid_warranty: "保修约定无效；二手12个月须记录客户明确同意",
  warranty_not_started: "尚未实际交付，保修还未开始",
  invalid_time: "销售或收款时间无效",
  invalid_delivery: "实际交付时间无效",
  historical_store_identity_incomplete:
    "销售时保存的店铺资料不完整，无法输出此历史凭证；请联系店铺负责人核对原始单据。",
  not_found: "记录不存在或不属于当前门店",
  customer_not_found: "所选客户不存在或不属于当前门店",
};

function unwrap(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new InventorySalesError("unavailable", "商品售卖服务暂不可用", 503);
  const result = data as Record<string, unknown>;
  if (result.ok !== true) {
    const code = typeof result.code === "string" ? result.code : "unavailable";
    const error = new InventorySalesError(
      code,
      messages[code] ?? "商品售卖操作未完成，请核对资料后重试",
      code === "actor_forbidden" ? 403 : conflictCodes.has(code) ? 409 : 400,
    );
    if (code === "inspection_blocked" && Array.isArray(result.missing)) {
      Object.assign(error, {
        details: {
          missing: result.missing.filter((value): value is string => typeof value === "string"),
        },
      });
    }
    throw error;
  }
  return result;
}
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await getSupabaseAdmin().rpc(name, args);
  if (error)
    throw new InventorySalesError(
      "unavailable",
      "商品售卖服务暂不可用，请保留本次操作标识后重试",
      503,
    );
  return unwrap(data);
}
export async function runInventorySalesCommand(
  input: InventorySalesCommandBody,
  actor: AuditActor,
): Promise<InventorySalesCommandResult> {
  const parsed = inventorySalesCommandBodySchema.parse(input);
  assertInventorySalesCommandAccess(actor, parsed);
  const result = await rpc("repairdesk_inventory_sales_command", {
    p_store_id: requireStoreIdFromActor(actor),
    p_actor_id: actor.id,
    p_command: parsed.command,
    p_idempotency_key: parsed.idempotency_key,
    p_payload: parsed.payload,
  });
  if (
    !["completed", "idempotent_replay"].includes(String(result.code)) ||
    !["sale_order_id", "inventory_item_id", "stock_unit_id", "item_updated_at"].every(
      (key) => typeof result[key] === "string",
    ) ||
    !["unit_version", "order_version", "paid_cents", "balance_cents"].every((key) =>
      Number.isSafeInteger(result[key]),
    )
  ) {
    throw new InventorySalesError("unavailable", "售卖结果不完整，请保留操作标识重试", 503);
  }
  return result as unknown as InventorySalesCommandResult;
}
async function read<T>(
  mode: "summary" | "detail" | "receipt",
  id: string,
  actor: AuditActor,
  receipt?: InventorySalesReceiptInput,
): Promise<T | null> {
  assertInventorySalesReadAccess(actor, mode === "receipt");
  const result = await rpc("repairdesk_inventory_sales_read", {
    p_store_id: requireStoreIdFromActor(actor),
    p_actor_id: actor.id,
    p_mode: mode,
    p_id: id,
    p_kind: receipt?.kind ?? null,
    p_payment_id: receipt?.payment_id ?? null,
    p_language: receipt?.language ?? null,
  });
  if (result.data === null) return null;
  if (!result.data || typeof result.data !== "object" || Array.isArray(result.data))
    throw new InventorySalesError("unavailable", "售卖资料暂不可用", 503);
  return result.data as T;
}
export function withInventorySalesActions<T extends InventorySalesSummary>(
  data: T | null,
  actor: AuditActor,
): T | null {
  if (!data) return null;
  data.allowed_actions = [];
  data.capabilities = inventorySalesCapabilities(actor, data);
  if (!isInventorySalesEnabled(actor.storeId, "command") || !data.stock_unit_id) return data;
  if (
    !data.order &&
    !data.inspection_missing.length &&
    can(actor, "inventory:sale") &&
    can(actor, "payment:collect")
  )
    data.allowed_actions.push("sale.create");
  if (data.order?.status === "awaiting_payment" && can(actor, "payment:collect"))
    data.allowed_actions.push("payment.append");
  if (
    data.order?.status === "paid_pending_pickup" &&
    !data.inspection_missing.length &&
    can(actor, "pickup:confirm")
  )
    data.allowed_actions.push("pickup.confirm");
  return data;
}
export async function readInventorySalesSummary(id: string, actor: AuditActor) {
  return withInventorySalesActions(await read<InventorySalesSummary>("summary", id, actor), actor);
}
export async function readInventorySalesDetail(id: string, actor: AuditActor) {
  const detail = withInventorySalesActions(
    await read<InventorySalesDetail>("detail", id, actor),
    actor,
  );
  if (detail && !can(actor, "customer:detail")) detail.customer = null;
  return detail;
}
export function inventorySalesCapabilities(
  actor: AuditActor,
  summary?: InventorySalesSummary,
): InventorySalesCapabilities {
  let workflow = true;
  try {
    assertInventoryV2WorkflowAccess(actor);
  } catch {
    workflow = false;
  }
  const commands = isInventorySalesEnabled(actor.storeId, "command");
  const sale = can(actor, "inventory:sale"),
    collect = can(actor, "payment:collect"),
    pickup = can(actor, "pickup:confirm");
  const inspect = can(actor, "inventory:quality_check"),
    prepare = can(actor, "inventory:update");
  const blocked = !workflow
    ? "workflow_disabled"
    : summary && !summary.stock_unit_id
      ? "stock_unit_required"
      : summary?.order
        ? "sale_in_progress"
        : null;
  return {
    ui_enabled: isInventorySalesEnabled(actor.storeId, "read"),
    commands_enabled: commands,
    can_reserve: commands && sale && collect && can(actor, "reservation:create"),
    can_collect: commands && collect,
    can_collect_and_deliver: commands && collect && pickup,
    can_deliver: commands && pickup,
    can_inspect: !blocked && inspect,
    can_prepare_for_sale: !blocked && prepare,
    inspection_block_reason: blocked ?? (!inspect ? "permission_denied" : null),
    prepare_block_reason: blocked ?? (!prepare ? "permission_denied" : null),
    inspection_command_path: "inventory/v2/workflow/apply",
    print_kinds:
      sale && can(actor, "inventory:update") && can(actor, "customer:detail") && summary?.order
        ? summary.order.status === "delivered"
          ? ["sale", "payment", "warranty"]
          : ["sale", "payment"]
        : !summary && sale && can(actor, "inventory:update") && can(actor, "customer:detail")
          ? ["sale", "payment", "warranty"]
          : [],
  };
}
export async function readInventorySalesList(
  input: InventorySalesListInput,
  actor: AuditActor,
): Promise<InventorySalesList> {
  assertInventorySalesReadAccess(actor);
  const parsed = inventorySalesListBodySchema.parse(input);
  const result = await rpc("repairdesk_inventory_sales_list", {
    p_store_id: requireStoreIdFromActor(actor),
    p_actor_id: actor.id,
    p_filter: parsed,
  });
  const data = result.data as InventorySalesList;
  if (!data || !Array.isArray(data.rows) || !data.counts)
    throw new InventorySalesError("unavailable", "售卖队列暂不可用", 503);
  data.capabilities = inventorySalesCapabilities(actor);
  data.rows = data.rows.map((row) => ({
    ...withInventorySalesActions(row, actor)!,
    customer: can(actor, "customer:detail") ? row.customer : null,
  }));
  return data;
}
export async function readInventorySalesReceipt(
  input: InventorySalesReceiptInput,
  actor: AuditActor,
): Promise<InventorySalesReceipt | null> {
  const parsed = inventorySalesReceiptBodySchema.parse(input);
  assertInventorySalesReadAccess(actor, true);
  const storeId = requireStoreIdFromActor(actor);
  const { data: settings, error } = await getSupabaseAdmin()
    .from("store_settings")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();
  const identity = resolveStoreOutputIdentity({
    activeStore: { id: storeId, name: actor.storeName },
    settings,
    settingsState: error ? "error" : "ready",
  });
  const language =
    parsed.language ??
    (settings?.inventory_sales_print_language === "en" ||
    settings?.inventory_sales_print_language === "zh"
      ? settings.inventory_sales_print_language
      : "it");
  const envelope: InventorySalesReceipt = {
    store_id: storeId,
    kind: parsed.kind,
    language,
    output_identity: identity,
    document: null,
  };
  if (!identity.canOutput) return envelope;
  await consumeSensitiveIdentifierRead(actor, storeId);
  const document = await read<InventorySalesReceiptDocument>("receipt", parsed.id, actor, {
    ...parsed,
    language,
  });
  if (!document) return null;
  await writeAuditLog({
    actor,
    action: "read_sensitive",
    entityType: "inventory_product_identifiers",
    entityId: document.order.inventory_item_id,
    after: {
      identifier_count: document.product.identifier ? 1 : 0,
      source: "inventory_sales_receipt",
      sale_order_id: parsed.id,
    },
  });
  return { ...envelope, document };
}
