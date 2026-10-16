import type { IntakeReceiptData, IntakePolicy, IntakeSignature } from "./repair-intake-record";
import type { RepairRequirement } from "./repair-requirements";
import { intakeRequirements } from "./repair-requirements";
import { repairDetailProjects } from "./repair-detail-view";
import { repairRequirementRequest } from "./repair-requirement-display";
import { printAccessories, printCustody, printDate, printIssue, printKnownOrOriginal, printLabel, printLanguageName, printMoney, printMonths, printRepairStage, printServiceRequests, type PrintLabel, type PrintLanguage } from "./print-language";
import { repairIntakeAcknowledgement, repairIntakeStatutoryRights, repairIntakeTerms, repairIntakeTermsVersion } from "./repair-print-terms";

export const receiptMaster = { widthMm: 297, heightMm: 210, insetMm: 8, innerWidthMm: 281, innerHeightMm: 194, reserveMm: 1, bodyPt: 14.4, corePt: 16, qrMm: 29, version: "receipt-master-v2" } as const;
export const receiptSmallScale = 74 / 105;
export type ReceiptPaper = "a4" | "a5" | "half" | "double";
export function receiptPaperGeometry(paper: ReceiptPaper) {
  const widthMm = paper === "a4" ? 297 : 210, heightMm = paper === "a4" ? 210 : paper === "a5" ? 148 : 297;
  const scale = paper === "a4" ? 1 : receiptSmallScale;
  const slotHeight = paper === "half" || paper === "double" ? 148.5 : heightMm;
  return { widthMm, heightMm, slots: (paper === "double" ? ["customerCopy", "shopCopy"] as const : ["customerCopy"] as const).map((copy, index) => ({ copy, xMm: (widthMm - receiptMaster.widthMm * scale) / 2, yMm: index * slotHeight + (slotHeight - receiptMaster.heightMm * scale) / 2, scale, widthMm: receiptMaster.widthMm * scale, heightMm: receiptMaster.heightMm * scale })) };
}

