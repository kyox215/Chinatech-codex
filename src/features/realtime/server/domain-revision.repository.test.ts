import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  from: vi.fn(),
  in: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => ({ from: mocks.from }),
}));

import { getRepairDeskDomainRevisions } from "./domain-revision.repository";

const storeId = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";

describe("getRepairDeskDomainRevisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ in: mocks.in });
  });

  it("scopes the sentinel read to the actor store and returns string revisions", async () => {
    mocks.in.mockResolvedValue({ data: [{ domain: "orders", version: 42 }], error: null });

    await expect(
      getRepairDeskDomainRevisions(["orders"], {
        id: "user_1",
        displayName: "Owner",
        role: "owner",
        storeId,
      }),
    ).resolves.toEqual({ revisions: { orders: "42" } });

    expect(mocks.from).toHaveBeenCalledWith("repairdesk_store_domain_versions");
    expect(mocks.eq).toHaveBeenCalledWith("store_id", storeId);
    expect(mocks.in).toHaveBeenCalledWith("domain", ["orders"]);
  });

  it("returns zero when a store has not written that domain yet", async () => {
    mocks.in.mockResolvedValue({ data: [], error: null });

    await expect(
      getRepairDeskDomainRevisions(["orders"], {
        id: "user_1",
        displayName: "Owner",
        role: "owner",
        storeId,
      }),
    ).resolves.toEqual({ revisions: { orders: "0" } });
  });
});
