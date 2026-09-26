export const memoKinds = ["note", "todo"] as const;
export type MemoKind = (typeof memoKinds)[number];

export const memoTodoStatuses = ["pending", "completed"] as const;
export type MemoTodoStatus = (typeof memoTodoStatuses)[number];

export type MemoChecklistItem = {
  id: string;
  text: string;
  completed: boolean;
};

export const memoViews = [
  "active",
  "pending",
  "mine",
  "overdue",
  "completed",
  "all",
  "archived",
] as const;
export type MemoView = (typeof memoViews)[number];

export type MemoCapabilities = {
  canRead: boolean;
  canCreate: boolean;
  canEditAny: boolean;
  canArchive: boolean;
  canAssignAny: boolean;
  membershipId: string;
  role: "owner" | "manager" | "technician" | "sales" | "viewer";
};

export type MemoListItem = {
  id: string;
  kind: MemoKind;
  title: string;
  todo_status: MemoTodoStatus | null;
  due_at: string | null;
  assignee_membership_id: string | null;
  assignee_name: string | null;
  created_by_name_snapshot: string;
  updated_by_name_snapshot: string;
  completed_at: string | null;
  archived_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  checklist_total: number;
  checklist_completed: number;
  capabilities: {
    canEdit: boolean;
    canClaim: boolean;
    canTransition: boolean;
    canArchive: boolean;
    canRestore: boolean;
  };
};

export type StoreMemo = MemoListItem & {
  store_id: string;
  content: string;
  checklist: MemoChecklistItem[];
  created_by_membership_id: string;
};

export type MemoListInput = {
  view?: MemoView;
  kind?: MemoKind | "all";
  assigneeMembershipId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type MemoListResult = {
  items: MemoListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  capabilities: MemoCapabilities;
};

export type MemoMutationResult = {
  memo: StoreMemo;
  replayed: boolean;
  appliedVersion: number;
};

export type MemoSummary = {
  pending: number;
  overdue: number;
  mine: number;
  completed: number;
};

export type MemoAssignee = {
  membershipId: string;
  displayName: string;
  role: MemoCapabilities["role"];
};

export type MemoCreateInput = {
  operationId: string;
  kind: MemoKind;
  title: string;
  content: string;
  checklist?: MemoChecklistItem[];
  dueAt?: string | null;
  assigneeMembershipId?: string | null;
};

export type MemoUpdateInput = {
  operationId: string;
  id: string;
  expectedVersion: number;
  title: string;
  content: string;
  /** Omitted keeps the stored checklist; [] clears it. */
  checklist?: MemoChecklistItem[];
  dueAt?: string | null;
  assigneeMembershipId?: string | null;
};

export type MemoTransition = "claim" | "complete" | "reopen";

export type MemoTransitionInput = {
  operationId: string;
  id: string;
  expectedVersion: number;
  transition: MemoTransition;
};

export type MemoArchiveInput = {
  operationId: string;
  id: string;
  expectedVersion: number;
};

export type MemoChecklistItemUpdateInput = {
  operationId: string;
  id: string;
  expectedVersion: number;
  itemId: string;
  completed: boolean;
};
