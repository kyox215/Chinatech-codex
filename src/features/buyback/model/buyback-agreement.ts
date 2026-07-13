import type { BuybackDocumentType } from "@/lib/repairdesk/types";

export const BUYBACK_AGREEMENT_VERSION = "chinatech-buyback-v1";
export const BUYBACK_PRIVACY_NOTICE_VERSION = "chinatech-privacy-v1";
export const BUYBACK_AGREEMENT_LANGUAGE = "it-IT";
export const BUYBACK_PRIVACY_NOTICE_TEXT_IT = [
  "INFORMATIVA PRIVACY PER IL RITIRO DI DISPOSITIVI USATI (art. 13 GDPR)",
  "Titolare del trattamento: Chinatech, Viale Vittorio Veneto 7, 96014 Floridia (SR), Italia. Contatto per privacy e diritti: kyox120@gmail.com.",
  "Dati e finalità: trattiamo dati identificativi e di contatto, immagini del documento, ultime quattro cifre del documento, firma, dati del dispositivo e del pagamento per verificare identità e titolarità, eseguire la compravendita e il pagamento, prevenire frodi, adempiere obblighi contabili e legali e tutelare i nostri diritti. Questi dati non sono usati per marketing.",
  "Basi giuridiche: esecuzione del contratto e misure precontrattuali, adempimento di obblighi di legge e legittimo interesse alla prevenzione delle frodi e alla difesa di diritti.",
  "Destinatari e sicurezza: accedono solo personale autorizzato e fornitori tecnici, contabili o professionali necessari e vincolati alla riservatezza. I dati non sono diffusi. Eventuali trasferimenti fuori dallo SEE avvengono solo con le garanzie richieste dal GDPR.",
  "Conservazione: i dati sono conservati per il tempo necessario alla compravendita e fino alla scadenza dei termini legali, contabili e di contestazione applicabili; le immagini del documento e la firma sono cancellate o rese anonime quando non sono più necessarie, salvo obbligo di legge o blocco per contenzioso.",
  "Diritti: puoi chiedere accesso, rettifica, cancellazione, limitazione, opposizione e portabilità quando applicabile, scrivendo al contatto sopra indicato; puoi inoltre proporre reclamo al Garante per la protezione dei dati personali. Il conferimento dei dati necessari è facoltativo, ma senza di essi non possiamo completare il ritiro. Non sono adottate decisioni esclusivamente automatizzate.",
].join("\n\n");
export const BUYBACK_TERMS_TEXT_IT = [
  "CONDIZIONI DI CESSIONE DEL DISPOSITIVO USATO",
  "Il venditore dichiara di essere maggiorenne, proprietario del dispositivo o legittimato a venderlo, e che il dispositivo non è rubato, smarrito, sottoposto a vincoli o gravato da diritti di terzi.",
  "Il venditore conferma che identità, contatti, IMEI o numero di serie, caratteristiche, stato del dispositivo, accessori e documenti indicati nel riepilogo sono corretti e autorizza Chinatech a verificarli.",
  "Prima della consegna il venditore deve effettuare il proprio backup, rimuovere SIM e account personali e disattivare blocchi di attivazione. Il venditore autorizza Chinatech a cancellare i dati residui dal dispositivo; Chinatech non risponde della perdita di dati non salvati dal venditore.",
  "Il prezzo e il metodo di pagamento sono quelli mostrati nel riepilogo firmato. La cessione diventa definitiva al pagamento confermato. Chinatech può testare, riparare, ricondizionare, riciclare o rivendere il dispositivo nel rispetto della legge.",
  "L'eventuale assenza di fattura, confezione o accessori e i difetti rilevati sono registrati nel riepilogo. Le immagini del documento e la firma sono utilizzate come prova della cessione secondo l'informativa privacy sopra riportata.",
  "Con la firma il venditore accetta il riepilogo del dispositivo, l'importo, il pagamento, le dichiarazioni e la presente versione delle condizioni. Una copia può essere richiesta al negozio.",
].join("\n\n");
export const BUYBACK_PRIVACY_NOTICE_SHA256 =
  "6dc1170ad137c5c8e0b027c24f47adae7f3cada24bf3e9432e4495999996eec6";
export const BUYBACK_TERMS_SHA256 =
  "6078b738a34bbe22e01b004cef8ebd58f3ae914b941adf605302540c35d73361";

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
