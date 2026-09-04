import { describe, expect, it } from "vitest";

import type { AppLocale } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";

import {
  localizeCustomerChannel,
  localizeCustomerCurrentItem,
  localizeCustomerDeviceDeleteReason,
  localizeCustomerFollowupStatus,
  localizeCustomerLanguage,
  localizeCustomerOrderState,
  localizeCustomerPaymentState,
  localizeCustomerQuickGroup,
  localizeCustomerRepairState,
  localizeCustomerTab,
  localizeCustomerWarranty,
  localizeCustomerWorkFilter,
  localizeCustomerWorkSummary,
} from "./customer-i18n";

const locales = ["zh-CN", "it-IT", "en"] as const;
const tFor =
  (locale: AppLocale) =>
  (key: Parameters<typeof translateMessage>[1], values?: Parameters<typeof translateMessage>[2]) =>
    translateMessage(locale, key, values);

describe("customer stable presentation adapters", () => {
  it.each([
    ["zh-CN", "处理中", "要跟进", "在修 2", "待收", "总览"],
    ["it-IT", "In lavorazione", "Da contattare", "In riparazione 2", "Da incassare", "Panoramica"],
    ["en", "In progress", "Follow up", "In repair 2", "Due", "Overview"],
  ] as const)(
    "localizes stable list codes in %s",
    (locale, quick, followup, repair, payment, tab) => {
      const t = tFor(locale);
      expect(localizeCustomerQuickGroup("active", "SOURCE-LABEL", t)).toBe(quick);
      expect(
        localizeCustomerWorkSummary(
          {
            kind: "followup_due",
            label: "SOURCE-LABEL",
            detail: "SOURCE-DETAIL",
            actionLabel: "SOURCE-ACTION",
            tone: "warning",
          },
          t,
        ).label,
      ).toBe(followup);
      expect(localizeCustomerRepairState({ kind: "active", count: 2, label: "SOURCE" }, t)).toBe(
        repair,
      );
      expect(
        localizeCustomerPaymentState({ kind: "outstanding", amount: 9, label: "SOURCE" }, t),
      ).toBe(payment);
      expect(localizeCustomerTab("overview", "SOURCE", t)).toBe(tab);
    },
  );

  it.each(locales)(
    "uses stable summary facts instead of source Chinese wording in %s",
    (locale) => {
      const localized = localizeCustomerWorkSummary(
        {
          kind: "active",
          count: 3,
          label: "源文案已变化",
          detail: "任意源详情",
          actionLabel: "任意源动作",
          tone: "info",
        },
        tFor(locale),
      );
      expect(localized.label).toBe(
        translateMessage(locale, "customers.summary.activeLabel", { count: 3 }),
      );
      expect(localized.label).not.toBe("源文案已变化");
    },
  );

  it.each(locales)("preserves unknown codes and custom dynamic text exactly in %s", (locale) => {
    const t = tFor(locale);
    expect(localizeCustomerQuickGroup("custom", "动态分组 Ω", t)).toBe("动态分组 Ω");
    expect(localizeCustomerWorkFilter("custom", "动态筛选 Ω", t)).toBe("动态筛选 Ω");
    expect(localizeCustomerTab("custom", "动态页签 Ω", t)).toBe("动态页签 Ω");
    expect(localizeCustomerFollowupStatus("custom", "动态状态 Ω", t)).toBe("动态状态 Ω");
    expect(localizeCustomerChannel("custom", "动态渠道 Ω", t)).toBe("动态渠道 Ω");
    expect(localizeCustomerLanguage("custom", "动态语言 Ω", t)).toBe("动态语言 Ω");
    expect(localizeCustomerOrderState("custom", "动态工单状态 Ω", t)).toBe("动态工单状态 Ω");
    expect(localizeCustomerWarranty({ kind: "custom", value: "  动态售后 Ω  " }, t)).toBe(
      "  动态售后 Ω  ",
    );
    expect(localizeCustomerDeviceDeleteReason(undefined, "动态原因 Ω", t)).toBe("动态原因 Ω");
  });

  it.each(locales)("localizes the canonical done follow-up status in %s", (locale) => {
    const t = tFor(locale);
    expect(localizeCustomerFollowupStatus("done", "done", t)).toBe(
      translateMessage(locale, "customers.followup.completed"),
    );
    expect(localizeCustomerFollowupStatus("open", "open", t)).toBe(
      translateMessage(locale, "customers.followup.open"),
    );
    expect(localizeCustomerFollowupStatus("completed", "legacy-completed", t)).toBe(
      "legacy-completed",
    );
  });

  it.each([
    ["zh-CN", "逾期待办", "查看跟进", "短信", "English", "6个月售后"],
    ["it-IT", "Attività scaduta", "Apri follow-up", "SMS", "Inglese", "Assistenza di 6 mesi"],
    ["en", "Overdue task", "Open follow-up", "SMS", "English", "6-month coverage"],
  ] as const)(
    "localizes stable workbench facts in %s",
    (locale, title, action, channel, language, warranty) => {
      const t = tFor(locale);
      const item = localizeCustomerCurrentItem(
        {
          id: "followup:1",
          kind: "overdue_followup",
          tone: "danger",
          titleKind: "overdue_followup",
          title: "SOURCE-TITLE",
          description: "动态跟进标题 Ω",
          actionKind: "view_followup",
          actionLabel: "SOURCE-ACTION",
          sortTime: 1,
          priority: 1,
        },
        t,
      );
      expect(item).toMatchObject({ title, actionLabel: action, description: "动态跟进标题 Ω" });
      expect(localizeCustomerChannel("sms", "SOURCE", t)).toBe(channel);
      expect(localizeCustomerLanguage("en", "SOURCE", t)).toBe(language);
      expect(localizeCustomerWarranty({ kind: "months", count: 6 }, t)).toBe(warranty);
    },
  );
});
