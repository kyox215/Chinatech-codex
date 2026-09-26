import type {
  MemoArchiveInput,
  MemoAssignee,
  MemoChecklistItemUpdateInput,
  MemoCreateInput,
  MemoListInput,
  MemoListResult,
  MemoMutationResult,
  MemoSummary,
  MemoTransitionInput,
  MemoUpdateInput,
  StoreMemo,
} from "@/features/memos/model/contracts";
import type { AuditActor, StoreRole } from "@/lib/repairdesk/types";
import { getActiveMockStoreId } from "@/features/stores/testing/mock-api";
import { checklistCounts, checklistStatus } from "@/features/memos/model/memo-checklist";

const rows: StoreMemo[] = [];
const operationReceipts = new Map<string, { hash: string; id: string; appliedVersion: number }>();

function mockIdentity(actor?: AuditActor) {
  return {
    storeId: actor?.storeId ?? getActiveMockStoreId(),
    membershipId: actor?.activeMembershipId ?? "10000000-0000-4000-8000-000000000001",
    role: (actor?.storeRole ?? actor?.role ?? "owner") as StoreRole,
    name: actor?.displayName ?? "店铺管理员",
  };
}

export async function listMemos(
  input: MemoListInput = {},
  actor?: AuditActor,
): Promise<MemoListResult> {
  const identity = mockIdentity(actor);
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  const now = Date.now();
  const filtered = rows
    .filter((memo) => memo.store_id === identity.storeId)
    .filter((memo) => {
      switch (input.view ?? "active") {
        case "active":
          return !memo.archived_at;
        case "pending":
          return !memo.archived_at && memo.todo_status === "pending";
        case "mine":
          return (
            !memo.archived_at &&
            memo.todo_status === "pending" &&
            memo.assignee_membership_id === identity.membershipId
          );
        case "overdue":
          return (
            !memo.archived_at &&
            memo.todo_status === "pending" &&
            Boolean(memo.due_at && new Date(memo.due_at).getTime() < now)
          );
        case "completed":
          return !memo.archived_at && memo.todo_status === "completed";
        case "archived":
          return Boolean(memo.archived_at);
        case "all":
          return true;
      }
    })
    .filter((memo) => !input.kind || input.kind === "all" || memo.kind === input.kind)
    .filter(
      (memo) =>
        !input.assigneeMembershipId || memo.assignee_membership_id === input.assigneeMembershipId,
    )
    .filter((memo) => {
      const search = input.search?.trim().toLocaleLowerCase();
      return (
        !search ||
        `${memo.title}\n${memo.content}\n${memo.checklist.map((item) => item.text).join("\n")}`
          .toLocaleLowerCase()
          .includes(search)
      );
    })
    .sort(compareMemos)
    .map((memo) => toListItem(memo, identity));
  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(filtered.length / pageSize)),
    capabilities: {
      canRead: true,
      canCreate: identity.role !== "viewer",
      canEditAny: ["owner", "manager"].includes(identity.role),
      canArchive: ["owner", "manager"].includes(identity.role),
      canAssignAny: ["owner", "manager"].includes(identity.role),
      membershipId: identity.membershipId,
      role: identity.role,
    },
  };
}

export async function getMemo(id: string, actor?: AuditActor) {
  const identity = mockIdentity(actor);
  const memo = findMemo(id, identity.storeId);
  if (!memo) throw new Error("备忘录不存在");
  return {
    ...memo,
    checklist: memo.checklist.map((item) => ({ ...item })),
    capabilities: rowCapabilities(memo, identity),
  };
}

export async function getMemoSummary(actor?: AuditActor): Promise<MemoSummary> {
  const identity = mockIdentity(actor);
  const storeRows = rows.filter((memo) => memo.store_id === identity.storeId && !memo.archived_at);
  return {
    pending: storeRows.filter((memo) => memo.todo_status === "pending").length,
    overdue: storeRows.filter(
      (memo) =>
        memo.todo_status === "pending" &&
        memo.due_at &&
        new Date(memo.due_at).getTime() < Date.now(),
    ).length,
    mine: storeRows.filter(
      (memo) =>
        memo.todo_status === "pending" && memo.assignee_membership_id === identity.membershipId,
    ).length,
    completed: storeRows.filter((memo) => memo.todo_status === "completed").length,
  };
}

