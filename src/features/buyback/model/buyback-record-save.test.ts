import { describe, expect, it, vi } from "vitest";

import type { InventoryItemStatus } from "@/lib/repairdesk/types";

import { persistRecordOnlyBuybackQuote } from "./buyback-record-save";

describe("persistRecordOnlyBuybackQuote", () => {
  it("reuses the created record after a transition response fails", async () => {
    let rememberedItemId: string | null = null;
    let status: InventoryItemStatus = "intake";
    const create = vi.fn(async () => ({ id: "item-created-once" }));
    const loadStatus = vi.fn(async () => status);
    const transitionToOfferMade = vi.fn(async () => {
      status = "offer_made";
      throw new Error("network response lost");
    });
    const rememberItemId = vi.fn((id: string) => {
      rememberedItemId = id;
    });
    const updateExisting = vi.fn(async () => undefined);

    await expect(
      persistRecordOnlyBuybackQuote({
        existingItemId: rememberedItemId,
        create,
        rememberItemId,
        loadStatus,
        updateExisting,
        transitionToOfferMade,
      }),
    ).rejects.toThrow("network response lost");

    await expect(
      persistRecordOnlyBuybackQuote({
        existingItemId: rememberedItemId,
        create,
        rememberItemId,
        loadStatus,
        updateExisting,
        transitionToOfferMade,
      }),
    ).resolves.toEqual({ id: "item-created-once" });

    expect(create).toHaveBeenCalledTimes(1);
    expect(rememberItemId).toHaveBeenCalledWith("item-created-once");
    expect(transitionToOfferMade).toHaveBeenCalledTimes(1);
    expect(loadStatus).toHaveBeenCalledTimes(2);
    expect(updateExisting).toHaveBeenCalledTimes(1);
    expect(updateExisting).toHaveBeenCalledWith("item-created-once");
  });

  it("does not overwrite a record that has moved beyond the quote-only states", async () => {
    const transitionToOfferMade = vi.fn();

    await expect(
      persistRecordOnlyBuybackQuote({
        existingItemId: "item-purchased",
        create: vi.fn(),
        rememberItemId: vi.fn(),
        loadStatus: async () => "purchased",
        updateExisting: vi.fn(),
        transitionToOfferMade,
      }),
    ).rejects.toThrow(/状态已变化/);
    expect(transitionToOfferMade).not.toHaveBeenCalled();
  });
});