// A semantic checksum, not an authorization/security token. Fit invalidation also
// compares the complete canonical JSON and generation, never this checksum alone.
export function canonicalPrintJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalPrintJson).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).filter(key => (value as Record<string, unknown>)[key] !== undefined).sort().map(key => JSON.stringify(key) + ":" + canonicalPrintJson((value as Record<string, unknown>)[key])).join(",") + "}";
  return JSON.stringify(value) ?? "null";
}
export function receiptProjectionHash(serialized: string) {
  let value = BigInt("0xcbf29ce484222325");
  for (let index = 0; index < serialized.length; index++) { value ^= BigInt(serialized.charCodeAt(index)); value = BigInt.asUintN(64, value * BigInt("0x100000001b3")); }
  return `receipt-v2-${value.toString(16).padStart(16, "0")}`;
}
const emptyServices = { screen: { quality: "" as const, technology: "" as const }, battery: { quality: "" as const, appleService: "" as const }, port: { quality: "" as const } };
export function repairPrintProjection(input: { data: IntakeReceiptData; requirements: readonly RepairRequirement[]; policy: IntakePolicy; signature: IntakeSignature | undefined; hasHistory: boolean; language: PrintLanguage; totalCents: number | null; technician: string; status: string; custody: string; formal: boolean; qr: { path: string; size: number } | null }) {
  const { data, requirements, policy, signature, language } = input;
  const t = (key: PrintLabel) => printLabel(key, language);
  const sources = intakeRequirements(data), projects = repairDetailProjects(data, requirements, []);
  const allServices = printServiceRequests(data.services, language);
  // Service coverage comes from typed source fields, never translated prefixes.
  const serviceGroup = (title: "屏幕" | "电池" | "尾插", texts: string[]) => ({ id: `intake:${title}`, title, texts });
  const serviceGroups = [
    serviceGroup("屏幕", printServiceRequests({ ...emptyServices, screen: data.services.screen }, language)),
    serviceGroup("电池", printServiceRequests({ ...emptyServices, battery: data.services.battery }, language)),
    serviceGroup("尾插", printServiceRequests({ ...emptyServices, port: data.services.port }, language)),
  ];
  const unique = (rows: readonly RepairRequirement[]) => new Set(rows.map(row => row.id)).size === rows.length;
  const exact = (current: RepairRequirement, source: RepairRequirement) => current.id === source.id && current.title === source.title && current.request === source.request && Boolean(current.sourceFingerprint) && Boolean(source.sourceFingerprint) && current.sourceFingerprint === source.sourceFingerprint;
  const reviewQuotes = (data.itemQuotes ?? []).filter(quote => projects.unmatchedQuotes.includes(quote) || projects.rows.some(row => row.ambiguous && row.title === quote.item));
  const merged = sources.length > 0 && sources.length === requirements.length && unique(sources) && unique(requirements)
    && requirements.every(row => sources.filter(source => exact(row, source)).length === 1)
    && !projects.rows.some(row => row.ambiguous) && reviewQuotes.length === 0
    && serviceGroups.every(group => !group.texts.length || sources.filter(source => source.id === group.id && source.title === group.title && source.sourceFingerprint).length === 1)
    && serviceGroups.flatMap(group => group.texts).length === allServices.length;
  const request = (row: RepairRequirement) => repairRequirementRequest(row, sources, source => {
    const group = serviceGroups.find(value => value.id === source.id && value.title === source.title);
    return group?.texts.length ? group.texts.join("; ") : source.request;
  });
  const rows = projects.rows.map(row => {
    const group = serviceGroups.find(value => value.id === row.id && value.title === row.title);
    const texts = merged && group?.texts.length ? group.texts : [printKnownOrOriginal(row.title, language), ...(row.request ? [request(row.requirement)] : [])];
    return { id: row.id, revision: row.requirement.revision, rawRequest: row.request, title: row.title, texts, ambiguous: row.ambiguous, amountCents: row.quote?.amountCents, amount: row.ambiguous ? t("pending") : row.quote?.amountCents == null ? t("define") : printMoney(row.quote.amountCents, language) };
  });
  const issue = printIssue(data, language);
  const projection = {
    version: receiptMaster.version, language, merged, facts: { data, requirements, policy, signature: signature ?? null, hasHistory: input.hasHistory },
    shopName: policy.shopName, shopContact: [policy.address, policy.phone ? `${t("receiptPhone")}: ${policy.phone}` : ""].filter(Boolean).join(" · "), orderId: data.id,
    identity: [{ key: "customer", label: t("customer"), value: data.customerName || "—" }, { key: "phone", label: t("phone"), value: data.phone }, { key: "date", label: t("date"), value: printDate(data.previewAt, language) }],
    device: [{ key: "model", label: t("model"), value: data.model }, { key: "brand", label: t("brand"), value: data.brand }, { key: "serial", label: t("serial"), value: data.serial || "—" }],
    shortFacts: [{ key: "category", label: t("category"), value: printKnownOrOriginal(data.category, language) }, { key: "color", label: t("color"), value: printKnownOrOriginal(data.color, language, true) }, { key: "priority", label: t("priority"), value: printKnownOrOriginal(data.priority, language) }],
    total: input.totalCents === null ? t("unquoted") : printMoney(input.totalCents, language), rows,
    reviewQuotes: reviewQuotes.map(quote => ({ item: quote.item, label: printKnownOrOriginal(quote.item, language), associationKind: projects.unmatchedQuotes.includes(quote) ? "unmatched" as const : "ambiguous" as const, note: t(projects.unmatchedQuotes.includes(quote) ? "historicalQuote" : "projectAssociationReview"), amount: quote.amountCents === null ? t("define") : printMoney(quote.amountCents, language) })),
    intakeServices: allServices, issue,
    serviceFacts: [{ key: "diagnosis", label: t("diagnosis"), value: t("incomplete") }, { key: "technician", label: t("technician"), value: input.technician }, { key: "orderType", label: t("orderType"), value: t("repair") }, { key: "status", label: t("status"), value: printRepairStage(input.status, language) }, { key: "custody", label: t("receiptCustody"), value: printCustody(input.custody, language) }, { key: "accessories", label: t("receiptAccessories"), value: printAccessories(data.accessories, language) }, { key: "deposit", label: t("deposit"), value: t("unrecorded") }, { key: "balance", label: t("balance"), value: t("define") }],
    warrantyTitle: `${t("commercialWarranty")} · ${printMonths(policy.months, language)}`, terms: repairIntakeTerms[language], rights: repairIntakeStatutoryRights[language], acknowledgement: repairIntakeAcknowledgement[language], scope: t("currentProjectsSignatureScope"),
    signature: signature ? { strokes: signature.strokes, aspectRatio: signature.aspectRatio, label: `${t("signatureLanguage")}: ${printLanguageName(signature.language, language)} · ${t("signedAt")}: ${printDate(signature.signedAt, language)}`, version: signature.termsVersion } : null,
    signatureHistory: input.hasHistory ? t("historicalSignature") : "", termsVersion: signature?.termsVersion ?? repairIntakeTermsVersion, local: input.formal ? "" : t("local"), qr: input.qr,
    labels: { repairTitle: t("repairTitle"), orderNumber: t("orderNumber"), customerDocument: t("customerDocument"), total: t("total"), projects: t(merged ? "intakeCurrentRequests" : "currentRepairProjects"), description: t("description"), amount: t("amount"), review: t("quotesToReview"), intake: t("intakeRequests"), fault: t("reportedFault"), note: t("receiptIssueNote"), signature: t("receiptSignature"), tracking: t("trackingTitle"), scan: t("scan"), trackingLimit: t(input.formal ? "trackingAuthorizedAccess" : "trackingLimit"), keepReceipt: t("keepReceipt"), evaluate: t("evaluate"), projectReview: t("projectAssociationReview"), qr: t("qr") },
  };
  const serialized = canonicalPrintJson(projection);
  return { ...projection, serialized, canonicalProjectionHash: receiptProjectionHash(serialized) };
}
export type RepairPrintProjection = ReturnType<typeof repairPrintProjection>;