export async function listMemoAssignees(actor?: AuditActor): Promise<MemoAssignee[]> {
  const identity = mockIdentity(actor);
  return [{ membershipId: identity.membershipId, displayName: identity.name, role: identity.role }];
}

export async function createMemo(input: MemoCreateInput, actor?: AuditActor) {
  const identity = mockIdentity(actor);
  assertWritable(identity.role);
  const hash = JSON.stringify(input);
  const receiptKey = `${identity.storeId}:${identity.membershipId}:${input.operationId}`;
  const receipt = operationReceipts.get(receiptKey);
  if (receipt) {
    if (receipt.hash !== hash) throw conflict();
    const memo = await getMemo(receipt.id, actor);
    return mutationResult(memo, true, receipt.appliedVersion);
  }
  if (
    ["technician", "sales"].includes(identity.role) &&
    input.assigneeMembershipId &&
    input.assigneeMembershipId !== identity.membershipId
  ) {
    throw new Error("当前员工没有权限分配给其他成员");
  }
  const now = new Date().toISOString();
  const checklist =
    input.kind === "todo" ? (input.checklist ?? []).map((item) => ({ ...item })) : [];
  const counts = checklistCounts(checklist);
  const initialStatus = input.kind === "todo" ? checklistStatus(checklist, "pending") : null;
  const memo: StoreMemo = {
    id: crypto.randomUUID(),
    store_id: identity.storeId,
    kind: input.kind,
    title: input.title.trim(),
    content: input.content,
    todo_status: initialStatus,
    due_at: input.kind === "todo" ? (input.dueAt ?? null) : null,
    assignee_membership_id: input.kind === "todo" ? (input.assigneeMembershipId ?? null) : null,
    assignee_name: input.assigneeMembershipId ? identity.name : null,
    created_by_membership_id: identity.membershipId,
    created_by_name_snapshot: identity.name,
    updated_by_name_snapshot: identity.name,
    completed_at: initialStatus === "completed" ? now : null,
    archived_at: null,
    version: 1,
    created_at: now,
    updated_at: now,
    checklist,
    checklist_total: counts.total,
    checklist_completed: counts.completed,
    capabilities: {
      canEdit: true,
      canClaim: input.kind === "todo" && !input.assigneeMembershipId,
      canTransition: input.kind === "todo",
      canArchive: ["owner", "manager"].includes(identity.role),
      canRestore: false,
    },
  };
  rows.push(memo);
  operationReceipts.set(receiptKey, { hash, id: memo.id, appliedVersion: memo.version });
  return mutationResult(memo);
}

export async function updateMemo(input: MemoUpdateInput, actor?: AuditActor) {
  const identity = mockIdentity(actor);
  const replay = await replayReceipt("update", input, identity, actor);
  if (replay) return replay;
  const memo = findMemo(input.id, identity.storeId);
  if (!memo) throw new Error("备忘录不存在");
  assertWritable(identity.role);
  if (
    !["owner", "manager"].includes(identity.role) &&
    memo.created_by_membership_id !== identity.membershipId
  ) {
    throw new Error("当前员工没有权限编辑这条备忘");
  }
  if (memo.version !== input.expectedVersion) throw conflict();
  if (
    !["owner", "manager"].includes(identity.role) &&
    input.assigneeMembershipId !== memo.assignee_membership_id &&
    !(memo.assignee_membership_id === null && input.assigneeMembershipId === identity.membershipId)
  ) {
    throw new Error("当前员工没有权限变更负责人");
  }
  memo.title = input.title.trim();
  memo.content = input.content;
  if (memo.kind === "todo") {
    memo.due_at = input.dueAt ?? null;
    memo.assignee_membership_id = input.assigneeMembershipId ?? null;
    if (input.checklist !== undefined) {
      const previousStatus = memo.todo_status ?? "pending";
      memo.checklist = input.checklist.map((item) => ({ ...item }));
      syncChecklistAggregate(memo, previousStatus);
    }
  }
  touch(memo, identity.name);
  saveReceipt("update", input, identity, memo);
  return mutationResult(memo);
}

