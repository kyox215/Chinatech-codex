import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MemoListItem } from "@/features/memos/model/contracts";

import { MemoCard } from "./memo-card";

const pendingTodo: MemoListItem = {
  id: "memo-1",
  kind: "todo",
  title: "更换展示机价格牌",
  todo_status: "pending",
  due_at: "2099-07-28T09:00:00.000Z",
  assignee_membership_id: "member-1",
  assignee_name: "前台员工",
  created_by_name_snapshot: "店长",
  updated_by_name_snapshot: "店长",
  completed_at: null,
  archived_at: null,
  version: 1,
  created_at: "2026-07-27T08:00:00.000Z",
  updated_at: "2026-07-27T09:00:00.000Z",
  capabilities: {
    canEdit: true,
    canClaim: false,
    canTransition: true,
    canArchive: true,
    canRestore: false,
  },
};

describe("MemoCard TodoList interaction", () => {
  it("uses the circular Todo control to complete a pending item and keeps title open separate", () => {
    const onOpen = vi.fn();
    const onTransition = vi.fn();

    render(<MemoCard memo={pendingTodo} onOpen={onOpen} onTransition={onTransition} />);

    fireEvent.click(screen.getByRole("button", { name: "完成待办：更换展示机价格牌" }));
    expect(onTransition).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "打开备忘：更换展示机价格牌" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("offers reopen for a completed Todo and disables the transition while busy", () => {
    render(
      <MemoCard
        memo={{
          ...pendingTodo,
          todo_status: "completed",
          completed_at: "2026-07-27T10:00:00.000Z",
        }}
        busy
        onOpen={vi.fn()}
        onTransition={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "重新打开待办：更换展示机价格牌" })).toBeDisabled();
    expect(screen.getByText("已完成")).toBeInTheDocument();
  });

  it("renders a note without a Todo transition control", () => {
    render(
      <MemoCard
        memo={{
          ...pendingTodo,
          kind: "note",
          todo_status: null,
          due_at: null,
          capabilities: { ...pendingTodo.capabilities, canTransition: false },
        }}
        onOpen={vi.fn()}
        onTransition={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("普通记录")).toBeInTheDocument();
    expect(screen.getByText("记录")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "完成待办：更换展示机价格牌" }),
    ).not.toBeInTheDocument();
  });
});
