import type { RepairStatus } from "./repair-fixtures";
import type { RepairPartsGroup } from "./procurement";
import type { StaffMember } from "./staff";

export type RepairListViewState = {
  query: string;
  status: "all" | "including_cancelled" | RepairStatus;
  partsFilter: "all" | RepairPartsGroup;
  groupBy: "workflow" | "parts" | "none";
  sort: "updated" | "created" | "priority";
  filtersOpen: boolean;
  openGroups: Record<string, boolean>;
  scrollY: number;
  scrollLeft: number;
};
export const repairListViewStorageKey = "chinatech.repair-list-view.v1";
const statuses = ["all", "including_cancelled", "diagnosis", "awaiting_quote", "awaiting_parts", "repairing", "testing", "ready", "awaiting_reply", "collected_unpaid", "outsourced", "ready_notified", "completed", "cancelled"];
const parts = ["all", "draft", "cart", "mixed", "ordered", "complete", "unrecorded"];
const groupIds = new Set(["all", "diagnosis", "awaiting_quote", "awaiting_parts", "testing", "awaiting_reply", "collected_unpaid", "outsourced", "processing", "purchase", "arrival", "arrival_notified", "ready", "ready_notified", "complete", "cancelled", ...parts.slice(1)]);
type Envelope = { version: 1; scope: string; view: Omit<RepairListViewState, "query"> };
let memory: { scope: string; view: RepairListViewState } | null = null;

/** Only current identity IDs, member version and permissions enter the scope. */
export function repairListViewScope({ mode, storeId, member, accountId }: {
  mode: "backend" | "preview";
  storeId: string;
  member: StaffMember | null;
  accountId?: string;
}): string | null {
  if (!storeId || !member?.id || member.accountStatus !== "active" || member.membershipStatus !== "active"
    || !member.permissions.includes("repairs.view") || !Number.isSafeInteger(member.revision) || member.revision < 1) return null;
  return JSON.stringify([mode, storeId, accountId ?? member.id, member.id, member.revision, member.role, [...member.permissions].sort()]);
}

function storageOrNull(storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null) {
  if (storage !== undefined) return storage;
  try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; }
}
function validView(value: unknown, query = ""): RepairListViewState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!statuses.includes(row.status as string) || !parts.includes(row.partsFilter as string)
    || !["workflow", "parts", "none"].includes(row.groupBy as string) || !["updated", "created", "priority"].includes(row.sort as string)
    || typeof row.filtersOpen !== "boolean" || !row.openGroups || typeof row.openGroups !== "object" || Array.isArray(row.openGroups)
    || ![row.scrollY, row.scrollLeft].every(number => typeof number === "number" && Number.isFinite(number) && number >= 0 && number <= 10_000_000)
    || typeof query !== "string" || query.length > 1000) return null;
  const entries = Object.entries(row.openGroups);
  if (entries.length > groupIds.size || entries.some(([id, open]) => !groupIds.has(id) || typeof open !== "boolean")) return null;
  return { query, status: row.status as RepairListViewState["status"], partsFilter: row.partsFilter as RepairListViewState["partsFilter"],
    groupBy: row.groupBy as RepairListViewState["groupBy"], sort: row.sort as RepairListViewState["sort"], filtersOpen: row.filtersOpen,
    openGroups: Object.fromEntries(entries) as Record<string, boolean>, scrollY: row.scrollY as number, scrollLeft: row.scrollLeft as number };
}

export function clearRepairListView(storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null) {
  memory = null;
  try { storageOrNull(storage)?.removeItem(repairListViewStorageKey); } catch { /* View storage is optional. */ }
}

/** Same-tab route returns retain search in memory; customer search text never enters storage. */
export function readRepairListView(scope: string | null, storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null): RepairListViewState | null {
  if (!scope) { clearRepairListView(storage); return null; }
  if (memory && memory.scope !== scope) clearRepairListView(storage);
  if (memory?.scope === scope) return validView(memory.view, memory.view.query);
  try {
    const raw = storageOrNull(storage)?.getItem(repairListViewStorageKey);
    if (!raw) return null;
    if (raw.length > 10_000) { clearRepairListView(storage); return null; }
    const parsed = JSON.parse(raw) as Envelope;
    if (parsed?.version !== 1 || parsed.scope !== scope) { clearRepairListView(storage); return null; }
    const view = validView(parsed.view);
    if (!view) { clearRepairListView(storage); return null; }
    memory = { scope, view };
    return validView(view);
  } catch { return null; }
}

/** Returns false if optional session storage fails; scoped in-memory restoration remains available. */
export function writeRepairListView(scope: string | null, view: RepairListViewState, storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null): boolean {
  if (!scope) { clearRepairListView(storage); return false; }
  const safe = validView(view, view.query);
  if (!safe) return false;
  memory = { scope, view: safe };
  const { query: searchInMemory, ...stored } = safe;
  void searchInMemory;
  try {
    const target = storageOrNull(storage);
    if (!target) return false;
    target.setItem(repairListViewStorageKey, JSON.stringify({ version: 1, scope, view: stored } satisfies Envelope));
    return true;
  } catch { return false; }
}

export function captureRepairListPosition(table: HTMLElement | null): Pick<RepairListViewState, "scrollY" | "scrollLeft"> {
  return { scrollY: Math.max(0, window.scrollY), scrollLeft: Math.max(0, table?.scrollLeft ?? 0) };
}

/** Call after data and restored open groups are rendered. Abort on identity change or user input. */
export function restoreRepairListPosition(position: Pick<RepairListViewState, "scrollY" | "scrollLeft">, table: HTMLElement | null, isCurrent: () => boolean = () => true, onFinish?: () => void): () => void {
  let stopped = false;
  let frame = 0;
  let tries = 0;
  const cancel = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) window.removeEventListener(event, cancel);
    onFinish?.();
  };
  const restore = () => {
    if (stopped || !isCurrent()) { cancel(); return; }
    if (table) table.scrollLeft = position.scrollLeft;
    window.scrollTo({ top: position.scrollY, behavior: "instant" });
    if (++tries >= 60 || Math.abs(window.scrollY - position.scrollY) <= 1 && (!table || Math.abs(table.scrollLeft - position.scrollLeft) <= 1)) { cancel(); return; }
    frame = requestAnimationFrame(restore);
  };
  for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) window.addEventListener(event, cancel, { passive: true });
  frame = requestAnimationFrame(() => { frame = requestAnimationFrame(restore); });
  return cancel;
}
