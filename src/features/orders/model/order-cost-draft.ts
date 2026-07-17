import type {
  CreateOrderCostInput,
  FaultPriceItem,
  OrderLineCostItem,
  StoreFaultCostDefaultItem,
  UpdateOrderLineCostInput,
} from "@/lib/repairdesk/types";

export interface NewOrderCostDraft {
  mode: "default" | "manual" | "blank";
  text: string;
  touched: boolean;
}

export function formatCostDraftAmount(amount: number | null | undefined) {
  return amount === null || amount === undefined ? "" : String(amount);
}

function parseManualCostAmount(text: string, name: string) {
  const normalized = text.trim().replace(",", ".");
  if (normalized.startsWith("-")) {
    throw new Error(`“${name}”的成本金额无效`);
  }
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) {
    throw new Error(`“${name}”的成本最多保留两位小数`);
  }
  const amount = parseOrderCostDraftAmount(text);
  if (amount === null) {
    throw new Error(`“${name}”的成本金额无效`);
  }
  return amount;
}

export function parseOrderCostDraftAmount(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount <= 999_999.99 ? amount : null;
}

export function syncNewOrderCostDrafts(
  current: Record<string, NewOrderCostDraft>,
  lines: FaultPriceItem[],
  defaults: StoreFaultCostDefaultItem[] = [],
) {
  const defaultsByKey = new Map(defaults.map((item) => [item.catalog_key, item]));
  const next: Record<string, NewOrderCostDraft> = {};
  for (const line of lines) {
    if (!line.line_id) continue;
    const existing = current[line.line_id];
    if (existing?.touched) {
      next[line.line_id] = existing;
      continue;
    }
    const defaultAmount = line.catalog_key
      ? defaultsByKey.get(line.catalog_key)?.default_cost_amount
      : null;
    next[line.line_id] = {
      mode: "default",
      text: formatCostDraftAmount(defaultAmount),
      touched: false,
    };
  }
  return next;
}

export function updateNewOrderCostDraft(text: string): NewOrderCostDraft {
  return {
    mode: text.trim() === "" ? "blank" : "manual",
    text,
    touched: true,
  };
}

export function hasTouchedNewOrderCostDrafts(drafts: Record<string, NewOrderCostDraft>): boolean {
  return Object.values(drafts).some((draft) => draft.touched);
}

export function isNewOrderCostInputDisabled({
  catalogKey,
  isOnline,
  defaultsPending,
  defaultsError,
}: {
  catalogKey?: string;
  isOnline: boolean;
  defaultsPending: boolean;
  defaultsError: boolean;
}) {
  return !isOnline || (Boolean(catalogKey) && (defaultsPending || defaultsError));
}

export function buildCreateOrderCostInputs(
  lines: FaultPriceItem[],
  drafts: Record<string, NewOrderCostDraft>,
): CreateOrderCostInput[] {
  const result: CreateOrderCostInput[] = [];
  for (const line of lines) {
    if (!line.line_id) continue;
    const draft = drafts[line.line_id];
    if (!draft || draft.mode === "default") {
      result.push({
        line_id: line.line_id,
        catalog_key: line.catalog_key,
        mode: "default",
      });
      continue;
    }
    if (draft.mode === "blank") {
      result.push({
        line_id: line.line_id,
        catalog_key: line.catalog_key,
        mode: "blank",
      });
      continue;
    }
    const amount = parseManualCostAmount(draft.text, line.name);
    result.push({
      line_id: line.line_id,
      catalog_key: line.catalog_key,
      mode: "manual",
      amount,
    });
  }
  return result;
}

export function buildOrderLineCostUpdates(
  items: OrderLineCostItem[],
  drafts: Record<string, string>,
): UpdateOrderLineCostInput[] {
  return items.flatMap<UpdateOrderLineCostInput>((item) => {
    const text = drafts[item.line_id] ?? "";
    const original = item.cost_amount === null ? "" : String(item.cost_amount);
    if (text === original) return [];
    if (text.trim() === "") return [{ line_id: item.line_id, mode: "blank" as const }];
    const amount = parseManualCostAmount(text, item.name);
    return [{ line_id: item.line_id, mode: "manual" as const, amount }];
  });
}
