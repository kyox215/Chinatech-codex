import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SettingsNavigationGroup } from "@/features/settings/components/settings-navigation";
import { getSettingsSectionGroups } from "@/features/settings/model/settings-section-registry";
import { SettingsOverviewScreen } from "@/features/settings/screens/settings-overview-screen";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

describe("SettingsOverviewScreen", () => {
  it("renders concise core entries and a collapsed advanced area", () => {
    renderOverview({ state: "ready", score: 80 }, true);

    expect(screen.getByText("先处理常用设置；低频工具收在“更多设置”中。")).toBeVisible();
    expect(screen.getByRole("heading", { name: "常用设置" })).toBeVisible();
    expect(screen.getByRole("link", { name: /店铺资料/ })).toBeVisible();
    expect(
      screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("href")?.startsWith("/settings?section="))
        .map((link) => link.getAttribute("href")),
    ).toEqual([
      "/settings?section=store",
      "/settings?section=members",
      "/settings?section=rules",
      "/settings?section=notifications",
    ]);
    for (const label of ["员工", "默认规则", "通知与打印"]) {
      expect(screen.getByRole("link", { name: new RegExp(`^${label}`) })).toBeVisible();
    }
    expect(screen.queryByText("9 / 10")).not.toBeInTheDocument();
    expect(screen.queryByText("80% 完整")).not.toBeInTheDocument();
    expect(screen.queryByText("Ripara Subito")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /员工.*只读/ })).toHaveAttribute(
      "href",
      "/settings?section=members",
    );
    expect(screen.queryByRole("link", { name: /工单数据/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /消息模板/ })).not.toBeInTheDocument();
    const more = screen.getByRole("button", { name: /更多设置/ });
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /^供应商/ })).toHaveAttribute(
      "href",
      "/settings?section=suppliers",
    );
    expect(screen.queryByRole("link", { name: /工单数据/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /平台审批/ })).toHaveAttribute("href", "/platform");
  });

  it("hides platform approval for non-platform administrators", () => {
    renderOverview({ state: "ready", score: 100 });
    expect(screen.queryByRole("link", { name: /消息模板/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /平台审批/ })).not.toBeInTheDocument();
  });

  it.each([
    [{ state: "loading" as const }, "读取中…"],
    [{ state: "error" as const }, "读取失败"],
    [{ state: "unavailable" as const }, "不可用"],
  ])("does not render the removed readiness panel %#", (readiness, label) => {
    renderOverview(readiness);
    expect(screen.queryByText(label)).not.toBeInTheDocument();
  });

  it("keeps the mobile search useful without exposing blocked entries", () => {
    renderOverview({ state: "ready", score: 100 });

    fireEvent.change(screen.getByLabelText("搜索设置"), { target: { value: "员工" } });
    expect(screen.getByRole("link", { name: /员工/ })).toBeVisible();
    expect(screen.queryByRole("link", { name: /店铺/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /工单数据/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("搜索设置"), { target: { value: "没有结果" } });
    expect(screen.getByText("没有匹配的设置")).toBeVisible();
  });

  it.each([
    ["it-IT" as const, "Impostazioni frequenti", "Negozio", "Altre impostazioni"],
    ["en" as const, "Common settings", "Store", "More settings"],
  ])("renders localized overview presentation for %s", (locale, core, store, more) => {
    renderOverview({ state: "ready", score: 100 }, false, locale);

    expect(screen.getByRole("heading", { name: core })).toBeVisible();
    expect(screen.getByRole("link", { name: new RegExp(`^${store}`) })).toHaveAttribute(
      "href",
      "/settings?section=store",
    );
    expect(screen.getByRole("button", { name: new RegExp(more) })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});

function renderOverview(
  readiness: React.ComponentProps<typeof SettingsOverviewScreen>["readiness"],
  isPlatformAdmin = false,
  locale: AppLocale = "zh-CN",
) {
  return render(
    <LocaleProvider initialLocale={locale}>
      <OverviewHarness readiness={readiness} isPlatformAdmin={isPlatformAdmin} locale={locale} />
    </LocaleProvider>,
  );
}

function OverviewHarness({
  readiness,
  isPlatformAdmin,
  locale,
}: {
  readiness: React.ComponentProps<typeof SettingsOverviewScreen>["readiness"];
  isPlatformAdmin: boolean;
  locale: AppLocale;
}) {
  const [searchValue, setSearchValue] = useState("");
  return (
    <SettingsOverviewScreen
      groups={groups(locale)}
      isPlatformAdmin={isPlatformAdmin}
      activeStoreName="Ripara Subito"
      accessibleSectionCount={9}
      totalSectionCount={10}
      readiness={readiness}
      searchValue={searchValue}
      onSearchValueChange={setSearchValue}
    />
  );
}

function groups(locale: AppLocale): readonly SettingsNavigationGroup[] {
  return getSettingsSectionGroups(locale).map((group) => ({
    key: group.key,
    label: group.label,
    items: group.sections.map((section) => ({
      ...section,
      access:
        section.key === "order-data"
          ? ("blocked" as const)
          : section.key === "members"
            ? ("readonly" as const)
            : ("editable" as const),
      dirty: false,
    })),
  }));
}
