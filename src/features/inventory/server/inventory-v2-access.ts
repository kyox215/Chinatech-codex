import type { AuditActor } from "@/lib/repairdesk/types";
import { can } from "@/server/permissions";

import {
  isInventoryV2CommandEnabledForStore,
  isInventoryV2StoreExplicitlyAllowlisted,
  isInventoryV2UiEnabledForStore,
  type InventoryV2FeatureEnvironment,
} from "./inventory-v2-feature-flags";

function canUseExpandedInventoryV2Rollout(actor: AuditActor, env: InventoryV2FeatureEnvironment) {
  if (!actor.storeId) return false;
  if (isInventoryV2StoreExplicitlyAllowlisted(actor.storeId, env)) return true;
  return can(actor, "settings:update_store");
}

function canUseInventoryV2CommandRollout(actor: AuditActor, env: InventoryV2FeatureEnvironment) {
  return (
    isInventoryV2CommandEnabledForStore(actor.storeId, env) &&
    canUseExpandedInventoryV2Rollout(actor, env)
  );
}

export function canUseInventoryV2Intake(
  actor: AuditActor,
  env: InventoryV2FeatureEnvironment = process.env as InventoryV2FeatureEnvironment,
) {
  return (
    canUseInventoryV2CommandRollout(actor, env) &&
    can(actor, "inventory:create") &&
    can(actor, "inventory:cost_allocate")
  );
}

export function canUseInventoryV2Sale(
  actor: AuditActor,
  env: InventoryV2FeatureEnvironment = process.env as InventoryV2FeatureEnvironment,
) {
  return canUseInventoryV2CommandRollout(actor, env) && can(actor, "inventory:sale");
}

export function canUseInventoryV2Commands(
  actor: AuditActor,
  env: InventoryV2FeatureEnvironment = process.env as InventoryV2FeatureEnvironment,
) {
  return canUseInventoryV2Intake(actor, env) || canUseInventoryV2Sale(actor, env);
}

export function canUseInventoryV2Ui(
  actor: AuditActor,
  env: InventoryV2FeatureEnvironment = process.env as InventoryV2FeatureEnvironment,
) {
  return (
    isInventoryV2UiEnabledForStore(actor.storeId, env) &&
    canUseExpandedInventoryV2Rollout(actor, env) &&
    can(actor, "inventory:create") &&
    can(actor, "inventory:cost_allocate")
  );
}

export function canUseInventoryProductsUi(
  actor: AuditActor,
  env: InventoryV2FeatureEnvironment = process.env as InventoryV2FeatureEnvironment,
) {
  return (
    isInventoryV2UiEnabledForStore(actor.storeId, env) &&
    canUseExpandedInventoryV2Rollout(actor, env) &&
    can(actor, "inventory:read")
  );
}

export function canUseInventoryProductQuickCreate(
  actor: AuditActor,
  env: InventoryV2FeatureEnvironment = process.env as InventoryV2FeatureEnvironment,
) {
  return canUseInventoryV2CommandRollout(actor, env) && can(actor, "inventory:create");
}

export function assertInventoryV2IntakeAccess(actor: AuditActor) {
  if (!canUseInventoryV2Intake(actor)) {
    throw new Error("库存 V2 入库尚未对当前门店或当前角色开放");
  }
}

export function assertInventoryV2SaleAccess(actor: AuditActor) {
  if (!canUseInventoryV2Sale(actor)) {
    throw new Error("库存 V2 销售尚未对当前门店或当前角色开放");
  }
}

export function assertInventoryV2WorkflowAccess(actor: AuditActor) {
  if (!canUseInventoryV2CommandRollout(actor, process.env as InventoryV2FeatureEnvironment)) {
    throw new Error("库存 V2 工作流尚未对当前门店或当前角色开放");
  }
}
