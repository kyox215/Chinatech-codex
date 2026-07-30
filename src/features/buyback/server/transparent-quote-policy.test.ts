import { afterEach, describe, expect, it } from "vitest";

import { ForbiddenError } from "@/server/auth-context";

import {
  assertBuybackTransparentQuoteWriteEnabled,
  isBuybackTransparentQuoteWriteEnabled,
} from "./transparent-quote-policy";

describe("transparent buyback quote write policy", () => {
  const original = process.env.REPAIRDESK_BUYBACK_TRANSPARENT_QUOTE_WRITE_ENABLED;

  afterEach(() => {
    if (original === undefined)
      delete process.env.REPAIRDESK_BUYBACK_TRANSPARENT_QUOTE_WRITE_ENABLED;
    else process.env.REPAIRDESK_BUYBACK_TRANSPARENT_QUOTE_WRITE_ENABLED = original;
  });

  it("fails closed by default and requires an explicit enable flag", () => {
    delete process.env.REPAIRDESK_BUYBACK_TRANSPARENT_QUOTE_WRITE_ENABLED;
    expect(isBuybackTransparentQuoteWriteEnabled()).toBe(false);
    expect(assertBuybackTransparentQuoteWriteEnabled).toThrow(ForbiddenError);

    process.env.REPAIRDESK_BUYBACK_TRANSPARENT_QUOTE_WRITE_ENABLED = "1";
    expect(isBuybackTransparentQuoteWriteEnabled()).toBe(true);
    expect(assertBuybackTransparentQuoteWriteEnabled).not.toThrow();
  });
});
