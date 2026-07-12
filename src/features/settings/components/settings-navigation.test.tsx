import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  SettingsNavigation,
  type SettingsNavigationGroup,
} from "@/features/settings/components/settings-navigation";
import { SETTINGS_SECTION_GROUPS } from "@/features/settings/model/settings-section-registry";

describe("SettingsNavigation", () => {
  it("uses links for accessible views and no links for blocked sections", () => {
    renderNavigation("store");

    expect(screen.getByRole("link", { name: "设置总览" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("link", { name: /店铺/ })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: /工单数据/ })).not.toBeInTheDocument();
    expect(screen.getByText("工单数据").closest("[aria-disabled='true']")).toBeInTheDocument();
    expect(screen.queryByText(/0 个|0 成员|0 台/)).not.toBeInTheDocument();
  });

  it("exposes readonly and dirty states as text and supports search empty state", () => {
    renderNavigation(null);

    expect(screen.getByRole("link", { name: /员工.*未保存.*只读/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("搜索设置"), {
      target: { value: "不存在的设置" },
    });
    expect(screen.getByText("没有匹配的设置")).toBeVisible();
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
