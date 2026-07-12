import type { StorePermissionAction, StoreRole } from "@/lib/repairdesk/types";

export const storePermissionActions = [
  "supplier:read",
  "supplier:assign",
  "supplier:manage",
  "order:archive_browse",
  "finance:aggregate_read",
  "finance:profit_read",
] as const satisfies readonly StorePermissionAction[];

const managerOnlyGrants = new Set<StorePermissionAction>([
  "order:archive_browse",
  "finance:aggregate_read",
  "finance:profit_read",
]);

export function isStorePermissionAction(value: unknown): value is StorePermissionAction {
  return storePermissionActions.includes(value as StorePermissionAction);
}

export function canRoleReceiveStorePermissionGrant(role: StoreRole, action: StorePermissionAction) {
  if (role === "owner" || role === "viewer") return false;
  if (managerOnlyGrants.has(action)) return role === "manager";
  return true;
}

export function normalizeStorePermissionGrants(
  actions: readonly StorePermissionAction[],
  role?: StoreRole,
) {
  const normalized = new Set(
    actions.filter(
      (action) =>
        isStorePermissionAction(action) &&
        (!role || canRoleReceiveStorePermissionGrant(role, action)),
    ),
  );

  if (normalized.has("supplier:manage")) {
    normalized.add("supplier:assign");
    normalized.add("supplier:read");
  }
  if (normalized.has("supplier:assign")) normalized.add("supplier:read");
  if (normalized.has("finance:profit_read")) normalized.add("finance:aggregate_read");

  return storePermissionActions.filter((action) => normalized.has(action));
}
