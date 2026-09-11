import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceBrandSearch } from "./workspace-brand-search";

describe("WorkspaceBrandSearch", () => {
  it("keeps one independent search surface below the scheme-three brand in both sidebar states", () => {
    const onOpenCommand = vi.fn();
    const { rerender } = render(
      <div className="group" data-collapsible="none">
        <WorkspaceBrandSearch activeStoreName="合成演示店铺" onOpenCommand={onOpenCommand} />
      </div>,
    );

    const trigger = screen.getByRole("button", { name: "打开全局搜索" });
    expect(screen.getByText("RepairDesk")).toBeVisible();
    expect(screen.getByTitle("合成演示店铺")).toBeVisible();
    expect(screen.getByText("搜索")).toBeVisible();
    expect(trigger).toHaveClass("scheme-three-global-search", "min-h-11");
    expect(trigger.parentElement).toHaveAttribute("data-scheme-three-brand-search", "true");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(trigger);
    expect(onOpenCommand).toHaveBeenCalledTimes(1);

    rerender(
      <div className="group" data-collapsible="icon">
        <WorkspaceBrandSearch activeStoreName="合成演示店铺" onOpenCommand={onOpenCommand} />
      </div>,
    );
    expect(screen.getByRole("button", { name: "打开全局搜索" })).toHaveAttribute(
      "data-workspace-search-trigger",
      "true",
    );
  });
});
