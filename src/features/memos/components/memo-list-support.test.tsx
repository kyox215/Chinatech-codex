import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MemoFilterControls } from "./memo-list-support";

describe("MemoFilterControls", () => {
  it("keeps status views inside the filter controls", () => {
    const onViewChange = vi.fn();

    render(
      <MemoFilterControls
        search=""
        view="active"
        kind="all"
        assigneeId=""
        assignees={[]}
        onSearchChange={vi.fn()}
        onViewChange={onViewChange}
        onKindChange={vi.fn()}
        onAssigneeChange={vi.fn()}
        onRefresh={vi.fn()}
        showSearch={false}
      />,
    );

    const viewSelect = screen.getByRole("combobox", { name: "查看范围" });
    expect(viewSelect).toHaveValue("active");
    expect(screen.getByRole("option", { name: "待处理" })).toBeInTheDocument();

    fireEvent.change(viewSelect, { target: { value: "overdue" } });
    expect(onViewChange).toHaveBeenCalledWith("overdue");
    expect(screen.queryByRole("textbox", { name: "搜索备忘录标题或正文" })).not.toBeInTheDocument();
  });

  it("keeps desktop search available", () => {
    render(
      <MemoFilterControls
        search="交班"
        view="active"
        kind="all"
        assigneeId=""
        assignees={[]}
        onSearchChange={vi.fn()}
        onViewChange={vi.fn()}
        onKindChange={vi.fn()}
        onAssigneeChange={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox", { name: "搜索备忘录标题或正文" })).toHaveValue("交班");
  });
});
