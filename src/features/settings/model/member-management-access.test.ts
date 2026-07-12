import { describe, expect, it } from "vitest";

import {
  canManageStoreMemberRole,
  canManageStoreMemberStatus,
} from "@/features/settings/model/member-management-access";
import type { StoreMember } from "@/lib/repairdesk/types";

describe("member management access", () => {
  it("never allows the active membership to change its own role or status", () => {
    const current = member({ id: "membership-current", role: "manager" });

    expect(canManageStoreMemberRole("owner", current, "membership-current", "technician")).toBe(
      false,
    );
    expect(canManageStoreMemberStatus("owner", current, "membership-current")).toBe(false);
  });

  it("keeps owner and manager boundaries for other memberships", () => {
    const technician = member({ id: "membership-other", role: "technician" });
    const manager = member({ id: "membership-manager", role: "manager" });

    expect(canManageStoreMemberRole("owner", technician, "membership-current", "manager")).toBe(
      true,
    );
    expect(canManageStoreMemberRole("manager", technician, "membership-current", "manager")).toBe(
      false,
    );
    expect(canManageStoreMemberStatus("manager", manager, "membership-current")).toBe(false);
    expect(canManageStoreMemberStatus("manager", technician, "membership-current")).toBe(true);
  });
});

function member(overrides: Partial<StoreMember>): StoreMember {
  return {
    id: "membership-1",
    user_id: "user-1",
    email: "staff@example.com",
    display_name: "Staff",
    role: "technician",
    status: "active",
    created_at: "2026-07-12T00:00:00.000Z",
    updated_at: "2026-07-12T00:00:00.000Z",
    ...overrides,
  };
}
