import { assertPrimaryStoreOwner } from "@/features/stores/server/primary-store-owner";
import {
  isOrderDataApplyEnabled,
  isOrderDataExportEnabled,
} from "@/features/orders/server/order-data-feature-flags";
import type { AuditActor } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";
import { assertPermission } from "@/server/permissions";

export async function assertOrderDataAccess(
  actor: AuditActor,
  permission: "order:export" | "customer:export" | "order:import_preview" | "order:import_apply",
  expectedStoreId: string,
) {
  if (!isOrderDataExportEnabled()) {
    throw new ForbiddenError("工单数据功能当前已暂停");
  }
  if (permission === "order:import_apply" && !isOrderDataApplyEnabled()) {
    throw new ForbiddenError("工单导入应用当前已暂停");
  }
  assertPermission(actor, permission);
  const owner = await assertPrimaryStoreOwner(actor);
  if (!expectedStoreId || expectedStoreId !== owner.storeId) {
    throw new ForbiddenError("店铺上下文已经变化，请重新打开设置页面");
  }
  return owner;
}
