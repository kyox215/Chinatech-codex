import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StoreMemo } from "@/features/memos/model/contracts";
import { NavigationGuardProvider } from "@/components/navigation-guard-provider";

import { MemoEditor } from "./memo-editor";

vi.mock("@/hooks/use-mobile", () => ({ useIsCompactWorkspace: () => false }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const memo: StoreMemo = {
  id: "10000000-0000-4000-8000-000000000001",
  store_id: "20000000-0000-4000-8000-000000000001",
  kind: "todo",
  title: "交班",
  content: "检查库存",
  todo_status: "pending",
  due_at: null,
  assignee_membership_id: null,
  assignee_name: null,
  created_by_membership_id: "30000000-0000-4000-8000-000000000001",
  created_by_name_snapshot: "Owner",
  updated_by_name_snapshot: "Owner",
  completed_at: null,
  archived_at: null,
  version: 1,
  created_at: "2026-07-27T00:00:00.000Z",
  updated_at: "2026-07-27T00:00:00.000Z",
  capabilities: {
    canEdit: true,
    canClaim: true,
    canTransition: true,
    canArchive: true,
    canRestore: false,
  },
};

describe("MemoEditor draft action fences", () => {
  it("disables claim and archive while the body has unsaved changes", async () => {
    const onReloadLatest = vi.fn();
    const view = render(
      <NavigationGuardProvider>
        <MemoEditor
          open
          memo={memo}
          latestVersion={1}
          assignees={[]}
          canAssignAny
          onOpenChange={vi.fn()}
          onSave={vi.fn()}
          onReloadLatest={onReloadLatest}
          onClaim={vi.fn()}
          onArchive={vi.fn()}
        />
      </NavigationGuardProvider>,
    );

    await userEvent.type(screen.getByLabelText("正文"), " 未保存");

    expect(screen.getByRole("button", { name: "领取" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "归档" })).toBeDisabled();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-describedby");

    view.rerender(
      <NavigationGuardProvider>
        <MemoEditor
          open
          memo={memo}
          latestVersion={2}
          assignees={[]}
          canAssignAny
          onOpenChange={vi.fn()}
          onSave={vi.fn()}
          onReloadLatest={onReloadLatest}
          onClaim={vi.fn()}
          onArchive={vi.fn()}
        />
      </NavigationGuardProvider>,
    );

    expect(screen.getByLabelText("正文")).toHaveValue("检查库存 未保存");
    expect(screen.getByText("这条记录已被更新")).toBeVisible();
    expect(screen.getByRole("button", { name: "保存修改" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "载入最新版本" }));
    expect(onReloadLatest).toHaveBeenCalledOnce();
  });

  it("guards dirty close and reuses the operation id when create is retried", async () => {
    const onOpenChange = vi.fn();
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error("网络超时"))
      .mockResolvedValueOnce(undefined);
    render(
      <NavigationGuardProvider>
        <MemoEditor
          open
          memo={null}
          assignees={[]}
          canAssignAny
          onOpenChange={onOpenChange}
          onSave={onSave}
        />
      </NavigationGuardProvider>,
    );

    await userEvent.type(screen.getByLabelText("标题"), "交班事项");
    expect(screen.getByRole("group", { name: "备忘类型" })).toBeVisible();
    expect(screen.getByRole("button", { name: "普通记录" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("标题")).toBeRequired();
    await userEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(await screen.findByText(/备忘录草稿有未保存修改/)).toBeVisible();
    expect(onOpenChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "取消" }));

    await userEvent.click(screen.getByRole("button", { name: "创建备忘" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "创建备忘" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave.mock.calls[1][0].operationId).toBe(onSave.mock.calls[0][0].operationId);
  });

  it("does not let scoped staff clear an existing assignee", () => {
    render(
      <NavigationGuardProvider>
        <MemoEditor
          open
          memo={{ ...memo, assignee_membership_id: memo.created_by_membership_id }}
          latestVersion={1}
          assignees={[]}
          canAssignAny={false}
          membershipId={memo.created_by_membership_id}
          onOpenChange={vi.fn()}
          onSave={vi.fn()}
        />
      </NavigationGuardProvider>,
    );

    expect(screen.getByLabelText("负责人")).toBeDisabled();
  });
});
