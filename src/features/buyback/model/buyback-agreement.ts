import type { BuybackDocumentType } from "@/lib/repairdesk/types";

export const BUYBACK_AGREEMENT_VERSION = "store-legal-config-required-buyback-v1";
export const BUYBACK_PRIVACY_NOTICE_VERSION = "store-legal-config-required-privacy-v1";
export const BUYBACK_AGREEMENT_LANGUAGE = "it-IT";
export const BUYBACK_PRIVACY_NOTICE_TEXT_IT = [
  "CONFIGURAZIONE PRIVACY DEL NEGOZIO NON DISPONIBILE",
  "La firma di acquisto usato e la raccolta di documenti sono disabilitate finche il negozio non configura una propria informativa privacy approvata.",
].join("\n\n");
export const BUYBACK_TERMS_TEXT_IT = [
  "CONDIZIONI DI ACQUISTO USATO NON CONFIGURATE",
  "La firma di cessione del dispositivo e disabilitata finche il negozio non configura condizioni contrattuali proprie approvate.",
].join("\n\n");
export const BUYBACK_PRIVACY_NOTICE_SHA256 =
  "9b8afa4c444ac8a2502789df24237d5f04615cfee99ccb245bf80867a91195f6";
export const BUYBACK_TERMS_SHA256 =
  "432a1393cf92ec12ab85c57c4667cd611c419550c1bb48990ed8cfa29976d908";

export function canUseConfiguredBuybackLegalProfile() {
  return false;
}

export interface BuybackAgreementSnapshot {
  [key: string]: unknown;
  agreement_version: string;
  privacy_notice_version: string;
  language: string;
  legal_documents: {
    privacy_notice: {
      version: string;
      sha256: string;
      text: string;
    };
    buyback_terms: {
      version: string;
      sha256: string;
      text: string;
    };
  };
  device: {
    brand: string;
    model: string;
    storage_capacity: string;
    serial_or_imei: string;
    purchase_proof: boolean;
    box_included: boolean;
  };
  quote: {
    amount: number;
    currency_code: "EUR";
  };
  seller: {
    name: string;
    phone: string;
    document_type: BuybackDocumentType;
    document_no_last4: string;
    verification_note?: string;
  };
  payment: {
    method: "cash" | "bank_transfer" | "store_credit" | "other";
  };
  declarations: {
    ownership_confirmed: boolean;
    data_wipe_authorized: boolean;
    privacy_notice_accepted: boolean;
    agreement_accepted: boolean;
    no_invoice_confirmed: boolean;
    no_box_confirmed: boolean;
  };
}

export function requiredBuybackDocumentSides(documentType: BuybackDocumentType) {
  return documentType === "passport" ? (["id_front"] as const) : (["id_front", "id_back"] as const);
}

export function documentNumberLast4(value: string) {
  return value.replace(/\s+/g, "").slice(-4).toUpperCase();
}

export function isSafeBuybackVerificationNote(value: string) {
  const note = value.normalize("NFKC").trim();
  if (note.length > 160) return false;
  if (!note) return true;
  const digits = note.replace(/\D/g, "");
  if (digits.length > 4) return false;
  const compact = note.replace(/[^A-Za-z0-9]/g, "");
  return !/(?=[a-z0-9]*\d)[a-z0-9]{5,}/i.test(compact);
}

export function canonicalizeBuybackAgreement(value: unknown): string {
  return JSON.stringify(sortCanonicalValue(value));
}

export async function hashBuybackAgreementSnapshot(value: unknown): Promise<string> {
  const input = new TextEncoder().encode(canonicalizeBuybackAgreement(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashBuybackLegalText(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hasCurrentBuybackLegalDocuments(snapshot: Record<string, unknown>) {
  const legalDocuments = recordOrEmpty(snapshot.legal_documents);
  const privacyNotice = recordOrEmpty(legalDocuments.privacy_notice);
  const buybackTerms = recordOrEmpty(legalDocuments.buyback_terms);
  return (
    privacyNotice.version === BUYBACK_PRIVACY_NOTICE_VERSION &&
    privacyNotice.sha256 === BUYBACK_PRIVACY_NOTICE_SHA256 &&
    privacyNotice.text === BUYBACK_PRIVACY_NOTICE_TEXT_IT &&
    buybackTerms.version === BUYBACK_AGREEMENT_VERSION &&
    buybackTerms.sha256 === BUYBACK_TERMS_SHA256 &&
    buybackTerms.text === BUYBACK_TERMS_TEXT_IT
  );
}

export function validateBuybackAgreementSnapshot(snapshot: BuybackAgreementSnapshot) {
  const missing: string[] = [];
  if (snapshot.agreement_version !== BUYBACK_AGREEMENT_VERSION) missing.push("协议版本");
  if (snapshot.privacy_notice_version !== BUYBACK_PRIVACY_NOTICE_VERSION)
    missing.push("隐私告知版本");
  if (!hasCurrentBuybackLegalDocuments(snapshot)) missing.push("隐私告知与回收条款正文");
  if (!snapshot.device.model.trim()) missing.push("设备型号");
  if (!snapshot.device.serial_or_imei.trim()) missing.push("IMEI / 序列号");
  if (snapshot.quote.amount <= 0) missing.push("成交金额");
  if (!snapshot.seller.name.trim()) missing.push("卖家姓名");
  if (!snapshot.seller.phone.trim()) missing.push("卖家电话");
  if (!/^[A-Za-z0-9]{1,4}$/.test(snapshot.seller.document_no_last4)) {
    missing.push("证件号码后四位");
  }
  if (!isSafeBuybackVerificationNote(snapshot.seller.verification_note ?? "")) {
    missing.push("核验备注不能包含完整证件号");
  }
  if (!snapshot.payment.method) missing.push("付款方式");
  if (!snapshot.declarations.ownership_confirmed) missing.push("设备所有权声明");
  if (!snapshot.declarations.data_wipe_authorized) missing.push("数据清除授权");
  if (!snapshot.declarations.privacy_notice_accepted) missing.push("隐私告知确认");
  if (!snapshot.declarations.agreement_accepted) missing.push("回收协议确认");
  return missing;
}

function sortCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortCanonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortCanonicalValue(entry)]),
  );
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
