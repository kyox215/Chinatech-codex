import { describe, expect, it } from "vitest";

import type { AuditActor, StoreRole } from "@/lib/repairdesk/types";

import { memoCapabilities, memoRowCapabilities, requireMemoActor } from "./memo-policy";

const actor = (role: StoreRole): AuditActor => ({
  id: "10000000-0000-4000-8000-000000000001",
  displayName: role,
  storeId: "20000000-0000-4000-8000-000000000001",
  activeMembershipId: "30000000-0000-4000-8000-000000000001",
  storeRole: role,
});

describe("memo permission policy", () => {
  it("keeps viewer read-only and owner/manager able to archive", () => {
    expect(memoCapabilities(requireMemoActor(actor("viewer")))).toMatchObject({
      canRead: true,
      canCreate: false,
      canArchive: false,
    });
    expect(memoCapabilities(requireMemoActor(actor("manager")))).toMatchObject({
      canCreate: true,
      canEditAny: true,
      canArchive: true,
    });
  });

  it("scopes staff writes to creator/assignee but permits atomic claim", () => {
    const technician = requireMemoActor(actor("technician"));
    const base = {
      created_by_membership_id: "other",
      assignee_membership_id: null,
      kind: "todo" as const,
      todo_status: "pending" as const,
      archived_at: null,
    };
    expect(memoRowCapabilities(technician, base)).toMatchObject({
      canEdit: false,
      canClaim: true,
      canTransition: false,
      canArchive: false,
    });
    expect(
      memoRowCapabilities(technician, {
        ...base,
        assignee_membership_id: technician.activeMembershipId,
      }),
    ).toMatchObject({ canEdit: false, canTransition: true });
    expect(
      memoRowCapabilities(technician, {
        ...base,
        created_by_membership_id: technician.activeMembershipId,
      }),
    ).toMatchObject({ canEdit: true, canTransition: true });
  });

  it("rejects platform/system actors without an active membership", () => {
    expect(() => requireMemoActor({ isSystem: true, displayName: "系统" })).toThrow();
    expect(() =>
      requireMemoActor({ id: "user", displayName: "平台", isPlatformAdmin: true }),
    ).toThrow();
  });

  it("fails closed for a multi-store actor without an explicit valid selection", () => {
    const multiStore = {
      ...actor("owner"),
      activeStoreExplicit: false,
      stores: [
        {
          id: "20000000-0000-4000-8000-000000000001",
          name: "A",
          slug: "a",
          role: "owner" as const,
          status: "active" as const,
        },
        {
          id: "20000000-0000-4000-8000-000000000002",
          name: "B",
          slug: "b",
          role: "owner" as const,
          status: "active" as const,
        },
      ],
    };
    expect(() => requireMemoActor(multiStore)).toThrow("明确选择");
    expect(() => requireMemoActor({ ...multiStore, activeStoreExplicit: true })).not.toThrow();
  });

  it("keeps the single-store fallback usable but rejects an invalid-cookie multi-store fallback", () => {
    const singleStore = {
      ...actor("owner"),
      activeStoreExplicit: false,
      stores: [
        {
          id: "20000000-0000-4000-8000-000000000001",
          name: "A",
          slug: "a",
          role: "owner" as const,
          status: "active" as const,
        },
      ],
    };
    expect(() => requireMemoActor(singleStore)).not.toThrow();
    expect(() =>
      requireMemoActor({
        ...singleStore,
        stores: [
          ...singleStore.stores,
          {
            id: "20000000-0000-4000-8000-000000000002",
            name: "B",
            slug: "b",
            role: "owner" as const,
            status: "active" as const,
          },
        ],
      }),
    ).toThrow("明确选择");
  });
});
