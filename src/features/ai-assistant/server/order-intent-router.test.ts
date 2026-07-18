import { describe, expect, it } from "vitest";

import {
  AI_ORDER_DETERMINISTIC_POLICY_VERSION,
  planDeterministicOrderQuery,
} from "./order-intent-router";

describe("deterministic order intent router", () => {
  it.each([
    ["R2026001", "R2026001"],
    ["帮我查工单 RD-12345", "RD-12345"],
    ["please find order #R2026001", "R2026001"],
    ["trova ordine R2026001", "R2026001"],
    ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000001"],
  ])("routes a complete reference without a provider: %s", (message, reference) => {
    expect(planDeterministicOrderQuery({ message, locale: "zh-CN" })).toEqual({
      policyVersion: AI_ORDER_DETERMINISTIC_POLICY_VERSION,
      toolCall: {
        name: "get_order_summary",
        arguments: { order_reference: reference },
      },
    });
  });

  it.each([
    ["查找未付款工单", { paid: "unpaid", overdue: null, queue_group: null }],
    ["查看逾期工单", { paid: "all", overdue: "any", queue_group: null }],
    ["搜索正在维修的订单", { paid: "all", overdue: null, queue_group: "processing" }],
    ["trova ordini non pagati", { paid: "unpaid", overdue: null, queue_group: null }],
  ] as const)("routes the locked phrase %s", (message, filters) => {
    expect(planDeterministicOrderQuery({ message, locale: "zh-CN" })?.toolCall).toMatchObject({
      name: "search_orders",
      arguments: { search: null, view: "active", page_size: 8, ...filters },
    });
  });

  it.each([
    "R2026",
    "990000000000002",
    "+39 333 1234567",
    "查找 Mario 的未付款工单",
    "查询未付款订单",
    "R2026001 或 R2026002",
    "订单 R2026001 状态怎么样",
  ])("falls through instead of guessing: %s", (message) => {
    expect(planDeterministicOrderQuery({ message, locale: "zh-CN" })).toBeNull();
  });
});
