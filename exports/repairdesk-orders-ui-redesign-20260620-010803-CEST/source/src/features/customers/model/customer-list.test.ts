import { describe, expect, it } from "vitest";

import type { CustomerStats } from "@/lib/repairdesk/types";

import {
  buildCustomerDetailTabs,
  buildCustomerWorkFilterChips,
  getCustomerDetailWorkSummary,
  getCustomerActiveFilterCount,
  getCustomerDetailHref,
  getCustomerListSubtitle,
  getCustomerPageRange,
  getCustomerWorkSummary,
  normalizeCustomerWorkFilter,
  sanitizeCustomerListFilters,
} from "./customer-list";

const stats: CustomerStats = {
  total: 20,
  repeat: 6,
  activeRepairs: 4,
  unpaid: 3,
  withDevices: 12,
  dueFollowups: 2,
  marketable: 8,
};

describe("customer list helpers", () => {
  it("builds repair-focused work filter chips from stats", () => {
    expect(buildCustomerWorkFilterChips(stats)).toEqual([
      { value: "all", label: "全部", shortLabel: "全", count: 20 },
      { value: "active", label: "在修", shortLabel: "修", count: 4 },
      { value: "unpaid", label: "未结清", shortLabel: "款", count: 3 },
      { value: "with_devices", label: "有设备", shortLabel: "设", count: 12 },
      { value: "repeat", label: "老客户", shortLabel: "老", count: 6 },
    ]);
  });

  it("normalizes filters and counts only active business filters", () => {
    const filters = sanitizeCustomerListFilters({
      search: "  Mario  ",
      tagIds: ["vip", "", "repair"],
      work: "unpaid",
      marketing: "blocked",
      followup: "overdue",
    });

    expect(filters).toEqual({
      search: "Mario",
      tagIds: ["vip", "repair"],
      work: "unpaid",
    });
    expect(getCustomerActiveFilterCount(filters)).toBe(3);
    expect(getCustomerListSubtitle(filters, 7)).toBe("未结清 · 共 7 位");
  });

  it("falls back to all customers when the work filter is absent or invalid", () => {
    expect(normalizeCustomerWorkFilter(undefined)).toBe("all");
    expect(normalizeCustomerWorkFilter("active")).toBe("active");
    expect(
      normalizeCustomerWorkFilter(
        "followup" as unknown as Parameters<typeof normalizeCustomerWorkFilter>[0],
      ),
    ).toBe("all");
  });

  it("calculates stable page ranges", () => {
    expect(getCustomerPageRange({ total: 0, page: 3, pageSize: 30 })).toEqual({
      page: 1,
      pageSize: 30,
      pageCount: 1,
      start: 0,
      end: 0,
    });
    expect(getCustomerPageRange({ total: 62, page: 3, pageSize: 30 })).toEqual({
      page: 3,
      pageSize: 30,
      pageCount: 3,
      start: 61,
      end: 62,
    });
  });

  it("builds encoded customer detail links", () => {
    expect(getCustomerDetailHref("abc 123")).toBe("/customers/abc%20123");
  });

  it("summarizes customer work state by operational priority", () => {
    expect(
      getCustomerWorkSummary({
        active_order_count: 2,
        unpaid_amount: 50,
        order_count: 4,
        device_count: 3,
      }),
    ).toMatchObject({ label: "在修 2", actionLabel: "跟进维修进度", tone: "info" });
    expect(
      getCustomerWorkSummary({
        active_order_count: 0,
        unpaid_amount: 20,
        order_count: 4,
        device_count: 3,
      }),
    ).toMatchObject({ label: "未结清", actionLabel: "确认尾款", tone: "warning" });
    expect(
      getCustomerWorkSummary({
        active_order_count: 0,
        unpaid_amount: 0,
        order_count: 3,
        device_count: 2,
      }),
    ).toMatchObject({ label: "老客户", actionLabel: "复用历史设备", tone: "success" });
    expect(
      getCustomerWorkSummary({
        active_order_count: 0,
        unpaid_amount: 0,
        order_count: 0,
        device_count: 1,
      }),
    ).toMatchObject({ label: "有设备", actionLabel: "新工单可复用", tone: "neutral" });
  });

  it("summarizes customer detail state without depending on list stats", () => {
    expect(
      getCustomerDetailWorkSummary({
        customer: {
          id: "c1",
          name: "Mario",
          phone_e164: "+39333",
          phone_raw: "39333",
          contact_phones: [],
          consent_marketing: true,
          consent_sms: true,
        },
        devices: [],
        orders: [
          { id: "o1", status: "completed" },
          { id: "o2", status: "repairing" },
        ] as Parameters<typeof getCustomerDetailWorkSummary>[0]["orders"],
        tags: [],
        interactions: [],
        followups: [],
        stats: {
          order_count: 2,
          total_spent: 120,
          unpaid_amount: 0,
          device_count: 1,
        },
      }),
    ).toMatchObject({ label: "在修 1", actionLabel: "跟进维修进度" });
  });

  it("builds customer detail tabs with operational counts", () => {
    const tabs = buildCustomerDetailTabs({
      customer: {
        id: "c1",
        name: "Mario",
        phone_e164: "+39333",
        phone_raw: "39333",
        contact_phones: [],
        consent_marketing: true,
        consent_sms: true,
      },
      devices: [{ id: "d1" }, { id: "d2" }] as Parameters<
        typeof buildCustomerDetailTabs
      >[0]["devices"],
      orders: [{ id: "o1" }, { id: "o2" }, { id: "o3" }] as Parameters<
        typeof buildCustomerDetailTabs
      >[0]["orders"],
      tags: [{ id: "vip" }] as Parameters<typeof buildCustomerDetailTabs>[0]["tags"],
      interactions: [{ id: "m1" }, { id: "m2" }] as Parameters<
        typeof buildCustomerDetailTabs
      >[0]["interactions"],
      followups: [
        { id: "f1", status: "open" },
        { id: "f2", status: "done" },
      ] as Parameters<typeof buildCustomerDetailTabs>[0]["followups"],
      stats: {
        order_count: 3,
        total_spent: 120,
        unpaid_amount: 0,
        device_count: 2,
      },
    });

    expect(tabs).toEqual([
      { key: "overview", label: "概览" },
      { key: "devices", label: "设备", count: 2 },
      { key: "orders", label: "工单", count: 3 },
      { key: "messages", label: "联系", count: 2 },
      { key: "profile", label: "资料", count: 1 },
      { key: "followups", label: "待办", count: 1 },
      { key: "timeline", label: "记录", count: 7 },
    ]);
  });
});
