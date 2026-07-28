import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-mobile", () => ({ useIsCompactWorkspace: () => false }));

import {
  getMemoFilterCount,
  getMemoFilterLabels,
  MemoFiltersOverlay,
  MemoLoadMore,
} from "./memo-list-support";

const assignees = [
  { membershipId: "member-1", displayName: "王师傅", role: "technician" as const },
];

describe("memo filter helpers", () => {
  it("keeps the default view visually quiet and counts only active filters", () => {
    expect(getMemoFilterCount({ view: "active", kind: "all", assigneeId: "" })).toBe(0);
    expect(getMemoFilterCount({ view: "overdue", kind: "todo", assigneeId: "member-1" })).toBe(3);
    expect(
      getMemoFilterLabels({ view: "overdue", kind: "todo", assigneeId: "member-1" }, assignees),
    ).toEqual(["超期", "待办", "王师傅"]);
  });
});

describe("MemoFiltersOverlay", () => {
  it("uses pill choices and applies the draft only after confirmation", () => {
    const onApply = vi.fn();

    render(
      <MemoFiltersOverlay
        open
        value={{ view: "active", kind: "all", assigneeId: "" }}
        assignees={assignees}
        onOpenChange={vi.fn()}
        onApply={onApply}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveClass("max-w-lg", "rounded-2xl");
    fireEvent.click(screen.getByRole("button", { name: "超期" }));
    fireEvent.click(screen.getByRole("button", { name: "待办" }));
    fireEvent.change(screen.getByRole("combobox", { name: "负责人" }), {
      target: { value: "member-1" },
    });
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "查看结果" }));
    expect(onApply).toHaveBeenCalledWith({
      view: "overdue",
      kind: "todo",
      assigneeId: "member-1",
    });
  });
});

describe("MemoLoadMore", () => {
  it("shows one progressive action without previous or next controls", () => {
    const onLoadMore = vi.fn();
    render(<MemoLoadMore hasMore loading={false} onLoadMore={onLoadMore} />);

    fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
    expect(onLoadMore).toHaveBeenCalledOnce();
    expect(screen.queryByText("上一页")).not.toBeInTheDocument();
    expect(screen.queryByText("下一页")).not.toBeInTheDocument();
  });

  it("stays hidden when all records are loaded", () => {
    const { container } = render(
      <MemoLoadMore hasMore={false} loading={false} onLoadMore={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
