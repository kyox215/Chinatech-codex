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
    "有没有什么是金额异常的",
    "查看金额异常工单",
    "有哪些金额不一致的工单",
    "show orders with amount anomalies",
    "mostra ordini con importi anomali",
  ])("routes amount-consistency review locally without a provider: %s", (message) => {
    expect(planDeterministicOrderQuery({ message, locale: "zh-CN" })?.toolCall).toEqual({
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

  it.each([
    ["苹果15", "iPhone 15"],
    ["有没有苹果15系列的单子", "iPhone 15"],
    ["查找苹果 15 Pro 工单", "iPhone 15 pro"],
    ["find iPhone15 orders", "iPhone 15"],
    ["trova Samsung A12", "Samsung a12"],
  ])("routes a concrete device query locally without a provider: %s", (message, deviceSearch) => {
    expect(planDeterministicOrderQuery({ message, locale: "zh-CN" })?.toolCall).toEqual({
      name: "search_orders",
      arguments: {
        search: null,
        device_search: deviceSearch,
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

  it.each([
    "R2026",
    "990000000000002",
    "+39 333 1234567",
    "查找 Mario 的未付款工单",
    "R2026001 或 R2026002",
    "订单 R2026001 状态怎么样",
  ])("falls through instead of guessing: %s", (message) => {
    expect(planDeterministicOrderQuery({ message, locale: "zh-CN" })).toBeNull();
  });

  it("combines device, previous calendar week, and server-owned created date", () => {
    expect(
      planDeterministicOrderQuery({ message: "上个星期有什么是苹果13系列", locale: "zh-CN" })
        ?.toolCall,
    ).toMatchObject({
      name: "search_orders",
      arguments: {
        device_search: "iPhone 13",
        view: "all",
        date_filter: { expression: "previous_calendar_week", field: "created_at" },
      },
    });
  });

  it("qualifies completed screen work as quote evidence instead of performed proof", () => {
    expect(
      planDeterministicOrderQuery({
        message: "今年这个月内有什么是三星 A12 的，处理过的，换过屏幕的",
        locale: "zh-CN",
      })?.toolCall,
    ).toMatchObject({
      name: "search_orders",
      arguments: {
        device_search: "Samsung a12",
        view: "all",
        completed_only: true,
        service_group: "display",
        date_filter: { expression: "current_calendar_month", field: "completed_at" },
      },
    });
  });

  it("treats today's parts-to-order wording as the current needed queue", () => {
    expect(
      planDeterministicOrderQuery({ message: "今天有哪些还未订配件需要我下单", locale: "zh-CN" })
        ?.toolCall,
    ).toMatchObject({
      name: "search_orders",
      arguments: { parts_status: "needed", date_filter: null },
    });
  });

  it("compiles the reported half-year Apple 15 sentence without adding finance or status filters", () => {
    expect(
      planDeterministicOrderQuery({
        message: "检查半年内所有的苹果15系列的手机",
        locale: "zh-CN",
      })?.toolCall,
    ).toEqual({
      name: "search_orders",
      arguments: {
        search: null,
        device_search: "iPhone 15",
        view: "all",
        paid: "all",
        overdue: null,
        queue_group: null,
        financial_review: null,
        date_filter: {
          expression: "rolling_period",
          amount: 6,
          unit: "month",
          field: "created_at",
        },
        service_group: null,
        completed_only: false,
        parts_status: null,
        page_size: 8,
      },
    });
  });

  it("refuses to execute a device-only fallback when a date expression is invalid", () => {
    expect(
      planDeterministicOrderQuery({ message: "苹果15 2026-02-30", locale: "zh-CN" }),
    ).toBeNull();
  });

  it("keeps an arbitrary month range and device together", () => {
    expect(
      planDeterministicOrderQuery({
        message: "2024年2月到2025年3月的苹果15系列订单",
        locale: "zh-CN",
      })?.toolCall,
    ).toMatchObject({
      name: "search_orders",
      arguments: {
        device_search: "iPhone 15",
        view: "all",
        date_filter: {
          expression: "absolute_range",
          field: "created_at",
          from: "2024-02-01",
          to: "2025-03-31",
        },
      },
    });
  });
});
