import type {
  ApplyInventoryWorkflowV2Input,
  ApplyInventoryWorkflowV2Result,
  AuditActor,
  InventoryItemStatus,
} from "@/lib/repairdesk/types";
import { requireStoreIdFromActor } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";

import { assertInventoryV2WorkflowAccess } from "./inventory-v2-access";
import { inventoryV2DependencyError, runInventoryV2Dependency } from "./inventory-v2-errors";

type WorkflowRpcResponse = Partial<ApplyInventoryWorkflowV2Result> & {
  ok?: boolean;
  code?: string;
};

const errorMessages: Record<string, string> = {
  actor_forbidden: "当前员工没有执行库存工作流的权限",
  idempotency_conflict: "该操作标识已用于不同请求，请刷新后重试",
  inspection_blocked: "设备检测、资料清除、挂牌价或保修门禁尚未通过",
  inspection_required: "请先填写检测结果",
  invalid_amount: "成本或挂牌价无效",
  invalid_idempotency_key: "操作标识无效",
  invalid_operation: "库存操作类型无效",
  invalid_payload: "库存资料格式无效",
  invalid_state_transition: "当前库存状态不能这样推进",
  invalid_warranty: "保修月数无效",
  item_not_found: "库存商品不存在或不属于当前门店",
  missing_expected_version: "缺少库存并发版本，请刷新后重试",
  not_v2_item: "该记录不是完整的 V2 单台设备库存",
  projection_mismatch: "库存资料存在版本不一致，请先执行数据核对",
  stale_item_version: "库存资料已被其他人更新，请刷新后重试",
  stale_unit_version: "单台设备库存已被其他人更新，请刷新后重试",
  unit_not_found: "未找到关联的单台设备库存",
};

export async function applyInventoryWorkflowV2(
  id: string,
  input: ApplyInventoryWorkflowV2Input,
  actor: AuditActor,
): Promise<ApplyInventoryWorkflowV2Result> {
  const storeId = requireStoreIdFromActor(actor);
  assertInventoryV2WorkflowAccess(actor);
  if (!actor.id) throw new Error("当前员工身份无效，请重新登录");

  const supabase = getSupabaseAdmin();
  const { data: unit, error: unitError } = await supabase
    .from("inventory_stock_units")
    .select("id,version")
    .eq("store_id", storeId)
    .eq("legacy_inventory_item_id", id)
    .maybeSingle();
  if (unitError) throw inventoryV2DependencyError("读取单台设备版本失败");
  if (!unit) throw new Error(errorMessages.unit_not_found);

  const { data, error } = await runInventoryV2Dependency(
    () =>
      supabase.rpc("repairdesk_apply_inventory_unit_workflow_v2", {
        p_store_id: storeId,
        p_item_id: id,
        p_actor_id: actor.id,
        p_expected_item_updated_at: input.expected_updated_at,
        p_expected_unit_version: Number(unit.version),
        p_idempotency_key: input.idempotency_key,
        p_operation: input.operation,
        p_target_status: input.target_status ?? null,
        p_inspection: input.inspection ?? {},
        p_commercial_patch: input.commercial_patch ?? {},
        p_reason: input.reason ?? null,
      }),
    "库存原子工作流暂时不可用",
  );
  if (error) throw inventoryV2DependencyError("库存原子工作流暂时不可用");

  const result = recordOrEmpty(data) as WorkflowRpcResponse;
  if (result.ok !== true) {
    throw new Error(errorMessages[result.code ?? ""] ?? "库存工作流执行失败");
  }
  if (
    !["applied", "idempotent_replay"].includes(result.code ?? "") ||
    !result.workflow_command_id ||
    !result.item_id ||
    !result.stock_unit_id ||
    !result.previous_status ||
    !result.status ||
    !result.item_updated_at ||
    !Number.isInteger(result.unit_version) ||
    !result.applied_at
  ) {
    throw new Error("库存工作流结果不完整，请刷新后核对状态");
  }

  return {
    ok: true,
    code: result.code as ApplyInventoryWorkflowV2Result["code"],
    workflow_command_id: result.workflow_command_id,
    item_id: result.item_id,
    stock_unit_id: result.stock_unit_id,
    previous_status: result.previous_status as InventoryItemStatus,
    status: result.status as InventoryItemStatus,
    item_updated_at: result.item_updated_at,
    unit_version: result.unit_version!,
    quality_check_id: result.quality_check_id,
    applied_at: result.applied_at,
  };
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
