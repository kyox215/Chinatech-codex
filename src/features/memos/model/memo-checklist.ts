import type { MemoChecklistItem } from "./contracts";

export const MEMO_CHECKLIST_MAX_ITEMS = 100;
export const MEMO_CHECKLIST_ITEM_MAX_LENGTH = 200;

export function memoChecklistTextLength(value: string) {
  return Array.from(value).length;
}

export function checklistCounts(items: readonly MemoChecklistItem[]) {
  return {
    total: items.length,
    completed: items.filter((item) => item.completed).length,
  };
}

export function checklistStatus(
  items: readonly MemoChecklistItem[],
  fallback: "pending" | "completed",
) {
  if (items.length === 0) return fallback;
  return items.every((item) => item.completed) ? "completed" : "pending";
}

export function checklistItemsFromLines(
  text: string,
  createId: () => string = () => crypto.randomUUID(),
): MemoChecklistItem[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ id: createId(), text: line, completed: false }));
}

export function validateChecklist(items: readonly MemoChecklistItem[]) {
  if (items.length > MEMO_CHECKLIST_MAX_ITEMS) return "too_many" as const;
  if (
    items.some(
      (item) =>
        !item.text.trim() ||
        memoChecklistTextLength(item.text.trim()) > MEMO_CHECKLIST_ITEM_MAX_LENGTH,
    )
  ) {
    return "invalid_text" as const;
  }
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    return "duplicate_id" as const;
  }
  return null;
}
