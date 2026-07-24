import type {
  AuditActor,
  CreateInventoryUnitV2Input,
  CreateInventoryUnitV2Result,
} from "@/lib/repairdesk/types";
import { requireStoreIdFromActor } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";

import { assertInventoryV2IntakeAccess } from "./inventory-v2-access";
import { inventoryV2DependencyError, runInventoryV2Dependency } from "./inventory-v2-errors";

type IntakeRpcResponse = {
  ok?: boolean;
  code?: string;
  item_id?: string;
  stock_unit_id?: string;
  created_at?: string;
};

const errorMessages: Record<string, string> = {
  actor_forbidden: "当前员工没有创建设备库存的权限",
  customer_not_found: "所选客户不存在或不属于当前门店",
  customer_required: "维修转售必须选择关联客户",
  duplicate_identifier: "IMEI 或序列号已经绑定其他库存设备",
  idempotency_conflict: "该入库操作标识已用于不同请求，请刷新后重试",
  invalid_amount: "成本或计划售价无效",
  invalid_created_at: "入库时间无效",
  invalid_idempotency_key: "入库操作标识无效",
  invalid_identifiers: "设备标识符无效",
  invalid_imei: "IMEI 格式或校验位不正确",
  invalid_model: "品牌和型号资料不完整",
  invalid_source: "库存来源无效",
  invalid_source_party: "库存来源与客户或供应商不匹配，请重新选择来源",
  invalid_standardization: "型号标准化状态无效",
  invalid_warranty: "保修月数无效",
  manual_reason_required: "其他入库必须填写来源说明",
  primary_identifier_required: "必须选择一个主要 IMEI 或序列号",
  supplier_not_found: "所选供应商不存在或已停用",
  supplier_required: "供应商采购必须选择供应商",
};

export async function createInventoryUnitV2(
  input: CreateInventoryUnitV2Input,
  actor: AuditActor,
): Promise<CreateInventoryUnitV2Result> {
  const storeId = requireStoreIdFromActor(actor);
  assertInventoryV2IntakeAccess(actor);
  if (!actor.id) throw new Error("当前员工身份无效，请重新登录");

  const { data, error } = await runInventoryV2Dependency(
    () =>
      getSupabaseAdmin().rpc("repairdesk_create_inventory_unit_v2", {
        p_store_id: storeId,
        p_actor_id: actor.id,
        p_idempotency_key: input.idempotency_key,
        p_source_type: input.source_type,
        p_customer_id: input.customer_id ?? null,
        p_supplier_id: input.supplier_id ?? null,
        p_category: input.category,
        p_brand: input.brand,
        p_model: input.model,
        p_ram_capacity: input.ram_capacity ?? null,
        p_storage_capacity: input.storage_capacity ?? null,
        p_color: input.color ?? null,
        p_identifiers: input.identifiers,
        p_cost_amount: input.cost_amount,
        p_list_price: input.list_price,
        p_warranty_months: input.warranty_months,
        p_location: input.location ?? null,
        p_notes: input.notes ?? null,
        p_standardization_status: input.standardization_status,
        p_created_at: input.created_at,
      }),
    "创建设备库存服务暂时不可用",
  );
  if (error) throw inventoryV2DependencyError("创建设备库存服务暂时不可用");
  const result = recordOrEmpty(data) as IntakeRpcResponse;
  if (result.ok !== true) {
    throw new Error(errorMessages[result.code ?? ""] ?? "创建设备库存失败");
  }
  if (
    !["created", "idempotent_replay"].includes(result.code ?? "") ||
    !result.item_id ||
    !result.stock_unit_id ||
    !result.created_at
  ) {
    throw new Error("设备入库结果不完整，请按操作标识查询后再处理");
  }
  return {
    ok: true,
    code: result.code as CreateInventoryUnitV2Result["code"],
    item_id: result.item_id,
    stock_unit_id: result.stock_unit_id,
    created_at: result.created_at,
  };
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
