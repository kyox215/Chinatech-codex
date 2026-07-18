import type {
  AuditActor,
  CompleteInventorySaleV2Input,
  CompleteInventorySaleV2Result,
  InventoryV2FiscalStatus,
} from "@/lib/repairdesk/types";
import { fail, requireStoreIdFromActor } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";

import { assertInventoryV2CommandEnabled } from "./inventory-v2-feature-flags";

type InventorySaleRpcResponse = {
  ok?: boolean;
  code?: string;
  sale_id?: string;
  payment_id?: string;
  item_id?: string;
  updated_at?: string;
  fiscal_status?: InventoryV2FiscalStatus;
};

const errorMessages: Record<string, string> = {
  actor_forbidden: "当前员工没有确认库存销售的权限",
  customer_not_found: "所选客户不存在或不属于当前门店",
  idempotency_conflict: "该销售操作标识已用于不同请求，请刷新后重试",
  inspection_blocked: "设备检测、账号锁或资料清除门禁尚未通过",
  invalid_amount: "首版原子成交只支持一次全额收款",
  invalid_fiscal_status: "财政凭证状态或外部引用不完整",
  invalid_idempotency_key: "销售操作标识无效",
  invalid_payment_method: "付款方式无效",
  invalid_sale_channel: "销售渠道无效",
  invalid_sold_at: "成交时间无效",
  invalid_state: "当前库存状态不能确认销售",
  invalid_target: "库存商品无效",
  invalid_warranty: "保修快照无效",
  item_not_found: "库存商品不存在或不属于当前门店",
  missing_expected_version: "缺少库存并发版本，请刷新后重试",
  stale_version: "库存资料已被其他人更新，请刷新后重试",
};

export async function completeInventorySaleV2(
  id: string,
  input: CompleteInventorySaleV2Input,
  actor: AuditActor,
): Promise<CompleteInventorySaleV2Result> {
  const storeId = requireStoreIdFromActor(actor);
  assertInventoryV2CommandEnabled(storeId);
  if (!actor.id) throw new Error("当前员工身份无效，请重新登录");

  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_complete_inventory_sale_v2", {
    p_store_id: storeId,
    p_item_id: id,
    p_actor_id: actor.id,
    p_expected_updated_at: input.expected_updated_at,
    p_idempotency_key: input.idempotency_key,
    p_buyer_customer_id: input.buyer_customer_id ?? null,
    p_sale_price: input.sale_price,
    p_payment_amount: input.payment_amount,
    p_payment_method: input.payment_method,
    p_sale_channel: input.sale_channel,
    p_warranty_months: input.warranty_months,
    p_warranty_snapshot: input.warranty_snapshot,
    p_fiscal_status: input.fiscal_status,
    p_fiscal_reference: input.fiscal_reference ?? null,
    p_sold_at: input.sold_at,
  });
  fail(error, "确认库存销售失败");

  const result = recordOrEmpty(data) as InventorySaleRpcResponse;
  if (result.ok !== true) {
    throw new Error(errorMessages[result.code ?? ""] ?? "确认库存销售失败");
  }
  if (
    !["completed", "idempotent_replay"].includes(result.code ?? "") ||
    !result.sale_id ||
    !result.payment_id ||
    !result.item_id ||
    !result.updated_at ||
    !result.fiscal_status
  ) {
    throw new Error("库存销售结果不完整，请按操作标识查询后再处理");
  }

  return {
    ok: true,
    code: result.code as CompleteInventorySaleV2Result["code"],
    sale_id: result.sale_id,
    payment_id: result.payment_id,
    item_id: result.item_id,
    updated_at: result.updated_at,
    fiscal_status: result.fiscal_status,
  };
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
