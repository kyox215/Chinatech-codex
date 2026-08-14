import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceBrandSearch } from "./workspace-brand-search";

describe("WorkspaceBrandSearch", () => {
  it("keeps one accessible search trigger beside the brand and supports collapse", () => {
    const onOpenCommand = vi.fn();
    const { rerender } = render(
      <div className="group" data-collapsible="none">
        <WorkspaceBrandSearch activeStoreName="合成演示店铺" onOpenCommand={onOpenCommand} />
      </div>,
    );

    const trigger = screen.getByRole("button", { name: "打开全局搜索" });
    expect(screen.getByText("RepairDesk")).toBeVisible();
    expect(screen.getByText("合成演示店铺")).toBeVisible();
    expect(trigger).toHaveClass("size-11");
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
