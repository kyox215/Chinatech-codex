import type { InventoryItemStatus } from "@/lib/repairdesk/types";

interface PersistRecordOnlyBuybackQuoteOptions {
  existingItemId: string | null;
  create: () => Promise<{ id: string }>;
  rememberItemId: (id: string) => void;
  loadStatus: (id: string) => Promise<InventoryItemStatus>;
  updateExisting: (id: string) => Promise<unknown>;
  transitionToOfferMade: (id: string) => Promise<unknown>;
}

/**
 * Keeps the quote-only save retryable after a partial success. The newly
 * created ID is remembered before any follow-up request, and a retry observes
 * the server state before deciding whether another transition is necessary.
 */
export async function persistRecordOnlyBuybackQuote({
  existingItemId,
  create,
  rememberItemId,
  loadStatus,
  updateExisting,
  transitionToOfferMade,
}: PersistRecordOnlyBuybackQuoteOptions): Promise<{ id: string }> {
  let id = existingItemId;
  const isNewRecord = !id;
  if (!id) {
    const created = await create();
    id = created.id;
    rememberItemId(id);
  }

  const status = await loadStatus(id);
  if (status !== "intake" && status !== "evaluating" && status !== "offer_made") {
    throw new Error("回收记录状态已变化，请返回列表刷新后再继续");
  }
  if (!isNewRecord) await updateExisting(id);
  if (status === "offer_made") return { id };

  await transitionToOfferMade(id);
  return { id };
}
