import type { AuditActor } from "@/lib/repairdesk/types";
import { requireStoreIdFromActor } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";

import { assertInventoryV2ShadowReadEnabled } from "./inventory-v2-feature-flags";
import { inventoryV2DependencyError, runInventoryV2Dependency } from "./inventory-v2-errors";

export type InventoryV2ReconciliationReport = {
  ok: true;
  code: "reconciled";
  store_id: string;
  checked_at: string;
  healthy: boolean;
  total_units: number;
  total_v1_marked_items: number;
  linked_pairs: number;
  missing_v2_units: number;
  missing_v1_items: number;
  payload_link_mismatches: number;
  status_mismatches: number;
  movement_mismatches: number;
  identifier_mismatches: number;
  intake_ledger_mismatches: number;
  sale_ledger_mismatches: number;
};

const metricKeys = [
  "total_units",
  "total_v1_marked_items",
  "linked_pairs",
  "missing_v2_units",
  "missing_v1_items",
  "payload_link_mismatches",
  "status_mismatches",
  "movement_mismatches",
  "identifier_mismatches",
  "intake_ledger_mismatches",
  "sale_ledger_mismatches",
] as const;

export async function reconcileInventoryV2(
  actor: AuditActor,
): Promise<InventoryV2ReconciliationReport> {
  const storeId = requireStoreIdFromActor(actor);
  assertInventoryV2ShadowReadEnabled(storeId);
  if (!actor.id) throw new Error("当前员工身份无效，请重新登录");

  const { data, error } = await runInventoryV2Dependency(
    () =>
      getSupabaseAdmin().rpc("repairdesk_inventory_v2_reconcile", {
        p_store_id: storeId,
        p_actor_id: actor.id,
      }),
    "库存 V2 对账服务暂时不可用",
  );
  if (error) throw inventoryV2DependencyError("库存 V2 对账服务暂时不可用");

  const result = recordOrEmpty(data);
  if (result.ok !== true) {
    if (result.code === "actor_forbidden") {
      throw new Error("只有店主或店长可以查看库存 V2 对账");
    }
    throw new Error("读取库存 V2 影子对账失败");
  }
  if (
    result.code !== "reconciled" ||
    result.store_id !== storeId ||
    typeof result.checked_at !== "string" ||
    typeof result.healthy !== "boolean" ||
    metricKeys.some((key) => !isNonNegativeInteger(result[key]))
  ) {
    throw new Error("库存 V2 影子对账结果不完整");
  }

  return result as InventoryV2ReconciliationReport;
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
