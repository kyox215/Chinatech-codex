import type { FaultPriceItem, QuotePriceException } from "@/lib/repairdesk/types";

export type QuoteReadinessCode =
  | "diagnosis"
  | "items"
  | "price_exception"
  | "deposit"
  | "permission"
  | "phone"
  | "published_quote";

export interface QuoteDraftReadinessInput {
  diagnosisResult?: string | null;
  faultPrices: FaultPriceItem[];
  depositAmount?: number;
  priceException?: QuotePriceException | null;
}

export interface QuoteReadiness {
  ready: boolean;
  missing: QuoteReadinessCode[];
  quotationAmount: number;
}

export function getQuoteDraftReadiness(input: QuoteDraftReadinessInput): QuoteReadiness {
  const missing: QuoteReadinessCode[] = [];
  const diagnosis = input.diagnosisResult?.trim() ?? "";
  if (!diagnosis) missing.push("diagnosis");

  const normalizedItems = input.faultPrices.map((item) => ({
    name: item.name.trim(),
    price: Number(item.price),
  }));
  const itemsValid =
    normalizedItems.length > 0 &&
    normalizedItems.every(
      (item) => item.name.length > 0 && Number.isFinite(item.price) && item.price >= 0,
    );
  if (!itemsValid) missing.push("items");

  const quotationAmount = roundMoney(
    normalizedItems.reduce(
      (sum, item) => sum + (Number.isFinite(item.price) && item.price >= 0 ? item.price : 0),
      0,
    ),
  );
  const hasZeroPrice = normalizedItems.some((item) => item.price === 0);
  if (hasZeroPrice && !isValidPriceException(input.priceException)) {
    missing.push("price_exception");
  }

  const depositAmount = Number(input.depositAmount ?? 0);
  if (
    !Number.isFinite(depositAmount) ||
    depositAmount < 0 ||
    roundMoney(depositAmount) > quotationAmount
  ) {
    missing.push("deposit");
  }

  return { ready: missing.length === 0, missing, quotationAmount };
}

export function getQuoteNotificationReadiness({
  draft,
  canSendQuote,
  recipientPhone,
  quotePublicationId,
}: {
  draft: QuoteDraftReadinessInput;
  canSendQuote: boolean;
  recipientPhone?: string | null;
  quotePublicationId?: string | null;
}): QuoteReadiness {
  const readiness = getQuoteDraftReadiness(draft);
  const missing = [...readiness.missing];
  if (!canSendQuote) missing.push("permission");
  if ((recipientPhone ?? "").replace(/\D/g, "").length < 6) missing.push("phone");
  if (!isUuid(quotePublicationId)) {
    missing.push("published_quote");
  }
  return { ...readiness, ready: missing.length === 0, missing };
}

function isUuid(value?: string | null) {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  );
}

export function quoteReadinessLabel(code: QuoteReadinessCode) {
  const labels: Record<QuoteReadinessCode, string> = {
    diagnosis: "请先填写检测结论",
    items: "请至少填写一个完整报价项目",
    price_exception: "零元项目需要选择免费、保修或仅检测，并填写原因",
    deposit: "定金不能为负数或超过报价总额",
    permission: "当前账号无权通知客户",
    phone: "客户缺少可用的 WhatsApp 电话",
    published_quote: "请先发布最新报价",
  };
  return labels[code];
}

function isValidPriceException(value?: QuotePriceException | null) {
  return Boolean(
    value &&
    ["free", "warranty", "diagnostic_only"].includes(value.kind) &&
    value.reason.trim().length >= 4,
  );
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
