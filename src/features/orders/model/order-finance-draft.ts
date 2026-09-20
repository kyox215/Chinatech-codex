import type { FaultPriceItem } from "@/lib/repairdesk/types";
import { ensureOrderLineId } from "@/entities/order/model/order-line-identity";

export interface FinanceFaultDraft {
  line_id?: string;
  catalog_key?: string;
  name: string;
  priceText: string;
  note: string;
}

export interface FinanceDraftState {
  faults: FinanceFaultDraft[];
  depositText: string;
}

export interface NormalizedFinanceDraft {
  faultPrices: FaultPriceItem[];
  quotation: number;
  deposit: number;
  balance: number;
  canSave: boolean;
  error?: string;
}

export function moneyDraftText(value: number | undefined) {
  if (!Number.isFinite(Number(value))) return "";
  return String(Number(value));
}

export function financeDraftFromPrices(
  faultPrices: FaultPriceItem[],
  opts: { zeroAsEmpty?: boolean } = {},
): FinanceFaultDraft[] {
  return faultPrices.map((item) => ({
    line_id: ensureOrderLineId(item.line_id),
    ...(item.catalog_key ? { catalog_key: item.catalog_key } : {}),
    name: item.name,
    priceText: opts.zeroAsEmpty && Number(item.price) === 0 ? "" : moneyDraftText(item.price),
    note: item.note ?? "",
  }));
}

export function emptyFinanceFaultDraft(): FinanceFaultDraft {
  return { line_id: ensureOrderLineId(undefined), name: "", priceText: "", note: "" };
}

export function mergeFaultPriceSelectionIntoFinanceDraft(
  draft: FinanceDraftState,
  selected: FaultPriceItem[],
): FinanceDraftState {
  const existingByLineId = new Map(
    draft.faults.flatMap((item) => (item.line_id ? [[item.line_id, item] as const] : [])),
  );
  const existingByName = new Map(draft.faults.map((item) => [item.name, item]));

  return {
    ...draft,
    faults: selected.map((item) => {
      const lineId = ensureOrderLineId(item.line_id);
      const existing = existingByLineId.get(lineId) ?? existingByName.get(item.name);
      const price = Number(item.price);

      return {
        line_id: lineId,
        ...(item.catalog_key ? { catalog_key: item.catalog_key } : {}),
        name: item.name,
        note: item.note ?? existing?.note ?? "",
        priceText:
          existing?.priceText ?? (Number.isFinite(price) && price > 0 ? String(price) : ""),
      };
    }),
  };
}

export function createFinanceDraftState(
  faultPrices: FaultPriceItem[],
  depositAmount: number,
): FinanceDraftState {
  return {
    faults: financeDraftFromPrices(faultPrices),
    depositText: moneyDraftText(depositAmount),
  };
}

export function normalizeFinanceDraft(
  draft: FinanceDraftState,
  paidAmount: number,
): NormalizedFinanceDraft {
  const faultPrices: FaultPriceItem[] = [];
  let quotationCents = 0;

  for (const item of draft.faults) {
    const name = item.name.trim();
    const note = item.note.trim();
    const priceText = item.priceText.trim();
    const hasAnyValue = Boolean(name || note || priceText);
    if (!hasAnyValue) continue;

    const parsedPrice = parseMoneyDraft(priceText);
    if (!name || parsedPrice.empty) {
      return invalidDraft("请补全报价项目名称和金额。", faultPrices, paidAmount);
    }
    if (parsedPrice.error) {
      return invalidDraft(parsedPrice.error, faultPrices, paidAmount);
    }

    faultPrices.push({
      line_id: ensureOrderLineId(item.line_id),
      ...(item.catalog_key ? { catalog_key: item.catalog_key } : {}),
      name,
      price: parsedPrice.value,
      ...(note ? { note } : {}),
    });
    quotationCents += parsedPrice.cents;
  }

  const quotation = centsToMoney(quotationCents);
  const parsedDeposit = parseMoneyDraft(draft.depositText, { emptyAsZero: true, label: "押金" });
  if (parsedDeposit.error) {
    return {
      faultPrices,
      quotation,
      deposit: 0,
      balance: Math.max(0, quotation - paidAmount),
      canSave: false,
      error: parsedDeposit.error,
    };
  }
  const paidCents = moneyNumberToCents(paidAmount);
  if (paidCents === null) {
    return {
      faultPrices,
      quotation,
      deposit: parsedDeposit.value,
      balance: Math.max(0, quotation - parsedDeposit.value),
      canSave: false,
      error: "已收金额格式不正确，请先核对收款记录。",
    };
  }
  if (parsedDeposit.cents > quotationCents) {
    return {
      faultPrices,
      quotation,
      deposit: parsedDeposit.value,
      balance: centsToMoney(Math.max(0, quotationCents - parsedDeposit.cents - paidCents)),
      canSave: false,
      error: "押金不能超过总报价。",
    };
  }

  return {
    faultPrices,
    quotation,
    deposit: parsedDeposit.value,
    balance: centsToMoney(Math.max(0, quotationCents - parsedDeposit.cents - paidCents)),
    canSave: true,
  };
}

function invalidDraft(
  error: string,
  faultPrices: FaultPriceItem[],
  paidAmount: number,
): NormalizedFinanceDraft {
  const quotationCents = faultPrices.reduce(
    (sum, item) => sum + (moneyNumberToCents(item.price) ?? 0),
    0,
  );
  const paidCents = moneyNumberToCents(paidAmount) ?? 0;
  const quotation = centsToMoney(quotationCents);
  return {
    faultPrices,
    quotation,
    deposit: 0,
    balance: centsToMoney(Math.max(0, quotationCents - paidCents)),
    canSave: false,
    error,
  };
}

function parseMoneyDraft(
  text: string,
  opts: { emptyAsZero?: boolean; label?: string } = {},
): { empty: boolean; value: number; cents: number; error?: string } {
  const label = opts.label ?? "金额";
  const normalized = text.trim().replace(",", ".");
  if (!normalized) {
    return opts.emptyAsZero
      ? { empty: true, value: 0, cents: 0 }
      : { empty: true, value: 0, cents: 0, error: `${label}不能为空。` };
  }
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(normalized)) {
    return {
      empty: false,
      value: 0,
      cents: 0,
      error: /\.\d{3,}$/.test(normalized) ? `${label}最多保留两位小数。` : `${label}格式不正确。`,
    };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    return { empty: false, value: 0, cents: 0, error: `${label}不能为负数。` };
  }
  const cents = moneyNumberToCents(value);
  if (cents === null) {
    return { empty: false, value: 0, cents: 0, error: `${label}最多保留两位小数。` };
  }
  return { empty: false, value: centsToMoney(cents), cents };
}

function moneyNumberToCents(value: number) {
  if (!Number.isFinite(value) || value < 0) return null;
  const cents = Math.round(value * 100);
  return Math.abs(value * 100 - cents) < 1e-7 ? cents : null;
}

function centsToMoney(cents: number) {
  return cents / 100;
}
