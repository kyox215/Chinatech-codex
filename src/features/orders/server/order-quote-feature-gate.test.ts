import { afterEach, describe, expect, it } from "vitest";

import { getOrderQuotePublishRpcName } from "./order-quote.repository";

const previousFlag = process.env.REPAIRDESK_ORDER_COSTS_ENABLED;

afterEach(() => {
  if (previousFlag === undefined) delete process.env.REPAIRDESK_ORDER_COSTS_ENABLED;
  else process.env.REPAIRDESK_ORDER_COSTS_ENABLED = previousFlag;
});

describe("order quote cost rollout gate", () => {
  it("keeps the existing quote RPC until the cost feature is enabled", () => {
    delete process.env.REPAIRDESK_ORDER_COSTS_ENABLED;
    expect(getOrderQuotePublishRpcName()).toBe("repairdesk_publish_order_quote");
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "0";
    expect(getOrderQuotePublishRpcName()).toBe("repairdesk_publish_order_quote");
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    expect(getOrderQuotePublishRpcName()).toBe("repairdesk_publish_order_quote_v2");
  });
});
