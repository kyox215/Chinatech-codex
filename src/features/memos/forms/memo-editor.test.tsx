import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StoreMemo } from "@/features/memos/model/contracts";
import { NavigationGuardProvider } from "@/components/navigation-guard-provider";

import { MemoEditor } from "./memo-editor";

vi.mock("@/hooks/use-mobile", () => ({ useIsCompactWorkspace: () => false }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

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
    expect(screen.getByRole("button", { name: "待办" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "待办" })).toHaveClass(
      "bg-[var(--memo-quick-entry-action)]",
      "text-[var(--memo-quick-entry-action-foreground)]",
    );
    expect(screen.getByRole("button", { name: "记录" })).toHaveClass(
      "bg-[var(--memo-quick-entry-field)]",
    );
    expect(screen.getByRole("button", { name: "添加待办" })).toHaveClass(
      "bg-[var(--memo-quick-entry-action)]",
      "text-[var(--memo-quick-entry-action-foreground)]",
    );
    expect(screen.getByText("本店成员可见")).toBeVisible();
    expect(screen.getByLabelText("标题")).toHaveClass(
      "bg-[var(--memo-quick-entry-field)]",
      "rounded-lg",
    );
    expect(screen.queryByLabelText("正文（可选）")).not.toBeInTheDocument();
    expect(screen.getByLabelText("标题")).toBeRequired();
    await userEvent.click(screen.getByRole("button", { name: "关闭备忘录" }));
    expect(await screen.findByText(/备忘录草稿有未保存修改/)).toBeVisible();
    expect(onOpenChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "取消" }));

    await userEvent.click(screen.getByRole("button", { name: "添加详情" }));
    fireEvent.change(screen.getByLabelText("到期时间"), {
      target: { value: "2026-07-14T10:30" },
    });

    await userEvent.click(screen.getByRole("button", { name: "添加待办" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    await userEvent.type(screen.getByLabelText("标题"), "（更新）");
    await userEvent.click(screen.getByRole("button", { name: "添加待办" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave.mock.calls[1][0].operationId).toBe(onSave.mock.calls[0][0].operationId);
    expect(onSave.mock.calls[0][0]).toEqual({
      operationId: onSave.mock.calls[0][0].operationId,
      kind: "todo",
      title: "交班事项",
      content: "",
      dueAt: "2026-07-14T08:30:00.000Z",
      assigneeMembershipId: null,
    });
    expect(onSave.mock.calls[1][0]).toEqual({
      operationId: onSave.mock.calls[0][0].operationId,
      kind: "todo",
      title: "交班事项（更新）",
      content: "",
      dueAt: "2026-07-14T08:30:00.000Z",
      assigneeMembershipId: null,
    });
  });

  it("creates a todo with an exact locale-free Rome instant and unchanged field shape", async () => {
    const operationId = "40000000-0000-4000-8000-000000000001";
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(operationId);
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <NavigationGuardProvider>
        <MemoEditor
          open
          memo={null}
          assignees={[
            {
              membershipId: memo.created_by_membership_id,
              displayName: "Owner",
              role: "owner",
            },
          ]}
          canAssignAny
          onOpenChange={vi.fn()}
          onSave={onSave}
        />
      </NavigationGuardProvider>,
    );

    await userEvent.type(screen.getByLabelText("标题"), "Rome follow-up");
    await userEvent.click(screen.getByRole("button", { name: "添加详情" }));
    await userEvent.type(screen.getByLabelText("正文（可选）"), "Keep canonical body");
    fireEvent.change(screen.getByLabelText("到期时间"), {
      target: { value: "2026-07-14T10:30" },
    });
    await userEvent.selectOptions(screen.getByLabelText("负责人"), memo.created_by_membership_id);
    await userEvent.click(screen.getByRole("button", { name: "添加待办" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith({
      operationId,
      kind: "todo",
      title: "Rome follow-up",
      content: "Keep canonical body",
      dueAt: "2026-07-14T08:30:00.000Z",
      assigneeMembershipId: memo.created_by_membership_id,
    });
  });

  it("retains the draft, operation id, and exact due instant for an unchanged retry", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error("result unknown"))
      .mockResolvedValueOnce(undefined);
    render(
      <NavigationGuardProvider>
        <MemoEditor
          open
          memo={null}
          assignees={[]}
          canAssignAny
          onOpenChange={vi.fn()}
          onSave={onSave}
        />
      </NavigationGuardProvider>,
    );

    await userEvent.type(screen.getByLabelText("标题"), "保留草稿");
    await userEvent.click(screen.getByRole("button", { name: "添加详情" }));
    await userEvent.type(screen.getByLabelText("正文（可选）"), "result unknown draft");
    fireEvent.change(screen.getByLabelText("到期时间"), {
      target: { value: "2026-02-14T10:30" },
    });
    const submit = screen.getByRole("button", { name: "添加待办" });
    await userEvent.click(submit);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    expect(screen.getByLabelText("标题")).toHaveValue("保留草稿");
    expect(screen.getByLabelText("正文（可选）")).toHaveValue("result unknown draft");
    expect(screen.getByLabelText("到期时间")).toHaveValue("2026-02-14T10:30");
    await userEvent.click(submit);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave.mock.calls[1][0]).toEqual(onSave.mock.calls[0][0]);
    expect(onSave.mock.calls[1][0].dueAt).toBe("2026-02-14T09:30:00.000Z");
  });

  it("updates with exact versioned fields and preserves server seconds and milliseconds", async () => {
    const operationId = "40000000-0000-4000-8000-000000000002";
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(operationId);
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <NavigationGuardProvider>
        <MemoEditor
          open
          memo={{ ...memo, due_at: "2026-07-14T08:30:45.123Z", version: 7 }}
          latestVersion={7}
          assignees={[]}
          canAssignAny
          onOpenChange={vi.fn()}
          onSave={onSave}
        />
      </NavigationGuardProvider>,
    );

    expect(screen.getByLabelText("到期时间")).toHaveValue("2026-07-14T10:30");
    await userEvent.type(screen.getByLabelText("正文"), " updated");
    await userEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith({
      operationId,
      id: memo.id,
      expectedVersion: 7,
      title: "交班",
      content: "检查库存 updated",
      dueAt: "2026-07-14T08:30:45.123Z",
      assigneeMembershipId: null,
    });
  });

  it.each([
    ["2026-10-25T00:30:00.000Z", "40000000-0000-4000-8000-000000000003"],
    ["2026-10-25T01:30:00.000Z", "40000000-0000-4000-8000-000000000004"],
  ])(
    "preserves the absolute overlap instant %s when only a non-date field changes",
    async (dueAtIso, operationId) => {
      vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(operationId);
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(
        <NavigationGuardProvider>
          <MemoEditor
            open
            memo={{ ...memo, due_at: dueAtIso, version: 9 }}
            latestVersion={9}
            assignees={[]}
            canAssignAny
            onOpenChange={vi.fn()}
            onSave={onSave}
          />
        </NavigationGuardProvider>,
      );

      expect(screen.getByLabelText("到期时间")).toHaveValue("2026-10-25T02:30");
      expect(screen.getByLabelText("到期时间")).toHaveAttribute("aria-invalid", "false");
      await userEvent.type(screen.getByLabelText("正文"), " overlap-safe");
      await userEvent.click(screen.getByRole("button", { name: "保存修改" }));

      await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
      expect(onSave).toHaveBeenCalledWith({
        operationId,
        id: memo.id,
        expectedVersion: 9,
        title: "交班",
        content: "检查库存 overlap-safe",
        dueAt: dueAtIso,
        assigneeMembershipId: null,
      });
    },
  );

  it("rejects an overlap wall value after the due field was touched, even when restored, but permits clearing", async () => {
    const operationId = "40000000-0000-4000-8000-000000000005";
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(operationId);
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <NavigationGuardProvider>
        <MemoEditor
          open
          memo={{ ...memo, due_at: "2026-10-25T00:30:00.000Z", version: 11 }}
          latestVersion={11}
          assignees={[]}
          canAssignAny
          onOpenChange={vi.fn()}
          onSave={onSave}
        />
      </NavigationGuardProvider>,
    );

    const dueAt = screen.getByLabelText("到期时间");
    fireEvent.change(dueAt, { target: { value: "2026-10-25T03:30" } });
    fireEvent.change(dueAt, { target: { value: "2026-10-25T02:30" } });
    screen.getByLabelText("标题").focus();
    const form = screen.getByRole("dialog").querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(onSave).not.toHaveBeenCalled();
    expect(dueAt).toHaveValue("2026-10-25T02:30");
    expect(dueAt).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("出现两次");
    expect(dueAt).toHaveFocus();

    fireEvent.change(dueAt, { target: { value: "" } });
    expect(dueAt).toHaveAttribute("aria-invalid", "false");
    await userEvent.click(screen.getByRole("button", { name: "保存修改" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith({
      operationId,
      id: memo.id,
      expectedVersion: 11,
      title: "交班",
      content: "检查库存",
      dueAt: null,
      assigneeMembershipId: null,
    });
  });

  it.each([
    ["2026-03-29T02:30", "不存在"],
    ["2026-10-25T02:30", "出现两次"],
  ])("rejects the Rome DST wall time %s, retains it, and focuses the field", (value, message) => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <NavigationGuardProvider>
        <MemoEditor
          open
          memo={memo}
          latestVersion={1}
          assignees={[]}
          canAssignAny
          onOpenChange={vi.fn()}
          onSave={onSave}
        />
      </NavigationGuardProvider>,
    );

    const dueAt = screen.getByLabelText("到期时间");
    fireEvent.change(dueAt, { target: { value } });
    screen.getByLabelText("标题").focus();
    const form = screen.getByRole("dialog").querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(onSave).not.toHaveBeenCalled();
    expect(dueAt).toHaveValue(value);
    expect(dueAt).toHaveAttribute("aria-invalid", "true");
    expect(dueAt).toHaveAttribute("aria-describedby", "memo-due-error");
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(dueAt).toHaveFocus();
  });

  it("fails closed for an invalid server timestamp without throwing", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <NavigationGuardProvider>
        <MemoEditor
          open
          memo={{ ...memo, due_at: "invalid-server-timestamp" }}
          latestVersion={1}
          assignees={[]}
          canAssignAny
          onOpenChange={vi.fn()}
          onSave={onSave}
        />
      </NavigationGuardProvider>,
    );

    const dueAt = screen.getByLabelText("到期时间");
    expect(dueAt).toHaveValue("");
    expect(dueAt).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("原到期时间无效，请重新选择。")).toBeVisible();
    expect(screen.getByRole("button", { name: "保存修改" })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each(["button", "enter", "ctrl-enter"] as const)(
    "uses one synchronous submit lock for the %s entry point",
    (entryPoint) => {
      const onSave = vi.fn(() => new Promise<void>(() => undefined));
      render(
        <NavigationGuardProvider>
          <MemoEditor
            open
            memo={null}
            assignees={[]}
            canAssignAny
            onOpenChange={vi.fn()}
            onSave={onSave}
          />
        </NavigationGuardProvider>,
      );

      fireEvent.change(screen.getByLabelText("标题"), { target: { value: "同刻提交" } });
      if (entryPoint === "button") {
        const submit = screen.getByRole("button", { name: "添加待办" });
        fireEvent.click(submit);
        fireEvent.click(submit);
      } else if (entryPoint === "enter") {
        const title = screen.getByLabelText("标题");
        fireEvent.keyDown(title, { key: "Enter" });
        fireEvent.keyDown(title, { key: "Enter" });
      } else {
        fireEvent.click(screen.getByRole("button", { name: "添加详情" }));
        const content = screen.getByLabelText("正文（可选）");
        fireEvent.keyDown(content, { key: "Enter", ctrlKey: true });
        fireEvent.keyDown(content, { key: "Enter", ctrlKey: true });
      }

      expect(onSave).toHaveBeenCalledOnce();
    },
  );

  it("creates the default todo from the title with Enter", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <NavigationGuardProvider>
        <MemoEditor
          open
          memo={null}
          assignees={[]}
          canAssignAny
          onOpenChange={vi.fn()}
          onSave={onSave}
        />
      </NavigationGuardProvider>,
    );

    const title = screen.getByLabelText("标题");
    await userEvent.type(title, "给客户回电话{Enter}");

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "todo",
          title: "给客户回电话",
          content: "",
          dueAt: null,
          assigneeMembershipId: null,
        }),
      ),
    );
  });

  it("supports a note with optional details and Ctrl+Enter", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <NavigationGuardProvider>
        <MemoEditor
          open
          memo={null}
          assignees={[]}
          canAssignAny
          onOpenChange={vi.fn()}
          onSave={onSave}
        />
      </NavigationGuardProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "记录" }));
    await userEvent.type(screen.getByLabelText("标题"), "供应商备注");
    await userEvent.click(screen.getByRole("button", { name: "添加详情" }));
    const content = screen.getByLabelText("正文（可选）");
    await userEvent.type(content, "下周补货");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "note",
          title: "供应商备注",
          content: "下周补货",
          dueAt: null,
          assigneeMembershipId: null,
        }),
      ),
    );
    expect(screen.getByRole("button", { name: "保存记录" })).toBeVisible();
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
