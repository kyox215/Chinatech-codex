import { afterEach, describe, expect, it } from "vitest";

import {
  isNewOrderSessionStoreChanged,
  isNewOrderSimpleModeEnabled,
} from "./new-order-simple-mode-feature";

const original = process.env.NEXT_PUBLIC_REPAIRDESK_NEW_ORDER_SIMPLE_MODE_ENABLED;

afterEach(() => {
  if (original === undefined) {
    delete process.env.NEXT_PUBLIC_REPAIRDESK_NEW_ORDER_SIMPLE_MODE_ENABLED;
  } else {
    process.env.NEXT_PUBLIC_REPAIRDESK_NEW_ORDER_SIMPLE_MODE_ENABLED = original;
  }
});

describe("new order simple-mode feature gate", () => {
  it("defaults off and only accepts the explicit build value", () => {
    delete process.env.NEXT_PUBLIC_REPAIRDESK_NEW_ORDER_SIMPLE_MODE_ENABLED;
    expect(isNewOrderSimpleModeEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_REPAIRDESK_NEW_ORDER_SIMPLE_MODE_ENABLED = "true";
    expect(isNewOrderSimpleModeEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_REPAIRDESK_NEW_ORDER_SIMPLE_MODE_ENABLED = "1";
    expect(isNewOrderSimpleModeEnabled()).toBe(true);
  });

  it("fails closed while the active-store cache is empty during a store switch", () => {
    expect(isNewOrderSessionStoreChanged(null, undefined)).toBe(false);
    expect(isNewOrderSessionStoreChanged("store-a", "store-a")).toBe(false);
    expect(isNewOrderSessionStoreChanged("store-a", undefined)).toBe(true);
    expect(isNewOrderSessionStoreChanged("store-a", "store-b")).toBe(true);
  });
});
