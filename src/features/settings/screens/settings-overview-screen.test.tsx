import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SettingsNavigationGroup } from "@/features/settings/components/settings-navigation";
import { SETTINGS_SECTION_GROUPS } from "@/features/settings/model/settings-section-registry";
import { SettingsOverviewScreen } from "@/features/settings/screens/settings-overview-screen";

describe("SettingsOverviewScreen", () => {
  it("renders four groups, ten entries, readonly and blocked semantics", () => {
    renderOverview({ state: "ready", score: 80 });

    expect(screen.getByRole("heading", { name: "设置总览" })).toBeVisible();
    for (const label of ["个人与访问", "店铺运营", "业务规则", "输出与数据"]) {
      expect(screen.getByRole("heading", { name: label })).toBeVisible();
    }
    expect(screen.getByText("9 / 10")).toBeVisible();
    expect(screen.getByText("80% 完整")).toBeVisible();
    expect(screen.getByRole("link", { name: /员工.*只读/ })).toHaveAttribute(
      "href",
      "/settings?section=members",
    );
    expect(screen.queryByRole("link", { name: /工单数据/ })).not.toBeInTheDocument();
  });

  it.each([
    [{ state: "loading" as const }, "读取中…"],
    [{ state: "error" as const }, "读取失败"],
    [{ state: "unavailable" as const }, "不可用"],
  ])("renders the readiness state %#", (readiness, label) => {
    renderOverview(readiness);
    expect(screen.getByRole("status")).toHaveTextContent(label);
  });

  it("filters entry cards and shows a clear empty state", () => {
    renderOverview({ state: "ready", score: 100 });

    fireEvent.change(screen.getByLabelText("搜索设置"), { target: { value: "Excel" } });
    expect(screen.getByText("工单数据")).toBeVisible();
    expect(screen.queryByText("员工")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("搜索设置"), { target: { value: "没有结果" } });
    expect(screen.getByText("没有匹配的设置")).toBeVisible();
  });
});

function renderOverview(
  readiness: React.ComponentProps<typeof SettingsOverviewScreen>["readiness"],
) {
  return render(<OverviewHarness readiness={readiness} />);
}

function OverviewHarness({
  readiness,
}: {
  readiness: React.ComponentProps<typeof SettingsOverviewScreen>["readiness"];
}) {
  const [searchValue, setSearchValue] = useState("");
  return (
    <SettingsOverviewScreen
      groups={groups()}
      activeStoreName="Ripara Subito"
      accessibleSectionCount={9}
      totalSectionCount={10}
      readiness={readiness}
      searchValue={searchValue}
      onSearchValueChange={setSearchValue}
    />
  );
}

function groups(): readonly SettingsNavigationGroup[] {
  return SETTINGS_SECTION_GROUPS.map((group) => ({
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