export async function transitionMemo(input: MemoTransitionInput, actor?: AuditActor) {
  const identity = mockIdentity(actor);
  const replay = await replayReceipt(input.transition, input, identity, actor);
  if (replay) return replay;
  const memo = findMemo(input.id, identity.storeId);
  if (!memo) throw new Error("备忘录不存在");
  assertWritable(identity.role);
  if (memo.version !== input.expectedVersion) throw conflict();
  if (memo.kind !== "todo" || memo.archived_at) throw conflict();
  if (input.transition === "claim") {
    if (memo.assignee_membership_id) throw conflict();
    memo.assignee_membership_id = identity.membershipId;
    memo.assignee_name = identity.name;
  } else {
    assertScope(memo, identity);
    if (memo.checklist.length) throw checklistManagedConflict();
    memo.todo_status = input.transition === "complete" ? "completed" : "pending";
    memo.completed_at = input.transition === "complete" ? new Date().toISOString() : null;
  }
  touch(memo, identity.name);
  saveReceipt(input.transition, input, identity, memo);
  return mutationResult(memo);
}

export async function updateMemoChecklistItem(
  input: MemoChecklistItemUpdateInput,
  actor?: AuditActor,
) {
  const identity = mockIdentity(actor);
  const replay = await replayReceipt("set_checklist_item", input, identity, actor);
  if (replay) return replay;
  const memo = findMemo(input.id, identity.storeId);
  if (!memo) throw new Error("备忘录不存在");
  assertScope(memo, identity);
  if (memo.version !== input.expectedVersion) throw conflict();
  if (memo.kind !== "todo" || memo.archived_at) throw conflict();
  const item = memo.checklist.find((candidate) => candidate.id === input.itemId);
  if (!item) throw conflict();
  item.completed = input.completed;
  syncChecklistAggregate(memo, memo.todo_status ?? "pending");
  touch(memo, identity.name);
  saveReceipt("set_checklist_item", input, identity, memo);
  return mutationResult(memo);
}

export async function archiveMemo(input: MemoArchiveInput, actor?: AuditActor) {
  return setArchived(input, true, actor);
}

export async function restoreMemo(input: MemoArchiveInput, actor?: AuditActor) {
  return setArchived(input, false, actor);
}

function setArchived(input: MemoArchiveInput, archived: boolean, actor?: AuditActor) {
  const identity = mockIdentity(actor);
  if (!["owner", "manager"].includes(identity.role)) throw new Error("当前员工没有权限归档");
  const operation = archived ? "archive" : "restore";
  return replayReceipt(operation, input, identity, actor).then((replay) => {
    if (replay) return replay;
    const memo = rows.find((item) => item.id === input.id && item.store_id === identity.storeId);
    if (!memo) throw new Error("备忘录不存在");
    if (memo.version !== input.expectedVersion) throw conflict();
    memo.archived_at = archived ? new Date().toISOString() : null;
    touch(memo, identity.name);
    saveReceipt(operation, input, identity, memo);
    return mutationResult(memo);
  });
}

function touch(memo: StoreMemo, name: string) {
  memo.version += 1;
  memo.updated_at = new Date().toISOString();
  memo.updated_by_name_snapshot = name;
}

function syncChecklistAggregate(memo: StoreMemo, emptyFallback: "pending" | "completed") {
  const counts = checklistCounts(memo.checklist);
  memo.checklist_total = counts.total;
  memo.checklist_completed = counts.completed;
  const nextStatus = checklistStatus(memo.checklist, emptyFallback);
  memo.todo_status = nextStatus;
  memo.completed_at =
    nextStatus === "completed" ? (memo.completed_at ?? new Date().toISOString()) : null;
}

function findMemo(id: string, storeId: string) {
  return rows.find((item) => item.id === id && item.store_id === storeId);
}

