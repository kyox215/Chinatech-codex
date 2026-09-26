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

import { readMemoList, updateMemoChecklistItem } from "./memo.service";

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

  it("reads the resolved current store for a multi-store actor without extra confirmation", async () => {
    const resolvedStoreActor: AuditActor = {
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

    await expect(readMemoList({}, resolvedStoreActor)).resolves.toMatchObject({ items: [] });
    expect(repository.consumeMemoAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: storeA.id }),
      "read",
    );
    expect(repository.listMemos).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: storeA.id }),
      {},
    );
  });

  it("keeps the explicit single-store read path available", async () => {
    await expect(readMemoList({}, actor)).resolves.toMatchObject({ items: [] });
    expect(repository.consumeMemoAttempt).toHaveBeenCalledOnce();
    expect(repository.listMemos).toHaveBeenCalledOnce();
  });

  it("passes desired checklist state through the scoped transition authority", async () => {
    const technician: AuditActor = {
      ...actor,
      storeRole: "technician",
      activeMembershipId: "30000000-0000-4000-8000-000000000009",
    };
    repository.getMemo.mockResolvedValue({
      created_by_membership_id: actor.activeMembershipId,
      assignee_membership_id: technician.activeMembershipId,
    });
    repository.mutateMemoRpc.mockResolvedValue({ memo: {}, replayed: false, appliedVersion: 2 });
    const input = {
      operationId: "40000000-0000-4000-8000-000000000001",
      id: "50000000-0000-4000-8000-000000000001",
      expectedVersion: 1,
      itemId: "60000000-0000-4000-8000-000000000001",
      completed: true,
    };

    await updateMemoChecklistItem(input, technician);

    expect(repository.mutateMemoRpc).toHaveBeenCalledWith(
      expect.objectContaining({ activeMembershipId: technician.activeMembershipId }),
      {
        operation: "set_checklist_item",
        operationId: input.operationId,
        memoId: input.id,
        expectedVersion: 1,
        checklistItemId: input.itemId,
        checklistItemCompleted: true,
      },
    );
  });

  it("rejects an out-of-scope employee checklist transition before the RPC", async () => {
    const technician: AuditActor = {
      ...actor,
      storeRole: "technician",
      activeMembershipId: "30000000-0000-4000-8000-000000000009",
    };
    repository.getMemo.mockResolvedValue({
      created_by_membership_id: actor.activeMembershipId,
      assignee_membership_id: null,
    });

    await expect(
      updateMemoChecklistItem(
        {
          operationId: "40000000-0000-4000-8000-000000000002",
          id: "50000000-0000-4000-8000-000000000001",
          expectedVersion: 1,
          itemId: "60000000-0000-4000-8000-000000000001",
          completed: true,
        },
        technician,
      ),
    ).rejects.toThrow("当前员工没有权限执行此操作");
    expect(repository.mutateMemoRpc).not.toHaveBeenCalled();
  });
});
