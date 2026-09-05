import { describe, expect, it } from "vitest";

import type { StoreMember } from "@/lib/repairdesk/types";
import {
  createMemberEditorDraft,
  getMemberPermissionOptions,
  getMemberRoleLabels,
  getMemberStatusLabels,
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
    expect(
      visibleMemberPermissionOptions("manager", false).some((option) =>
        [
          "finance:cost_export",
          "finance:cost_backfill_preview",
          "inventory:cost_allocate",
        ].includes(option.action),
      ),
    ).toBe(false);
  });

  it("preserves stored cost grants when the editor hides them", () => {
    const manager: StoreMember = {
      ...member,
      role: "manager",
      permission_grants: ["finance:cost_manage", "finance:cost_export", "inventory:cost_allocate"],
    };

    expect(createMemberEditorDraft(manager).permissions).toEqual([
      "finance:aggregate_read",
      "finance:profit_read",
      "finance:cost_manage",
      "finance:cost_export",
      "inventory:cost_allocate",
    ]);
    expect(visibleMemberPermissionOptions("manager", false)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "finance:cost_manage" }),
        expect.objectContaining({ action: "finance:cost_export" }),
        expect.objectContaining({ action: "inventory:cost_allocate" }),
      ]),
    );
  });

  it("adds prerequisite grants for phase-two cost capabilities", () => {
    const exportDraft = updateMemberEditorPermission(
      { role: "manager", permissions: [] },
      "finance:cost_export",
      true,
    );
    expect(exportDraft.permissions).toEqual([
      "finance:aggregate_read",
      "finance:profit_read",
      "finance:cost_export",
    ]);

    const allocationDraft = updateMemberEditorPermission(
      { role: "manager", permissions: [] },
      "inventory:cost_allocate",
      true,
    );
    expect(allocationDraft.permissions).toEqual(["finance:cost_manage", "inventory:cost_allocate"]);
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

  it("localizes presentation without changing stable role, status, action, or group codes", () => {
    const zh = getMemberPermissionOptions("zh-CN");
    const it = getMemberPermissionOptions("it-IT");
    const en = getMemberPermissionOptions("en");

    expect(it.map(({ action, group, sensitive }) => ({ action, group, sensitive }))).toEqual(
      zh.map(({ action, group, sensitive }) => ({ action, group, sensitive })),
    );
    expect(en.map(({ action, group, sensitive }) => ({ action, group, sensitive }))).toEqual(
      zh.map(({ action, group, sensitive }) => ({ action, group, sensitive })),
    );
    expect(it.flatMap(({ label, description }) => [label, description]).join(" ")).not.toMatch(
      /[\u3400-\u9fff]/u,
    );
    expect(en.flatMap(({ label, description }) => [label, description]).join(" ")).not.toMatch(
      /[\u3400-\u9fff]/u,
    );
    expect(zh[0].label).toBe("浏览历史归档");
    expect(it[0].label).toBe("Consulta archivio storico");
    expect(en[0].label).toBe("Browse historical archive");
    expect(getMemberRoleLabels("it-IT").technician).toBe("Tecnico");
    expect(getMemberRoleLabels("en").sales).toBe("Front desk");
    expect(getMemberStatusLabels("it-IT").inactive).toBe("Disattivato");
    expect(getMemberStatusLabels("en").invited).toBe("Pending");
    expect(Object.values(getMemberRoleLabels("it-IT")).join(" ")).not.toMatch(/[\u3400-\u9fff]/u);
    expect(Object.values(getMemberStatusLabels("en")).join(" ")).not.toMatch(/[\u3400-\u9fff]/u);
  });
});
