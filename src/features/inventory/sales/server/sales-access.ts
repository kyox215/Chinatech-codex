import type { AuditActor } from "@/lib/repairdesk/types";
import { assertPermission, type PermissionAction } from "@/server/permissions";
import { isStoreRolloutEnabled } from "@/shared/lib/store-rollout";
import type { InventorySalesCommandBody } from "../model/contracts";

export class InventorySalesError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "InventorySalesError";
  }
}
export type InventorySalesEnvironment = {
  INVENTORY_SALES_SCHEMA_READY?: string;
  INVENTORY_SALES_COMMANDS?: string;
  INVENTORY_SALES_UI?: string;
  INVENTORY_SALES_ALL_STORES_ENABLED?: string;
  INVENTORY_SALES_STORE_ALLOWLIST?: string;
  INVENTORY_SALES_STORE_DENYLIST?: string;
};
export function isInventorySalesEnabled(
  storeId: string | null | undefined,
  mode: "read" | "command",
  env: InventorySalesEnvironment = process.env as InventorySalesEnvironment,
) {
  return (
    env.INVENTORY_SALES_SCHEMA_READY === "1" &&
    (mode === "command" ? env.INVENTORY_SALES_COMMANDS === "1" : env.INVENTORY_SALES_UI === "1") &&
    isStoreRolloutEnabled({
      storeId,
      allStoresEnabled: env.INVENTORY_SALES_ALL_STORES_ENABLED,
      allowlist: env.INVENTORY_SALES_STORE_ALLOWLIST,
      denylist: env.INVENTORY_SALES_STORE_DENYLIST,
    })
  );
}
export function assertInventorySalesEnabled(actor: AuditActor, mode: "read" | "command") {
  if (!isInventorySalesEnabled(actor.storeId, mode))
    throw new InventorySalesError("feature_disabled", "商品售卖功能尚未对当前门店开放", 503);
}
export function inventorySalesRequiredPermissions(
  input: InventorySalesCommandBody,
): PermissionAction[] {
  const permissions: PermissionAction[] = ["inventory:read"];
  if (input.command === "sale.create") {
    permissions.push("inventory:sale");
    if (input.payload.payment.amount_cents < input.payload.price_cents)
      permissions.push("reservation:create");
    permissions.push("payment:collect");
  }
  if (input.command === "payment.append") permissions.push("payment:collect");
  if (input.command === "pickup.confirm" || ("deliver" in input.payload && input.payload.deliver))
    permissions.push("pickup:confirm");
  return permissions;
}
export function assertInventorySalesCommandAccess(
  actor: AuditActor,
  input: InventorySalesCommandBody,
) {
  assertInventorySalesEnabled(actor, "command");
  for (const action of inventorySalesRequiredPermissions(input)) assertPermission(actor, action);
}
export function assertInventorySalesReadAccess(actor: AuditActor, receipt = false) {
  assertInventorySalesEnabled(actor, "read");
  assertPermission(actor, "inventory:read");
  if (receipt) {
    assertPermission(actor, "inventory:sale");
    assertPermission(actor, "inventory:update");
    assertPermission(actor, "customer:detail");
  }
}
