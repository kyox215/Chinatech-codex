import { describe, expect, it } from "vitest";

import type { AuditActor, StoreRole } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";

import {
  assertPermission,
  can,
  getPermissionDecision,
  isStoreRoleFrontdesk,
  permissionActionDefinitions,
  permissionActions,
  permissionRoles,
  resolvePermissionRole,
  rolePermissions,
} from "./permissions";

const baseActor: AuditActor = {
  id: "staff_1",
  email: "staff@example.com",
  displayName: "Staff",
  storeId: "store_1",
  storeName: "ChinaTech",
};

function actor(role: StoreRole, overrides: Partial<AuditActor> = {}): AuditActor {
  return {
    ...baseActor,
    role,
    storeRole: role,
    ...overrides,
  };
}

describe("server permission matrix", () => {
  it("defines an explicit permission for every role/action pair", () => {
    for (const role of permissionRoles) {
      for (const action of permissionActions) {
        expect(rolePermissions[role][action], `${role} missing ${action}`).toBeDefined();
      }
    }
  });

  it("has metadata for every action", () => {
    for (const action of permissionActions) {
      expect(permissionActionDefinitions[action], action).toMatchObject({
        label: expect.any(String),
        requiresStore: expect.any(Boolean),
      });
    }
  });

  it("denies unknown, null, missing-store, and system actors by default", () => {
    expect(can(null, "order:list")).toBe(false);
    expect(can(actor("owner", { storeId: undefined }), "order:list")).toBe(false);
    expect(can({ ...baseActor, displayName: "系统", isSystem: true }, "order:list")).toBe(false);
    expect(can(actor("owner", { storeRole: "legacy_role" as StoreRole }), "order:list")).toBe(
      false,
    );
  });

  it("requires explicit system context before allowing a system actor", () => {
    const systemActor: AuditActor = {
      ...baseActor,
      displayName: "系统",
      isSystem: true,
      role: "owner",
      storeRole: "owner",
    };

    expect(can(systemActor, "order:list")).toBe(false);
    expect(can(systemActor, "order:list", { allowSystemActor: true })).toBe(true);
  });

  it("uses active storeRole before global staff role", () => {
    const mixedActor = actor("viewer", { role: "owner", storeRole: "viewer" });

    expect(resolvePermissionRole(mixedActor)).toBe("viewer");
    expect(can(mixedActor, "order:create")).toBe(false);
  });

  it("does not grant store business permissions from platform admin status alone", () => {
    const platformActor: AuditActor = {
      ...baseActor,
      storeId: undefined,
      isPlatformAdmin: true,
      role: "owner",
      storeRole: undefined,
    };

    expect(can(platformActor, "order:list")).toBe(false);
    expect(can(platformActor, "support:grant")).toBe(false);
  });

  it("keeps sales as the internal frontdesk role", () => {
    expect(isStoreRoleFrontdesk("sales")).toBe(true);
    expect(can(actor("sales"), "order:create")).toBe(true);
    expect(can(actor("sales"), "payment:collect")).toBe(true);
    expect(can(actor("sales"), "payment:adjust")).toBe(false);
  });

  it("limits batch order transitions to owner and manager", () => {
    expect(getPermissionDecision(actor("owner"), "order:batch_transition")).toMatchObject({
      allowed: true,
      auditRequired: true,
      sensitive: true,
    });
    expect(can(actor("manager"), "order:batch_transition")).toBe(true);
    expect(can(actor("technician"), "order:batch_transition")).toBe(false);
    expect(can(actor("sales"), "order:batch_transition")).toBe(false);
    expect(can(actor("viewer"), "order:batch_transition")).toBe(false);
  });

  it("splits normal payment collection from high-risk money changes", () => {
    expect(can(actor("owner"), "payment:collect")).toBe(true);
    expect(can(actor("manager"), "payment:collect")).toBe(true);
    expect(can(actor("sales"), "payment:collect")).toBe(true);
    expect(can(actor("technician"), "payment:collect")).toBe(false);
    expect(can(actor("viewer"), "payment:collect")).toBe(false);

    expect(can(actor("owner"), "payment:adjust")).toBe(true);
    expect(can(actor("manager"), "payment:refund")).toBe(true);
    expect(can(actor("sales"), "payment:override")).toBe(false);
    expect(can(actor("technician"), "payment:adjust")).toBe(false);
  });

  it("requires owner for support grant and manager-role grants", () => {
    expect(can(actor("owner"), "support:grant")).toBe(true);
    expect(can(actor("manager"), "support:grant")).toBe(false);
    expect(can(actor("sales"), "support:grant")).toBe(false);

    expect(can(actor("owner"), "member:grant_manager")).toBe(true);
    expect(can(actor("manager"), "member:manage_basic")).toBe(true);
    expect(can(actor("manager"), "member:grant_manager")).toBe(false);
  });

  it("keeps supplier data owner-only unless an employee has an explicit grant", () => {
    expect(can(actor("owner"), "supplier:manage")).toBe(true);
    expect(can(actor("owner"), "supplier:read")).toBe(true);
    expect(can(actor("owner"), "supplier:assign")).toBe(true);

    expect(can(actor("manager"), "supplier:read")).toBe(false);
    expect(can(actor("manager"), "supplier:assign")).toBe(false);
    expect(can(actor("manager"), "supplier:manage")).toBe(false);
    expect(can(actor("sales"), "supplier:manage")).toBe(false);
    expect(can(actor("technician"), "supplier:manage")).toBe(false);
    expect(can(actor("viewer"), "supplier:manage")).toBe(false);

    expect(can(actor("sales", { permissionGrants: ["supplier:read"] }), "supplier:read")).toBe(
      true,
    );
    expect(can(actor("sales", { permissionGrants: ["supplier:assign"] }), "supplier:read")).toBe(
      true,
    );
    expect(can(actor("sales", { permissionGrants: ["supplier:assign"] }), "supplier:assign")).toBe(
      true,
    );
    expect(can(actor("sales", { permissionGrants: ["supplier:manage"] }), "supplier:assign")).toBe(
      true,
    );
    expect(can(actor("sales", { permissionGrants: ["supplier:read"] }), "supplier:assign")).toBe(
      false,
    );
  });

  it("treats owner removal and owner transfer as elevated actions even for owner", () => {
    expect(getPermissionDecision(actor("owner"), "member:remove_owner")).toMatchObject({
      allowed: false,
      effect: "elevated",
      reason: "elevated_approval_required",
    });
    expect(getPermissionDecision(actor("owner"), "member:transfer_owner")).toMatchObject({
      allowed: false,
      effect: "elevated",
      reason: "elevated_approval_required",
    });
  });

  it("allows audited exports only for owner role", () => {
    for (const action of ["order:export", "customer:export"] as const) {
      expect(getPermissionDecision(actor("owner"), action)).toMatchObject({
        allowed: true,
        auditRequired: true,
        sensitive: true,
      });
      expect(getPermissionDecision(actor("manager"), action)).toMatchObject({
        allowed: false,
        auditRequired: true,
        sensitive: true,
      });
      expect(can(actor("technician"), action)).toBe(false);
      expect(can(actor("sales"), action)).toBe(false);
      expect(can(actor("viewer"), action)).toBe(false);
    }
  });

  it("allows import preview and apply only for owner role", () => {
    for (const action of ["order:import_preview", "order:import_apply"] as const) {
      expect(getPermissionDecision(actor("owner"), action)).toMatchObject({
        allowed: true,
        auditRequired: true,
        sensitive: true,
      });
      for (const role of ["manager", "technician", "sales", "viewer"] as const) {
        expect(can(actor(role), action)).toBe(false);
      }
    }
  });

  it("requires scope for technician unlock credentials and signed attachment access", () => {
    expect(getPermissionDecision(actor("technician"), "unlock:read")).toMatchObject({
      allowed: false,
      effect: "scoped",
      scopeRequired: true,
      auditRequired: true,
    });
    expect(can(actor("technician"), "unlock:read", { scopeSatisfied: true })).toBe(true);
    expect(can(actor("sales"), "unlock:read", { scopeSatisfied: true })).toBe(false);
    expect(can(actor("viewer"), "unlock:read", { scopeSatisfied: true })).toBe(false);

    expect(can(actor("technician"), "attachment:read")).toBe(false);
    expect(can(actor("technician"), "attachment:read", { scopeSatisfied: true })).toBe(true);
    expect(getPermissionDecision(actor("viewer"), "attachment:read")).toMatchObject({
      allowed: false,
      effect: "scoped",
      auditRequired: true,
    });
  });

  it("marks high-risk actions as audit-required", () => {
    const highRiskActions = [
      "order:export",
      "order:batch_transition",
      "customer:export",
      "payment:adjust",
      "payment:refund",
      "payment:override",
      "inventory:write_off",
      "member:grant_manager",
      "support:grant",
      "supplier:read",
      "supplier:assign",
      "supplier:manage",
      "unlock:read",
      "attachment:read",
    ] as const;

    for (const action of highRiskActions) {
      expect(getPermissionDecision(actor("owner"), action).auditRequired, action).toBe(true);
    }
  });

  it("throws ForbiddenError when asserted permission is denied", () => {
    expect(() => assertPermission(actor("viewer"), "order:create")).toThrow(ForbiddenError);
    expect(assertPermission(actor("owner"), "order:create")).toMatchObject({
      allowed: true,
      role: "owner",
    });
  });
});
