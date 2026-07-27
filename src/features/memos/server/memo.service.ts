import type {
  MemoArchiveInput,
  MemoCreateInput,
  MemoListInput,
  MemoTransitionInput,
  MemoUpdateInput,
} from "@/features/memos/model/contracts";
import type { AuditActor } from "@/lib/repairdesk/types";
import { assertPermission } from "@/server/permissions";

import { assertMemosFeature } from "./memo-feature";
import { requireMemoActorIdentity } from "./memo-policy";
import {
  getMemo,
  getMemoSummary,
  listMemoAssignees,
  listMemos,
  consumeMemoAttempt,
  mutateMemoRpc,
} from "./memo.repository";

async function actorForMemos(actor: AuditActor, bucket: "read" | "write") {
  const memoActor = requireMemoActorIdentity(actor);
  await consumeMemoAttempt(memoActor, bucket);
  assertMemosFeature(actor);
  assertPermission(memoActor, "memo:read");
  return memoActor;
}

export async function readMemoList(input: MemoListInput, actor: AuditActor) {
  return listMemos(await actorForMemos(actor, "read"), input);
}

export async function readMemo(id: string, actor: AuditActor) {
  return getMemo(await actorForMemos(actor, "read"), id);
}

export async function readMemoSummary(actor: AuditActor) {
  return getMemoSummary(await actorForMemos(actor, "read"));
}

export async function readMemoAssignees(actor: AuditActor) {
  return listMemoAssignees(await actorForMemos(actor, "read"));
}

export async function createMemo(input: MemoCreateInput, actor: AuditActor) {
  const memoActor = await actorForMemos(actor, "write");
  assertPermission(memoActor, "memo:create");
  if (input.assigneeMembershipId) {
    assertPermission(memoActor, "memo:assign", {
      scopeSatisfied: input.assigneeMembershipId === memoActor.activeMembershipId,
    });
  }
  return mutateMemoRpc(memoActor, {
    operation: "create",
    operationId: input.operationId,
    kind: input.kind,
    title: input.title,
    content: input.content,
    dueAt: input.dueAt,
    assigneeMembershipId: input.assigneeMembershipId,
  });
}

export async function updateMemo(input: MemoUpdateInput, actor: AuditActor) {
  const memoActor = await actorForMemos(actor, "write");
  const current = await getMemo(memoActor, input.id);
  const isCreator = current.created_by_membership_id === memoActor.activeMembershipId;
  assertPermission(memoActor, "memo:update", { scopeSatisfied: isCreator });
  if (input.assigneeMembershipId !== current.assignee_membership_id) {
    assertPermission(memoActor, "memo:assign", {
      scopeSatisfied:
        isCreator &&
        current.assignee_membership_id === null &&
        input.assigneeMembershipId === memoActor.activeMembershipId,
    });
  }
  return mutateMemoRpc(memoActor, {
    operation: "update",
    operationId: input.operationId,
    memoId: input.id,
    expectedVersion: input.expectedVersion,
    title: input.title,
    content: input.content,
    dueAt: input.dueAt,
    assigneeMembershipId: input.assigneeMembershipId,
  });
}

export async function transitionMemo(input: MemoTransitionInput, actor: AuditActor) {
  const memoActor = await actorForMemos(actor, "write");
  const current = await getMemo(memoActor, input.id);
  const scopeSatisfied =
    isMemoInScope(memoActor.activeMembershipId, current) ||
    (input.transition === "claim" && !current.assignee_membership_id);
  assertPermission(memoActor, input.transition === "claim" ? "memo:assign" : "memo:transition", {
    scopeSatisfied,
  });
  return mutateMemoRpc(memoActor, {
    operation: input.transition,
    operationId: input.operationId,
    memoId: input.id,
    expectedVersion: input.expectedVersion,
  });
}

export async function archiveMemo(input: MemoArchiveInput, actor: AuditActor) {
  const memoActor = await actorForMemos(actor, "write");
  assertPermission(memoActor, "memo:archive");
  return mutateMemoRpc(memoActor, {
    operation: "archive",
    operationId: input.operationId,
    memoId: input.id,
    expectedVersion: input.expectedVersion,
  });
}

export async function restoreMemo(input: MemoArchiveInput, actor: AuditActor) {
  const memoActor = await actorForMemos(actor, "write");
  assertPermission(memoActor, "memo:restore");
  return mutateMemoRpc(memoActor, {
    operation: "restore",
    operationId: input.operationId,
    memoId: input.id,
    expectedVersion: input.expectedVersion,
  });
}

function isMemoInScope(
  membershipId: string,
  memo: { created_by_membership_id: string; assignee_membership_id: string | null },
) {
  return (
    memo.created_by_membership_id === membershipId || memo.assignee_membership_id === membershipId
  );
}
