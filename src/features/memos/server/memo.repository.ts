import { createHash } from "node:crypto";

import type {
  MemoAssignee,
  MemoListItem,
  MemoListInput,
  MemoListResult,
  MemoMutationResult,
  MemoSummary,
  StoreMemo,
} from "@/features/memos/model/contracts";
import { getSupabaseAdmin } from "@/server/supabase";
import type { DbRecord } from "@/server/repairdesk-shared";

import { memoCapabilities, memoRowCapabilities, type MemoActor } from "./memo-policy";

const memoListSelect = `
  id,kind,title,todo_status,due_at,assignee_membership_id,
  created_by_membership_id,created_by_name_snapshot,updated_by_name_snapshot,
  completed_at,archived_at,version,created_at,updated_at,
  assignee:store_memberships!store_memos_assignee_same_store_fkey(display_name)
`;
const memoDetailSelect = `store_id,content,${memoListSelect}`;

export async function listMemos(actor: MemoActor, input: MemoListInput): Promise<MemoListResult> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  let query = getSupabaseAdmin()
    .from("store_memos")
    .select(memoListSelect, { count: "exact" })
    .eq("store_id", actor.storeId);

  switch (input.view ?? "active") {
    case "active":
      query = query.is("archived_at", null);
      break;
    case "pending":
      query = query.is("archived_at", null).eq("kind", "todo").eq("todo_status", "pending");
      break;
    case "mine":
      query = query
        .is("archived_at", null)
        .eq("kind", "todo")
        .eq("todo_status", "pending")
        .eq("assignee_membership_id", actor.activeMembershipId);
      break;
    case "overdue":
      query = query
        .is("archived_at", null)
        .eq("kind", "todo")
        .eq("todo_status", "pending")
        .lt("due_at", new Date().toISOString());
      break;
    case "completed":
      query = query.is("archived_at", null).eq("kind", "todo").eq("todo_status", "completed");
      break;
    case "archived":
      query = query.not("archived_at", "is", null);
      break;
    case "all":
      break;
  }

  if (input.kind && input.kind !== "all") query = query.eq("kind", input.kind);
  if (input.assigneeMembershipId) {
    query = query.eq("assignee_membership_id", input.assigneeMembershipId);
  }
  if (input.search) {
    const search = escapePostgrestSearch(input.search);
    if (search) query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  }

  const { data, count, error } = await query
    .order("todo_status", { ascending: false, nullsFirst: false })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);
  assertMemoReadSucceeded(error);

  const items = ((data ?? []) as unknown as DbRecord[]).map((row) =>
    memoListItemFromRow(row, actor),
  );
  const total = count ?? 0;
  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    capabilities: memoCapabilities(actor),
  };
}

export async function getMemo(actor: MemoActor, id: string): Promise<StoreMemo> {
  const { data, error } = await getSupabaseAdmin()
    .from("store_memos")
    .select(memoDetailSelect)
    .eq("store_id", actor.storeId)
    .eq("id", id)
    .maybeSingle();
  assertMemoReadSucceeded(error);
  if (!data) throw memoError("MEMO_NOT_FOUND", "备忘录不存在", 404);
  return memoFromRow(data as unknown as DbRecord, actor);
}

export async function getMemoSummary(actor: MemoActor): Promise<MemoSummary> {
  const now = new Date().toISOString();
  const base = () =>
    getSupabaseAdmin()
      .from("store_memos")
      .select("id", { count: "exact", head: true })
      .eq("store_id", actor.storeId)
      .is("archived_at", null)
      .eq("kind", "todo");
  const [pending, overdue, mine, completed] = await Promise.all([
    base().eq("todo_status", "pending"),
    base().eq("todo_status", "pending").lt("due_at", now),
    base().eq("todo_status", "pending").eq("assignee_membership_id", actor.activeMembershipId),
    base().eq("todo_status", "completed"),
  ]);
  [pending, overdue, mine, completed].forEach((result) => assertMemoReadSucceeded(result.error));
  return {
    pending: pending.count ?? 0,
    overdue: overdue.count ?? 0,
    mine: mine.count ?? 0,
    completed: completed.count ?? 0,
  };
}

export async function listMemoAssignees(actor: MemoActor): Promise<MemoAssignee[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("store_memberships")
    .select("id,display_name,role")
    .eq("store_id", actor.storeId)
    .eq("status", "active")
    .order("display_name", { ascending: true });
  assertMemoReadSucceeded(error);
  const all = (data ?? []).map((row) => ({
    membershipId: String(row.id),
    displayName: String(row.display_name || "员工"),
    role: row.role as MemoAssignee["role"],
  }));
  const caps = memoCapabilities(actor);
  return caps.canAssignAny
    ? all
    : all.filter((member) => member.membershipId === caps.membershipId);
}

