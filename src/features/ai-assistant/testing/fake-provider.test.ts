import { describe, expect, it } from "vitest";

import { FakeAiAssistantProvider } from "./fake-provider";

describe("FakeAiAssistantProvider", () => {
  const provider = new FakeAiAssistantProvider();

  it("plans a deterministic summary lookup without actor or store arguments", async () => {
    const result = await provider.planOrderQuery({
      message: "帮我查工单 RD-12345",
      locale: "zh-CN",
    });
    expect(result.toolCall).toEqual({
      name: "get_order_summary",
      arguments: { order_reference: "RD-12345" },
    });
    expect(JSON.stringify(result.toolCall)).not.toMatch(/actor|store/i);
  });

  it("preserves the legacy provider fallback for a reference inside free text", async () => {
    const result = await provider.planOrderQuery({
      message: "订单 R2026001 状态怎么样",
      locale: "zh-CN",
    });
    expect(result.toolCall).toEqual({
      name: "get_order_summary",
      arguments: { order_reference: "R2026001" },
    });
  });

  it.each([
    ["查找未付款工单", { paid: "unpaid", overdue: null, queue_group: null }],
    ["查看逾期工单", { paid: "all", overdue: "any", queue_group: null }],
    ["搜索正在维修的订单", { paid: "all", overdue: null, queue_group: "processing" }],
  ] as const)(
    "maps the visible suggestion %s to filters without a stray search term",
    async (message, filters) => {
      const result = await provider.planOrderQuery({ message, locale: "zh-CN" });

      expect(result.toolCall).toMatchObject({
        name: "search_orders",
        arguments: { search: null, ...filters },
      });
    },
  );

  it("keeps the synthetic label fixture free of identifiers and price guesses", async () => {
    const result = await provider.recognizeInventoryLabel({
      clientRequestId: "00000000-0000-4000-8000-000000000001",
      imageDataUrl: "data:image/jpeg;base64,ZmFrZQ==",
      mimeType: "image/jpeg",
      locale: "zh-CN",
      fixtureKey: "synthetic-redmi-a7-pro-box",
    });
    expect(result.recognition.fields.ram_capacity.value).toBe("4 GB");
    expect(result.recognition.fields.storage_capacity.value).toBe("64 GB");
    expect(result.recognition.identifiers).toEqual([]);
    expect(result.recognition.label_claim_only).toBe(true);
    expect(JSON.stringify(result.recognition)).not.toMatch(/cost|price|imei\d{4}/i);
  });

  it("uses the structured amount-review filter instead of searching for an abstract concept", async () => {
    const result = await provider.planOrderQuery({
      message: "帮我看一下有没有金额不一致的工单",
      locale: "zh-CN",
    });

    expect(result.toolCall).toEqual({
      name: "search_orders",
      arguments: {
        search: null,
        device_search: null,
        view: "active",
        paid: "all",
        overdue: null,
        queue_group: null,
        financial_review: "amount_anomaly",
        date_filter: null,
        service_group: null,
        completed_only: false,
        parts_status: null,
        page_size: 8,
      },
    });
  });

  it("preserves the Apple brand and model in the device-only search field", async () => {
    const result = await provider.planOrderQuery({ message: "苹果15", locale: "zh-CN" });

    expect(result.toolCall).toEqual({
      name: "search_orders",
      arguments: {
        search: null,
        device_search: "iPhone 15",
        view: "active",
        paid: "all",
        overdue: null,
        queue_group: null,
        financial_review: null,
        date_filter: null,
        service_group: null,
        completed_only: false,
        parts_status: null,
        page_size: 8,
      },
    });
  });
});
