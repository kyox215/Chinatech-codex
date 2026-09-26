import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { StoreMemo } from "@/features/memos/model/contracts";

import { MemoChecklistInline } from "./memo-checklist-inline";

const memo: StoreMemo = {
  id: "memo-a",
  store_id: "store-a",
  kind: "todo",
  title: "Opening",
  content: "",
  checklist: [
    { id: "pending", text: "Open shutters", completed: false },
    { id: "completed", text: "Matched stock count", completed: true },
  ],
  todo_status: "pending",
  due_at: null,
  assignee_membership_id: null,
  assignee_name: null,
  created_by_membership_id: "member-a",
  created_by_name_snapshot: "Owner",
  updated_by_name_snapshot: "Owner",
  completed_at: null,
  archived_at: null,
  version: 1,
  created_at: "2026-09-26T00:00:00.000Z",
  updated_at: "2026-09-26T00:00:00.000Z",
  checklist_total: 2,
  checklist_completed: 1,
  capabilities: {
    canEdit: true,
    canClaim: false,
    canTransition: true,
    canArchive: true,
    canRestore: false,
  },
};

describe("MemoChecklistInline", () => {
  it("checks pending items inline and reveals completed search matches", () => {
    const onToggle = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoChecklistInline memo={memo} search="stock" onRetry={vi.fn()} onToggle={onToggle} />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "切换清单项：Open shutters" }));
    expect(onToggle).toHaveBeenCalledWith(memo.checklist[0], true);
    expect(screen.getByText("Matched stock count")).toBeVisible();
  });

  it("keeps inline controls read only without transition permission", () => {
    render(
      <MemoChecklistInline
        memo={{ ...memo, capabilities: { ...memo.capabilities, canTransition: false } }}
        onRetry={vi.fn()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "切换清单项：Open shutters" })).toBeDisabled();
  });
});