function assertWritable(role: StoreRole) {
  if (role === "viewer") throw new Error("当前员工只有查看权限");
}

function assertScope(memo: StoreMemo, identity: ReturnType<typeof mockIdentity>) {
  assertWritable(identity.role);
  if (["owner", "manager"].includes(identity.role)) return;
  if (
    memo.created_by_membership_id !== identity.membershipId &&
    memo.assignee_membership_id !== identity.membershipId
  ) {
    throw new Error("当前员工没有权限编辑这条备忘");
  }
}

function rowCapabilities(memo: StoreMemo, identity: ReturnType<typeof mockIdentity>) {
  const manager = ["owner", "manager"].includes(identity.role);
  const isCreator = memo.created_by_membership_id === identity.membershipId;
  const transitionInScope =
    manager || isCreator || memo.assignee_membership_id === identity.membershipId;
  return {
    canEdit: identity.role !== "viewer" && !memo.archived_at && (manager || isCreator),
    canClaim:
      identity.role !== "viewer" &&
      !memo.archived_at &&
      memo.kind === "todo" &&
      memo.todo_status === "pending" &&
      !memo.assignee_membership_id,
    canTransition:
      identity.role !== "viewer" && !memo.archived_at && memo.kind === "todo" && transitionInScope,
    canArchive: manager && !memo.archived_at,
    canRestore: manager && Boolean(memo.archived_at),
  };
}

function toListItem(memo: StoreMemo, identity: ReturnType<typeof mockIdentity>) {
  const {
    store_id: _storeId,
    content: _content,
    created_by_membership_id: _creatorId,
    checklist: _checklist,
    ...item
  } = {
    ...memo,
    capabilities: rowCapabilities(memo, identity),
  };
  return item;
}

function mutationResult(
  memo: StoreMemo,
  replayed = false,
  appliedVersion = memo.version,
): MemoMutationResult {
  return {
    memo: { ...memo, checklist: memo.checklist.map((item) => ({ ...item })) },
    replayed,
    appliedVersion,
  };
}

async function replayReceipt(
  operation: string,
  input: { operationId: string },
  identity: ReturnType<typeof mockIdentity>,
  actor?: AuditActor,
) {
  const receipt = operationReceipts.get(receiptKey(identity, input.operationId));
  if (!receipt) return null;
  if (receipt.hash !== JSON.stringify({ operation, input })) throw conflict();
  return mutationResult(await getMemo(receipt.id, actor), true, receipt.appliedVersion);
}

function saveReceipt(
  operation: string,
  input: { operationId: string },
  identity: ReturnType<typeof mockIdentity>,
  memo: StoreMemo,
) {
  operationReceipts.set(receiptKey(identity, input.operationId), {
    hash: JSON.stringify({ operation, input }),
    id: memo.id,
    appliedVersion: memo.version,
  });
}

function receiptKey(identity: ReturnType<typeof mockIdentity>, operationId: string) {
  return `${identity.storeId}:${identity.membershipId}:${operationId}`;
}

function compareMemos(left: StoreMemo, right: StoreMemo) {
  const rank = (memo: StoreMemo) =>
    memo.todo_status === "pending" ? 0 : memo.todo_status === "completed" ? 1 : 2;
  const dueAt = (memo: StoreMemo) => memo.due_at ?? "9999-12-31T23:59:59.999Z";
  return (
    rank(left) - rank(right) ||
    dueAt(left).localeCompare(dueAt(right)) ||
    right.updated_at.localeCompare(left.updated_at) ||
    right.id.localeCompare(left.id)
  );
}

function conflict() {
  const error = new Error("记录已发生变化，请载入最新版本") as Error & {
    status: number;
    code: string;
  };
  error.status = 409;
  error.code = "MEMO_VERSION_CONFLICT";
  return error;
}

function checklistManagedConflict() {
  const error = conflict();
  error.message = "含清单的待办状态由清单自动汇总";
  error.code = "MEMO_CHECKLIST_MANAGED";
  return error;
}

export function resetMemoMockState() {
  rows.splice(0, rows.length);
  operationReceipts.clear();
}
