import type { StorePrintProfile } from "@/features/print/model/store-print-profile";

/** Presentation input only. The sales API adapter must provide persisted snapshots. */
export type SalesDocumentLanguage = "it" | "en" | "zh";
export type SalesDocumentKind = "sale" | "payment" | "warranty";
export type SalesDocumentPaper = "a5-landscape" | "a4-landscape-full";
export type SalesPaymentMethod = "cash" | "card" | "bancomat" | "transfer" | "other";
export interface SalesDocumentPayment {
  id: string;
  receiptNumber: string;
  sequence: number;
  amountCents: number;
  occurredAt: string;
  method: SalesPaymentMethod;
}
export interface SalesDocumentSource {
  saleNumber: string;
  agreedAt: string;
  product: {
    name: string;
    sku: string;
    specification?: string;
    identifierLabel: "IMEI" | "SN";
    identifier: string;
  };
  customer: { name: string; phone: string };
  priceCents: number;
  payments: readonly SalesDocumentPayment[];
  deliveredAt?: string;
  warrantyAgreement: {
    months: 12 | 24;
    usedDevice: boolean;
    shorteningAgreed: boolean;
    termsVersion: string;
  };
  coverage?: { startsAt: string; endsOn: string };
  store: StorePrintProfile;
  sample?: boolean;
}
export interface SalesDocument {
  kind: SalesDocumentKind;
  number: string;
  source: SalesDocumentSource;
  payment?: SalesDocumentPayment;
  paidCents: number;
  balanceCents: number;
}
function cents(value: number) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 10_000_000_000;
}
function validDate(value: string) {
  return value.trim().length > 0 && Number.isFinite(Date.parse(value));
}
export function buildSalesDocument(
  source: SalesDocumentSource,
  kind: SalesDocumentKind,
  paymentId?: string,
): SalesDocument {
  if (!cents(source.priceCents) || !validDate(source.agreedAt))
    throw new Error("invalid-sale-document");
  const ids = new Set<string>();
  const sequences = new Set<number>();
  const payments = [...source.payments].sort((a, b) => a.sequence - b.sequence);
  let total = 0;
  for (const payment of payments) {
    if (
      !payment.id ||
      !payment.receiptNumber ||
      ids.has(payment.id) ||
      sequences.has(payment.sequence) ||
      !Number.isSafeInteger(payment.sequence) ||
      payment.sequence < 1 ||
      !cents(payment.amountCents) ||
      payment.amountCents === 0 ||
      !validDate(payment.occurredAt) ||
      Date.parse(payment.occurredAt) < Date.parse(source.agreedAt)
    )
      throw new Error("invalid-payment-document");
    ids.add(payment.id);
    sequences.add(payment.sequence);
    total += payment.amountCents;
  }
  if (!cents(total) || total > source.priceCents) throw new Error("invalid-document-balance");
  if (
    source.deliveredAt &&
    (!validDate(source.deliveredAt) ||
      total !== source.priceCents ||
      Date.parse(source.deliveredAt) < Date.parse(source.agreedAt) ||
      payments.some((payment) => Date.parse(payment.occurredAt) > Date.parse(source.deliveredAt!)))
  )
    throw new Error("invalid-document-delivery");
  const agreement = source.warrantyAgreement;
  if (
    !agreement ||
    !agreement.termsVersion.trim() ||
    (agreement.months !== 24 &&
      !(agreement.months === 12 && agreement.usedDevice && agreement.shorteningAgreed))
  )
    throw new Error("invalid-document-warranty-agreement");
  if (
    source.coverage &&
    (!source.deliveredAt ||
      Date.parse(source.coverage.startsAt) !== Date.parse(source.deliveredAt) ||
      source.coverage.endsOn !== salesWarrantyEndDate(source.coverage.startsAt, agreement.months))
  )
    throw new Error("invalid-document-warranty-coverage");
  if (kind === "warranty" && !source.coverage) throw new Error("warranty-not-started");
  const payment = kind === "payment" ? payments.find((entry) => entry.id === paymentId) : undefined;
  if (kind === "payment" && !payment) throw new Error("payment-not-found");
  const paidCents = payment
    ? payments
        .filter((entry) => entry.sequence <= payment.sequence)
        .reduce((sum, entry) => sum + entry.amountCents, 0)
    : total;
  return {
    kind,
    number: payment?.receiptNumber ?? `${source.saleNumber}-${kind === "warranty" ? "W" : "S"}`,
    source,
    payment,
    paidCents,
    balanceCents: source.priceCents - paidCents,
  };
}

