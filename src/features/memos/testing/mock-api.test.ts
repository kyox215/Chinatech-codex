import { beforeEach, describe, expect, it } from "vitest";

import type { AuditActor, StoreRole } from "@/lib/repairdesk/types";

import {
  createMemo,
  getMemo,
  listMemos,
  resetMemoMockState,
  transitionMemo,
  updateMemo,
} from "./mock-api";

const actor = (storeId: string, membershipId: string, role: StoreRole): AuditActor => ({
  id: membershipId,
  displayName: role,
  storeId,
  activeMembershipId: membershipId,
  storeRole: role,
});

describe("memo mock parity", () => {
  beforeEach(resetMemoMockState);

  it("isolates Store A from Store B for list and guessed detail", async () => {
    const storeA = actor(
      "20000000-0000-4000-8000-000000000001",
      "30000000-0000-4000-8000-000000000001",
      "owner",
    );
    const storeB = actor(
      "20000000-0000-4000-8000-000000000002",
      "30000000-0000-4000-8000-000000000002",
      "owner",
    );
    const { memo } = await createMemo(
      { operationId: crypto.randomUUID(), kind: "note", title: "A", content: "private" },
      storeA,
    );
    expect((await listMemos({}, storeB)).items).toEqual([]);
    await expect(getMemo(memo.id, storeB)).rejects.toThrow("不存在");
    const listItem = (await listMemos({}, storeA)).items[0];
    expect(listItem).not.toHaveProperty("content");
    expect(listItem).not.toHaveProperty("store_id");
    expect(listItem).not.toHaveProperty("created_by_membership_id");
    await expect(getMemo(memo.id, storeA)).resolves.toMatchObject({ content: "private" });
  });

  it("keeps create idempotent and rejects stale versions", async () => {
    const owner = actor(
      "20000000-0000-4000-8000-000000000001",
      "30000000-0000-4000-8000-000000000001",
      "owner",
    );
    const operationId = crypto.randomUUID();
    const input = { operationId, kind: "todo" as const, title: "交班", content: "检查库存" };
    const first = await createMemo(input, owner);
    const replay = await createMemo(input, owner);
    expect(replay.memo.id).toBe(first.memo.id);
    expect(replay).toMatchObject({ replayed: true, appliedVersion: 1 });
    await expect(
      createMemo({ ...input, title: "交|班", content: "检查|库存" }, owner),
    ).rejects.toMatchObject({ status: 409 });
    await updateMemo(
      {
        operationId: crypto.randomUUID(),
        id: first.memo.id,
        expectedVersion: 1,
        title: "已更新",
        content: "",
      },
      owner,
    );
    await expect(
      transitionMemo(
        {
          operationId: crypto.randomUUID(),
          id: first.memo.id,
          expectedVersion: 1,
          transition: "complete",
        },
        owner,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("keeps viewer read-only and staff scoped", async () => {
    const owner = actor(
      "20000000-0000-4000-8000-000000000001",
      "30000000-0000-4000-8000-000000000001",
      "owner",
    );
    const viewer = actor(owner.storeId!, "30000000-0000-4000-8000-000000000002", "viewer");
    const tech = actor(owner.storeId!, "30000000-0000-4000-8000-000000000003", "technician");
    const { memo } = await createMemo(
      { operationId: crypto.randomUUID(), kind: "note", title: "只读", content: "" },
      owner,
    );
    await expect(
      createMemo(
        { operationId: crypto.randomUUID(), kind: "note", title: "X", content: "" },
        viewer,
      ),
    ).rejects.toThrow("查看权限");
    await expect(
      updateMemo(
        {
          operationId: crypto.randomUUID(),
          id: memo.id,
          expectedVersion: 1,
          title: "越权",
          content: "",
        },
        tech,
      ),
    ).rejects.toThrow("没有权限");
  });

  it("matches production ordering for pending, completed, and note rows", async () => {
    const owner = actor(
      "20000000-0000-4000-8000-000000000001",
      "30000000-0000-4000-8000-000000000001",
      "owner",
    );
    const note = await createMemo(
      { operationId: crypto.randomUUID(), kind: "note", title: "记录", content: "" },
      owner,
    );
    const completed = await createMemo(
      {
        operationId: crypto.randomUUID(),
        kind: "todo",
        title: "已完成",
        content: "",
        dueAt: "2028-01-01T00:00:00.000Z",
      },
      owner,
    );
    const pendingLate = await createMemo(
      {
        operationId: crypto.randomUUID(),
        kind: "todo",
        title: "稍后",
        content: "",
        dueAt: "2030-01-01T00:00:00.000Z",
      },
      owner,
    );
    const pendingEarly = await createMemo(
      {
        operationId: crypto.randomUUID(),
        kind: "todo",
        title: "先处理",
        content: "",
        dueAt: "2029-01-01T00:00:00.000Z",
      },
      owner,
    );
    const pendingNoDue = await createMemo(
      { operationId: crypto.randomUUID(), kind: "todo", title: "无期限", content: "" },
      owner,
    );
    await transitionMemo(
      {
        operationId: crypto.randomUUID(),
        id: completed.memo.id,
        expectedVersion: 1,
        transition: "complete",
      },
      owner,
    );

    expect((await listMemos({}, owner)).items.map((item) => item.id)).toEqual([
      pendingEarly.memo.id,
      pendingLate.memo.id,
      pendingNoDue.memo.id,
      completed.memo.id,
      note.memo.id,
    ]);
  });
});
