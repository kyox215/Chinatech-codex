import { ForbiddenError } from "@/server/auth-context";

export const BUYBACK_TRANSPARENT_QUOTE_WRITE_DISABLED_MESSAGE =
  "透明报价写入已暂停；历史记录仍可查看，请稍后重试";

export function isBuybackTransparentQuoteWriteEnabled() {
  return process.env.REPAIRDESK_BUYBACK_TRANSPARENT_QUOTE_WRITE_ENABLED === "1";
}

export function assertBuybackTransparentQuoteWriteEnabled() {
  if (!isBuybackTransparentQuoteWriteEnabled()) {
    throw new ForbiddenError(BUYBACK_TRANSPARENT_QUOTE_WRITE_DISABLED_MESSAGE);
  }
}
