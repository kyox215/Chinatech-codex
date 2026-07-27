import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor } from "@/lib/repairdesk/types";

const repository = vi.hoisted(() => ({
  consumeMemoAttempt: vi.fn(),
  listMemos: vi.fn(),
  getMemo: vi.fn(),
  getMemoSummary: vi.fn(),
  listMemoAssignees: vi.fn(),
  mutateMemoRpc: vi.fn(),
}));

vi.mock("./memo.repository", () => repository);

import { readMemoList } from "./memo.service";

const storeA = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "A",
  slug: "a",
  role: "owner" as const,
  status: "active" as const,
};
const actor: AuditActor = {
  id: "10000000-0000-4000-8000-000000000001",
  displayName: "Owner",
  storeId: storeA.id,
  activeMembershipId: "30000000-0000-4000-8000-000000000001",
  storeRole: "owner",
  activeStoreExplicit: true,
  stores: [storeA],
};

describe("memo service authority and attempt fences", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("REPAIRDESK_MEMOS_ENABLED", "1");
    vi.stubEnv("REPAIRDESK_MEMOS_STORE_ALLOWLIST", storeA.id);
    repository.listMemos.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it("consumes a durable read attempt before rejecting an invalid multi-store selection", async () => {
    const invalidCookieActor: AuditActor = {
      ...actor,
      activeStoreExplicit: false,
      stores: [
        storeA,
        {
          ...storeA,
          id: "20000000-0000-4000-8000-000000000002",
          name: "B",
          slug: "b",
        },
      ],
    };

    await expect(readMemoList({}, invalidCookieActor)).rejects.toThrow("明确选择");
    expect(repository.consumeMemoAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: storeA.id }),
      "read",
    );
    expect(repository.listMemos).not.toHaveBeenCalled();
  });

  it("keeps the explicit single-store read path available", async () => {
    await expect(readMemoList({}, actor)).resolves.toMatchObject({ items: [] });
    expect(repository.consumeMemoAttempt).toHaveBeenCalledOnce();
    expect(repository.listMemos).toHaveBeenCalledOnce();
  });
});