export async function mutateMemoRpc(
  actor: MemoActor,
  input: {
    operation: "create" | "update" | "claim" | "complete" | "reopen" | "archive" | "restore";
    operationId: string;
    memoId?: string;
    expectedVersion?: number;
    kind?: "note" | "todo";
    title?: string;
    content?: string;
    dueAt?: string | null;
    assigneeMembershipId?: string | null;
  },
): Promise<MemoMutationResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("repairdesk_mutate_store_memo_rpc", {
    p_store_id: actor.storeId,
    p_actor_user_id: actor.id,
    p_actor_membership_id: actor.activeMembershipId,
    p_operation: input.operation,
    p_operation_id: input.operationId,
    p_memo_id: input.memoId ?? null,
    p_expected_version: input.expectedVersion ?? null,
    p_kind: input.kind ?? null,
    p_title: input.title ?? null,
    p_content: input.content ?? null,
    p_due_at: input.dueAt ?? null,
    p_assignee_membership_id: input.assigneeMembershipId ?? null,
  });
  if (error) throw mapMemoDatabaseError(error.message);
  const envelope = data as DbRecord | null;
  const row = envelope?.memo as DbRecord | undefined;
  if (!row) throw memoError("MEMO_NOT_FOUND", "备忘录不存在", 404);
  return {
    memo: memoFromRow(row, actor),
    replayed: envelope?.replayed === true,
    appliedVersion: Number(envelope?.appliedVersion ?? row.version),
  };
}

export async function consumeMemoAttempt(actor: MemoActor, bucket: "read" | "write") {
  const scopeHash = createHash("sha256")
    .update(`memos:${actor.storeId}:${actor.activeMembershipId}`)
    .digest("hex");
  const { data, error } = await getSupabaseAdmin().rpc(
    "repairdesk_consume_authenticated_rate_limit_rpc",
    {
      p_scope_hash: scopeHash,
      p_bucket: bucket,
    },
  );
  if (error) {
    throw memoError("MEMO_RATE_LIMIT_UNAVAILABLE", "备忘录暂时不可用，请稍后重试", 503);
  }
  const result = data as { allowed?: boolean } | null;
  if (!result?.allowed) {
    throw memoError("MEMO_RATE_LIMITED", "操作过于频繁，请稍后重试", 429);
  }
}

function memoListItemFromRow(row: DbRecord, actor: MemoActor): MemoListItem {
  const full = memoFromRow({ ...row, store_id: actor.storeId, content: "" }, actor);
  const {
    store_id: _storeId,
    content: _content,
    created_by_membership_id: _creatorId,
    ...item
  } = full;
  return item;
}

function memoFromRow(row: DbRecord, actor: MemoActor): StoreMemo {
  const assignee = Array.isArray(row.assignee) ? row.assignee[0] : row.assignee;
  const memo: StoreMemo = {
    id: String(row.id),
    store_id: String(row.store_id),
    kind: row.kind as StoreMemo["kind"],
    title: String(row.title),
    content: String(row.content ?? ""),
    todo_status: (row.todo_status ?? null) as StoreMemo["todo_status"],
    due_at: row.due_at ? String(row.due_at) : null,
    assignee_membership_id: row.assignee_membership_id ? String(row.assignee_membership_id) : null,
    assignee_name:
      assignee && typeof assignee === "object" && "display_name" in assignee
        ? String((assignee as DbRecord).display_name ?? "") || null
        : null,
    created_by_membership_id: String(row.created_by_membership_id),
    created_by_name_snapshot: String(row.created_by_name_snapshot),
    updated_by_name_snapshot: String(row.updated_by_name_snapshot),
    completed_at: row.completed_at ? String(row.completed_at) : null,
    archived_at: row.archived_at ? String(row.archived_at) : null,
    version: Number(row.version),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    capabilities: {
      canEdit: false,
      canClaim: false,
      canTransition: false,
      canArchive: false,
      canRestore: false,
    },
  };
  memo.capabilities = memoRowCapabilities(actor, memo);
  return memo;
}

function escapePostgrestSearch(value: string) {
  return value
    .trim()
    .replace(/[\\%_,().:]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function mapMemoDatabaseError(message: string) {
  const code = [
    "MEMO_NOT_FOUND",
    "MEMO_FORBIDDEN",
    "MEMO_VALIDATION_FAILED",
    "MEMO_VERSION_CONFLICT",
    "MEMO_IDEMPOTENCY_CONFLICT",
    "MEMO_ALREADY_CLAIMED",
    "MEMO_ASSIGNEE_INVALID",
    "MEMO_ARCHIVED",
    "MEMO_RATE_LIMITED",
    "MEMOS_FEATURE_DISABLED",
  ].find((candidate) => message.includes(candidate));
  switch (code) {
    case "MEMO_NOT_FOUND":
      return memoError(code, "备忘录不存在", 404);
    case "MEMO_FORBIDDEN":
      return memoError(code, "当前员工没有权限执行此操作", 403);
    case "MEMO_VERSION_CONFLICT":
    case "MEMO_IDEMPOTENCY_CONFLICT":
    case "MEMO_ALREADY_CLAIMED":
    case "MEMO_ARCHIVED":
      return memoError(code, "记录已发生变化，请载入最新版本", 409);
    case "MEMO_ASSIGNEE_INVALID":
      return memoError(code, "负责人无效或已经离店", 422);
    case "MEMO_RATE_LIMITED":
      return memoError(code, "操作过于频繁，请稍后重试", 429);
    case "MEMOS_FEATURE_DISABLED":
      return memoError(code, "备忘录功能尚未对当前店铺开放", 403);
    default:
      return memoError("MEMO_VALIDATION_FAILED", "备忘录请求无效", 422);
  }
}

export function memoError(code: string, message: string, status: number) {
  const error = new Error(message) as Error & { code: string; status: number };
  error.code = code;
  error.status = status;
  return error;
}

function assertMemoReadSucceeded(error: { message?: string } | null | undefined) {
  if (error) throw memoError("MEMO_READ_FAILED", "备忘录暂时无法读取，请稍后重试", 503);
}
