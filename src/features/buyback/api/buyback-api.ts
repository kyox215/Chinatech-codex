import {
  createInventoryIntake,
  createBuybackQuote,
  finalizeBuybackPurchase,
  getBuybackQuoteHistory,
  getInventoryItem,
  listInventoryItems,
  recordBuybackQuoteResponse,
  reviseBuybackQuote,
  transitionInventoryItem,
  updateBuybackItem,
  uploadBuybackAttachment,
} from "@/lib/repairdesk/api";
import type {
  BuybackFinalizeInput,
  CreateBuybackQuoteInput,
  CreateInventoryIntakeInput,
  InventoryAttachmentUploadInput,
  InventoryItemStatus,
  InventoryListFilters,
  RecordBuybackQuoteResponseInput,
  ReviseBuybackQuoteInput,
  UpdateInventoryItemInput,
} from "@/lib/repairdesk/types";

const buybackScope = { sourceTypes: ["buyback"] };

export function listBuybackRecords(
  filters: InventoryListFilters = {},
  options?: { signal?: AbortSignal },
) {
  return listInventoryItems({ ...filters, sourceTypes: buybackScope.sourceTypes }, options);
}

export function createBuybackRecord(input: CreateInventoryIntakeInput) {
  return createInventoryIntake({ ...input, source_type: "buyback" });
}
export function createTransparentBuybackQuote(input: CreateBuybackQuoteInput) {
  return createBuybackQuote(input);
}
export function reviseTransparentBuybackQuote(id: string, input: ReviseBuybackQuoteInput) {
  return reviseBuybackQuote(id, input);
}
export function recordTransparentBuybackResponse(
  id: string,
  input: RecordBuybackQuoteResponseInput,
) {
  return recordBuybackQuoteResponse(id, input);
}
export function readTransparentBuybackHistory(id: string) {
  return getBuybackQuoteHistory(id);
}

export function getBuybackRecord(id: string) {
  return getInventoryItem(id);
}
export function updateBuybackRecord(id: string, input: UpdateInventoryItemInput) {
  return updateBuybackItem(id, input);
}
export function transitionBuybackRecord(
  id: string,
  to: InventoryItemStatus,
  opts?: { reason?: string },
) {
  return transitionInventoryItem(id, to, opts);
}
export function finalizeBuybackRecord(id: string, input: BuybackFinalizeInput) {
  return finalizeBuybackPurchase(id, input);
}
export function uploadBuybackEvidence(id: string, input: InventoryAttachmentUploadInput) {
  return uploadBuybackAttachment(id, input);
}