/** Warranty expiry is a Rome calendar date, not a UTC instant. */
export function salesWarrantyEndDate(startsAt: string, months: 12 | 24) {
  if (!validDate(startsAt)) throw new Error("invalid-warranty-start");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(startsAt));
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const year = read("year");
  const month = read("month");
  const day = read("day");
  const target = new Date(Date.UTC(year, month - 1 + months, 1, 12));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export const salesDocumentCopy = {
  it: {
    sale: "Documento di vendita",
    payment: "Ricevuta di pagamento",
    warranty: "Certificato di garanzia",
    number: "Documento",
    agreement: "Data accordo",
    customer: "Cliente",
    phone: "Telefono",
    product: "Prodotto",
    price: "Prezzo",
    paid: "Totale incassato",
    balance: "Da incassare",
    thisPayment: "Questo pagamento",
    date: "Data pagamento",
    method: "Modalità",
    delivery: "Consegna effettiva",
    awaiting: "In attesa di consegna",
    starts: "Inizio garanzia",
    ends: "Fine garanzia",
    months: "mesi",
    language: "Lingua del documento",
    paper: "Formato",
    print: "Stampa",
    sample: "CAMPIONE · Dati sintetici · Nessun pagamento reale",
    asOf: "Situazione aggiornata a questo pagamento",
    paymentScope:
      "Questa ricevuta attesta solo il pagamento indicato. Consegna e garanzia sono documentate separatamente.",
    legal:
      "La garanzia legale decorre dalla consegna. Per i beni usati, una durata ridotta a 12 mesi richiede l'accordo espresso del cliente.",
    coverage:
      "Sono coperti i difetti di conformità e funzionali ai sensi della garanzia applicabile. I danni causati da cadute, liquidi o uso improprio non rientrano nella garanzia aggiuntiva; non è inclusa un'assicurazione per danni accidentali.",
    rights: "Restano impregiudicati i diritti legali del consumatore.",
    consent: "Il cliente ha espressamente accettato la durata di 12 mesi per il bene usato.",
    unavailable: "Documento non disponibile. Verificare i dati e riprovare.",
    cash: "Contanti",
    card: "Carta",
    bancomat: "Bancomat",
    transfer: "Bonifico",
    other: "Altro",
  },
  en: {
    sale: "Sales document",
    payment: "Payment receipt",
    warranty: "Warranty certificate",
    number: "Document",
    agreement: "Agreement date",
    customer: "Customer",
    phone: "Phone",
    product: "Product",
    price: "Sale price",
    paid: "Total received",
    balance: "Balance due",
    thisPayment: "This payment",
    date: "Payment date",
    method: "Method",
    delivery: "Actual delivery",
    awaiting: "Awaiting delivery",
    starts: "Warranty starts",
    ends: "Warranty ends",
    months: "months",
    language: "Document language",
    paper: "Paper",
    print: "Print",
    sample: "SAMPLE · Synthetic data · No real payment",
    asOf: "As of this payment",
    paymentScope:
      "This receipt confirms only the specified payment. Delivery and warranty are documented separately.",
    legal:
      "The legal guarantee starts on delivery. A reduction to 12 months for used goods requires the customer's express agreement.",
    coverage:
      "Non-conformity and functional defects are covered under the applicable guarantee. Damage caused by drops, liquids or misuse is outside the additional warranty; accidental-damage insurance is not included.",
    rights: "The consumer's statutory rights remain unaffected.",
    consent: "The customer expressly agreed to a 12-month term for this used product.",
    unavailable: "Document unavailable. Check the data and try again.",
    cash: "Cash",
    card: "Card",
    bancomat: "Debit card",
    transfer: "Bank transfer",
    other: "Other",
  },
  zh: {
    sale: "销售凭证",
    payment: "收款凭证",
    warranty: "保修凭证",
    number: "凭证编号",
    agreement: "销售约定日",
    customer: "客户",
    phone: "手机号",
    product: "商品",
    price: "售价",
    paid: "累计已收",
    balance: "待收",
    thisPayment: "本次收款",
    date: "收款日期",
    method: "收款方式",
    delivery: "实际交付日",
    awaiting: "待实际交付",
    starts: "保修开始",
    ends: "保修截止",
    months: "个月",
    language: "本次凭证语言",
    paper: "纸张",
    print: "打印",
    sample: "样张 · 合成数据 · 未发生真实付款",
    asOf: "截至本次收款",
    paymentScope: "本凭证仅证明所列本笔收款。实际交付和保修信息以对应凭证为准。",
    legal: "法定保修从实际交付日起算。二手商品缩短至12个月须经客户明确同意。",
    coverage:
      "适用保修涵盖不符约定及功能缺陷。由跌落、进液或误用造成的损坏不属于额外保修，且不包含意外损坏保险。",
    rights: "消费者依法享有的权利不受影响。",
    consent: "客户已明确同意本二手商品采用12个月期限。",
    unavailable: "凭证暂不可用，请核对数据后重试。",
    cash: "现金",
    card: "银行卡",
    bancomat: "借记卡",
    transfer: "转账",
    other: "其他",
  },
} as const;

export function salesDocumentMoney(value: number, language: SalesDocumentLanguage) {
  return new Intl.NumberFormat(
    language === "it" ? "it-IT" : language === "zh" ? "zh-CN" : "en-GB",
    { style: "currency", currency: "EUR" },
  ).format(value / 100);
}
export function salesDocumentDate(value: string, language: SalesDocumentLanguage) {
  return new Intl.DateTimeFormat(
    language === "it" ? "it-IT" : language === "zh" ? "zh-CN" : "en-GB",
    { dateStyle: "medium", timeZone: "Europe/Rome" },
  ).format(new Date(value));
}
