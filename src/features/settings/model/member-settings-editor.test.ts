import { describe, expect, it } from "vitest";

import type { StoreMember } from "@/lib/repairdesk/types";
import {
  createMemberEditorDraft,
  isMemberEditorDraftChanged,
  isMemberEditorDraftDirty,
  isSensitiveMemberEditorChange,
  updateMemberEditorPermission,
  updateMemberEditorRole,
  visibleMemberPermissionOptions,
} from "./member-settings-editor";

const member: StoreMember = {
  id: "member-1",
  user_id: "user-1",
  email: "staff@example.com",
  display_name: "Staff",
  role: "technician",
  status: "active",
  permission_grants: ["supplier:read"],
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

describe("member settings editor", () => {
  it("creates a role-bound local draft without mutating the member", () => {
    const draft = createMemberEditorDraft(member);
    expect(draft).toEqual({ role: "technician", permissions: ["supplier:read"] });
    expect(isMemberEditorDraftDirty(member, draft)).toBe(false);
  });

  it("treats the last saved draft as the navigation-guard base", () => {
    const saved = { role: "technician" as const, permissions: ["supplier:read" as const] };
    expect(isMemberEditorDraftChanged(saved, { ...saved })).toBe(false);
    expect(
      isMemberEditorDraftChanged(saved, {
        role: "technician",
        permissions: ["supplier:read", "supplier:assign"],
      }),
    ).toBe(true);
  });

  it("normalizes dependent grants while the user edits one local draft", () => {
    let draft = createMemberEditorDraft(member);
    draft = updateMemberEditorPermission(draft, "supplier:manage", true);
    expect(draft.permissions).toEqual(["supplier:read", "supplier:assign", "supplier:manage"]);
    draft = updateMemberEditorPermission(draft, "supplier:read", false);
    expect(draft.permissions).toEqual([]);
  });

  it("drops role-ineligible grants when changing role", () => {
    const manager: StoreMember = {
      ...member,
      role: "manager",
      permission_grants: ["finance:profit_read"],
    };
    const draft = updateMemberEditorRole(createMemberEditorDraft(manager), "sales");
    expect(draft.permissions).toEqual([]);
    expect(visibleMemberPermissionOptions("viewer")).toEqual([]);
  });

  it("offers repair cost management only to managers without adding profit access", () => {
    const managerOptions = visibleMemberPermissionOptions("manager");
    expect(managerOptions.some((option) => option.action === "finance:cost_manage")).toBe(true);
    expect(
      visibleMemberPermissionOptions("technician").some(
        (option) => option.action === "finance:cost_manage",
      ),
    ).toBe(false);
    expect(
      visibleMemberPermissionOptions("sales").some(
        (option) => option.action === "finance:cost_manage",
      ),
    ).toBe(false);

    const draft = updateMemberEditorPermission(
      { role: "manager", permissions: [] },
      "finance:cost_manage",
      true,
    );
    expect(draft.permissions).toEqual(["finance:cost_manage"]);
    expect(draft.permissions).not.toContain("finance:profit_read");
    expect(draft.permissions).not.toContain("finance:aggregate_read");
  });

  it("hides repair cost management while the rollout flag is off", () => {
    expect(
      visibleMemberPermissionOptions("manager", false).some(
        (option) => option.action === "finance:cost_manage",
      ),
    ).toBe(false);
  });

  it("marks manager elevation and newly added sensitive grants for confirmation", () => {
    expect(isSensitiveMemberEditorChange(member, { role: "manager", permissions: [] })).toBe(true);
    expect(
      isSensitiveMemberEditorChange(
        { ...member, role: "manager", permission_grants: [] },
        { role: "manager", permissions: ["finance:aggregate_read"] },
      ),
    ).toBe(true);
    expect(
      isSensitiveMemberEditorChange(
        { ...member, role: "manager", permission_grants: [] },
        { role: "manager", permissions: ["finance:cost_manage"] },
      ),
    ).toBe(true);
  });
});
