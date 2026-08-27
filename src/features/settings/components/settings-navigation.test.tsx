import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  SettingsNavigation,
  type SettingsNavigationGroup,
} from "@/features/settings/components/settings-navigation";
import { SETTINGS_SECTION_GROUPS } from "@/features/settings/model/settings-section-registry";

describe("SettingsNavigation", () => {
  it("shows accessible core links and keeps advanced settings behind a collapsed fold", () => {
    renderNavigation("store");

    expect(screen.queryByRole("link", { name: "设置总览" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /店铺/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/settings?section=store",
      "/settings?section=members",
      "/settings?section=rules",
      "/settings?section=notifications",
    ]);
    expect(screen.queryByRole("link", { name: /工单数据/ })).not.toBeInTheDocument();
    expect(screen.queryByText("工单数据")).not.toBeInTheDocument();
    const more = screen.getByRole("button", { name: "更多设置" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "供应商" })).toHaveAttribute(
      "href",
      "/settings?section=suppliers",
    );
    expect(screen.queryByRole("link", { name: /工单数据/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/0 个|0 成员|0 台/)).not.toBeInTheDocument();
  });

  it("exposes readonly and dirty states without rendering the removed rail search", () => {
    renderNavigation(null);

    expect(screen.getByRole("link", { name: /员工.*未保存.*只读/ })).toBeInTheDocument();
    expect(screen.queryByLabelText("搜索设置")).not.toBeInTheDocument();
    expect(screen.queryByText("没有匹配的设置")).not.toBeInTheDocument();
  });

  it("allows a future dirty guard to cancel section navigation", () => {
    const onBeforeNavigate = vi.fn(() => false);
    render(
      <SettingsNavigation
        groups={groups()}
        activeSection={null}
        searchValue=""
        onSearchValueChange={vi.fn()}
        onBeforeNavigate={onBeforeNavigate}
      />,
    );

    fireEvent.click(screen.getByRole("link", { name: /店铺/ }));
    expect(onBeforeNavigate).toHaveBeenCalledWith("store");
  });
});

function renderNavigation(activeSection: "store" | null) {
  return render(<NavigationHarness activeSection={activeSection} />);
}

function NavigationHarness({ activeSection }: { activeSection: "store" | null }) {
  const [searchValue, setSearchValue] = useState("");
  return (
    <SettingsNavigation
      groups={groups()}
      activeSection={activeSection}
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
      dirty: section.key === "members",
      summary: section.key === "members" ? "只读" : undefined,
    })),
  }));
}
