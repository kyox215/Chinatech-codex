import type { FaultPriceItem } from "@/lib/repairdesk/types";

export interface FinanceFaultDraft {
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
    name: item.name,
    priceText: opts.zeroAsEmpty && Number(item.price) === 0 ? "" : moneyDraftText(item.price),
    note: item.note ?? "",
  }));
}

export function emptyFinanceFaultDraft(): FinanceFaultDraft {
  return { name: "", priceText: "", note: "" };
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
      name,
      price: parsedPrice.value,
      ...(note ? { note } : {}),
    });
  }

  const quotation = faultPrices.reduce((sum, item) => sum + item.price, 0);
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
  if (parsedDeposit.value > quotation) {
    return {
      faultPrices,
      quotation,
      deposit: parsedDeposit.value,
      balance: Math.max(0, quotation - parsedDeposit.value - paidAmount),
      canSave: false,
      error: "押金不能超过总报价。",
    };
  }

  return {
    faultPrices,
    quotation,
    deposit: parsedDeposit.value,
    balance: Math.max(0, quotation - parsedDeposit.value - paidAmount),
    canSave: true,
  };
}

function invalidDraft(
  error: string,
  faultPrices: FaultPriceItem[],
  paidAmount: number,
): NormalizedFinanceDraft {
  const quotation = faultPrices.reduce((sum, item) => sum + item.price, 0);
  return {
    faultPrices,
    quotation,
    deposit: 0,
    balance: Math.max(0, quotation - paidAmount),
    canSave: false,
    error,
  };
}

function parseMoneyDraft(
  text: string,
  opts: { emptyAsZero?: boolean; label?: string } = {},
): { empty: boolean; value: number; error?: string } {
  const label = opts.label ?? "金额";
  const normalized = text.trim().replace(",", ".");
  if (!normalized) {
    return opts.emptyAsZero
      ? { empty: true, value: 0 }
      : { empty: true, value: 0, error: `${label}不能为空。` };
  }
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    return { empty: false, value: 0, error: `${label}格式不正确。` };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    return { empty: false, value: 0, error: `${label}不能为负数。` };
  }
  return { empty: false, value };
}
