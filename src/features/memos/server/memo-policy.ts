import type { AuditActor, StoreRole } from "@/lib/repairdesk/types";
import type { MemoCapabilities, StoreMemo } from "@/features/memos/model/contracts";
import { ForbiddenError } from "@/server/auth-context";

export type MemoActor = AuditActor & {
  id: string;
  storeId: string;
  activeMembershipId: string;
  storeRole: StoreRole;
};

export function requireMemoActor(actor: AuditActor): MemoActor {
  const memoActor = requireMemoActorIdentity(actor);
  assertMemoActorStoreExplicit(actor);
  return memoActor;
}

export function requireMemoActorIdentity(actor: AuditActor): MemoActor {
  if (
    actor.isSystem ||
    !actor.id ||
    !actor.storeId ||
    !actor.activeMembershipId ||
    !actor.storeRole
  ) {
    throw new ForbiddenError();
  }
  return actor as MemoActor;
}

export function assertMemoActorStoreExplicit(actor: AuditActor) {
  if ((actor.stores?.length ?? 0) > 1 && actor.activeStoreExplicit !== true) {
    throw new ForbiddenError("请先明确选择当前店铺");
  }
}

export function memoCapabilities(actor: MemoActor): MemoCapabilities {
  const manager = actor.storeRole === "owner" || actor.storeRole === "manager";
  return {
    canRead: true,
    canCreate: actor.storeRole !== "viewer",
    canEditAny: manager,
    canArchive: manager,
    canAssignAny: manager,
    membershipId: actor.activeMembershipId,
    role: actor.storeRole,
  };
}

export function memoRowCapabilities(
  actor: MemoActor,
  memo: Pick<
    StoreMemo,
    "created_by_membership_id" | "assignee_membership_id" | "kind" | "todo_status" | "archived_at"
  >,
): StoreMemo["capabilities"] {
  const manager = actor.storeRole === "owner" || actor.storeRole === "manager";
  const viewer = actor.storeRole === "viewer";
  const isCreator = memo.created_by_membership_id === actor.activeMembershipId;
  const transitionInScope =
    manager || isCreator || memo.assignee_membership_id === actor.activeMembershipId;
  return {
    canEdit: !viewer && !memo.archived_at && (manager || isCreator),
    canClaim:
      !viewer &&
      !memo.archived_at &&
      memo.kind === "todo" &&
      memo.todo_status === "pending" &&
      memo.assignee_membership_id === null,
    canTransition: !viewer && !memo.archived_at && memo.kind === "todo" && transitionInScope,
    canArchive: manager && !memo.archived_at,
    canRestore: manager && Boolean(memo.archived_at),
  };
}
