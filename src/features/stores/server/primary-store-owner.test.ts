import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";

import { assertPrimaryStoreOwner, isPrimaryStoreOwner } from "./primary-store-owner";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => ({ from: mocks.from }),
}));

const owner: AuditActor = {
  id: "00000000-0000-0000-0000-000000000010",
  displayName: "Owner",
  storeId: "00000000-0000-0000-0000-000000000001",
  storeRole: "owner",
  activeStoreExplicit: true,
};

describe("primary store owner", () => {
  beforeEach(() => mocks.from.mockReset());

  it("requires both owner membership context and stores.owner_user_id", async () => {
    mocks.from.mockReturnValue(
      query({
        id: owner.storeId,
        owner_user_id: owner.id,
        status: "active",
      }),
    );

    await expect(isPrimaryStoreOwner(owner)).resolves.toBe(true);
    expect(mocks.from).toHaveBeenCalledWith("stores");
  });

  it("fails closed for a manager, implicit multi-store selection, or owner mismatch", async () => {
    await expect(isPrimaryStoreOwner({ ...owner, storeRole: "manager" })).resolves.toBe(false);
    await expect(isPrimaryStoreOwner({ ...owner, activeStoreExplicit: false })).resolves.toBe(
      false,
    );
    expect(mocks.from).not.toHaveBeenCalled();

    mocks.from.mockReturnValue(
      query({
        id: owner.storeId,
        owner_user_id: "00000000-0000-0000-0000-000000000099",
        status: "active",
      }),
    );
    await expect(isPrimaryStoreOwner(owner)).resolves.toBe(false);
  });

  it("returns a generic forbidden error when the actor is not the primary owner", async () => {
    mocks.from.mockReturnValue(query(null));
    await expect(assertPrimaryStoreOwner(owner)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

function query(data: unknown) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}
