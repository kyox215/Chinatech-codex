import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { fallbackOrderWorkflowStatuses } from "@/features/orders/model/order-workflow";
import type { OrderWorkflow } from "@/lib/repairdesk/types";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

import { OrderWorkflowSettingsSection } from "./order-workflow-settings-section";

vi.mock("@/features/settings/components/unsaved-settings-guard", () => ({
  UnsavedSettingsGuard: () => null,
}));

const storeId = "store-workflow";

function workflowFixture(): OrderWorkflow {
  return {
    statuses: fallbackOrderWorkflowStatuses.slice(0, 4).map((status) => ({
      ...status,
      store_id: storeId,
    })),
    transitions: [
      {
        id: "transition-new-diagnosing",
        store_id: storeId,
        from_status_code: "new",
        to_status_code: "diagnosing",
        enabled: true,
        is_primary: true,
        sort_order: 10,
        created_at: "",
        updated_at: "",
      },
    ],
  };
}

describe("OrderWorkflowSettingsSection", () => {
  it("renders explicit loading, error and empty states without fallback IDs", () => {
    const { rerender } = render(
      <OrderWorkflowSettingsSection
        storeId={storeId}
        isLoading
        isError={false}
        canEdit
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("正在读取工单状态流")).toHaveAttribute("aria-busy", "true");

    rerender(
      <OrderWorkflowSettingsSection
        storeId={storeId}
        isLoading={false}
        isError
        canEdit
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("状态流读取失败");
    expect(screen.getByRole("alert")).not.toHaveTextContent("migration");

    rerender(
      <OrderWorkflowSettingsSection
        storeId={storeId}
        workflow={{ statuses: [], transitions: [] }}
        isLoading={false}
        isError={false}
        canEdit
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText("当前店铺没有状态流记录")).toBeInTheDocument();
    expect(screen.queryByText("fallback-new")).not.toBeInTheDocument();
  });

  it("uses semantic read-only content instead of disabled editors", () => {
    render(
      <OrderWorkflowSettingsSection
        storeId={storeId}
        workflow={workflowFixture()}
        isLoading={false}
        isError={false}
        canEdit={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText(/当前为只读访问/)).toBeInTheDocument();
    expect(screen.getByText("推荐 / 自动流转规则")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /编辑状态/ })).not.toBeInTheDocument();
  });

  it("keeps status edits local, reports dirty state and reviews the diff", async () => {
    const user = userEvent.setup();
    const workflow = workflowFixture();
    const originalLabel = workflow.statuses[0].label;
    const onDirtyChange = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(
      <OrderWorkflowSettingsSection
        storeId={storeId}
        workflow={workflow}
        isLoading={false}
        isError={false}
        canEdit
        onRetry={vi.fn()}
        onDirtyChange={onDirtyChange}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: /编辑状态/ })[0]);
    const sheet = screen.getByRole("dialog", { name: `编辑「${originalLabel}」` });
    const labelInput = within(sheet).getByLabelText("状态名称");
    await user.clear(labelInput);
    await user.type(labelInput, "待门店接收");
    await user.click(within(sheet).getByRole("button", { name: "完成编辑" }));

    expect(screen.getAllByText("待门店接收").length).toBeGreaterThan(0);
    expect(workflow.statuses[0].label).toBe(originalLabel);
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    expect(fetchSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /检查变更/ }));
    const review = screen.getByRole("dialog", { name: "检查状态流变更" });
    await waitFor(() =>
      expect(within(review).getByRole("heading", { name: "检查状态流变更" })).toHaveFocus(),
    );
    expect(review).toHaveTextContent(`修改状态名称「${originalLabel}」→「待门店接收」`);
    expect(within(review).getByRole("button", { name: /应用状态流/ })).toBeDisabled();

    fetchSpy.mockRestore();
  });

  it("blocks a duplicate custom status code before it enters the draft", async () => {
    const user = userEvent.setup();
    render(
      <OrderWorkflowSettingsSection
        storeId={storeId}
        workflow={workflowFixture()}
        isLoading={false}
        isError={false}
        canEdit
        onRetry={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "新增状态草稿" }));
    const sheet = screen.getByRole("dialog", { name: "新增状态草稿" });
    await user.type(within(sheet).getByLabelText("状态代码"), "new");
    await user.type(within(sheet).getByLabelText("状态名称"), "重复新建状态");

    expect(within(sheet).getByRole("alert")).toHaveTextContent("状态代码已存在");
    expect(within(sheet).getByRole("button", { name: "加入本地草稿" })).toBeDisabled();
  });

  it("preserves a dirty local draft and exposes a conflict when server data changes", async () => {
    const user = userEvent.setup();
    const workflow = workflowFixture();
    const view = render(
      <OrderWorkflowSettingsSection
        storeId={storeId}
        workflow={workflow}
        isLoading={false}
        isError={false}
        canEdit
        onRetry={vi.fn()}
      />,
    );
    await user.click(screen.getAllByRole("button", { name: /编辑状态/ })[0]);
    const sheet = screen.getByRole("dialog", { name: `编辑「${workflow.statuses[0].label}」` });
    await user.clear(within(sheet).getByLabelText("状态名称"));
    await user.type(within(sheet).getByLabelText("状态名称"), "本地草稿名称");
    await user.click(within(sheet).getByRole("button", { name: "完成编辑" }));

    const incoming = workflowFixture();
    incoming.statuses[0] = {
      ...incoming.statuses[0],
      label: "服务器新名称",
      updated_at: "2026-07-13T13:00:00.000Z",
    };
    view.rerender(
      <OrderWorkflowSettingsSection
        storeId={storeId}
        workflow={incoming}
        isLoading={false}
        isError={false}
        canEdit
        onRetry={vi.fn()}
      />,
    );

    expect(await screen.findByText("服务器版本已变化，本地草稿未被覆盖")).toBeInTheDocument();
    expect(screen.getAllByText("本地草稿名称").length).toBeGreaterThan(0);
  });

  it.each([
    ["zh-CN", "工单状态流", "当前为只读访问。页面仅展示语义值，不提供不可用的表单控件。"],
    [
      "it-IT",
      "Flusso stati ordine",
      "Accesso in sola lettura. La pagina mostra i valori senza controlli di modifica non disponibili.",
    ],
    [
      "en",
      "Order status workflow",
      "This is read-only access. The page shows values without unavailable editing controls.",
    ],
  ] as const)("localizes the production read-only state in %s", (locale, heading, notice) => {
    render(
      <LocaleProvider initialLocale={locale}>
        <OrderWorkflowSettingsSection
          storeId={storeId}
          workflow={workflowFixture()}
          isLoading={false}
          isError={false}
          canEdit={false}
          onRetry={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(screen.getByText(heading)).toBeVisible();
    expect(screen.getByText(notice)).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("preserves a focused canonical local draft and dynamic labels across a locale switch with zero IO", async () => {
    const user = userEvent.setup();
    const workflow = workflowFixture();
    workflow.statuses[0] = {
      ...workflow.statuses[0],
      label: "DYNAMIC 原始 α",
      short_label: "Dyn α",
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    window.history.replaceState({}, "", "/settings?section=workflow");
    render(
      <LocaleProvider initialLocale="en">
        <WorkflowLocaleHarness workflow={workflow} />
      </LocaleProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Edit status DYNAMIC 原始 α" }));
    const input = screen.getByRole("textbox", { name: "Status name" });
    await user.clear(input);
    await user.type(input, "DYNAMIC 新值 β");
    input.focus();
    fireLocaleSwitch("it-IT");

    expect(screen.getByRole("textbox", { name: "Nome stato" })).toHaveValue("DYNAMIC 新值 β");
    expect(screen.getByRole("textbox", { name: "Nome stato" })).toHaveFocus();
    expect(window.location.pathname + window.location.search).toBe("/settings?section=workflow");
    expect(fetchSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Completa modifica" }));
    expect(document.querySelector('[data-workflow-status-code="new"]')).toHaveTextContent(
      "DYNAMIC 新值 β",
    );
    await user.click(screen.getByRole("button", { name: "Rivedi modifiche" }));
    const review = screen.getByRole("dialog", { name: "Rivedi modifiche al flusso" });
    expect(review).toHaveTextContent("Rinominato stato “DYNAMIC 原始 α” → “DYNAMIC 新值 β”");
    expect(review).not.toHaveTextContent("修改状态名称");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

function WorkflowLocaleHarness({ workflow }: { workflow: OrderWorkflow }) {
  const { setLocale } = useLocale();
  return (
    <>
      <button type="button" data-testid="switch-zh-CN" onClick={() => setLocale("zh-CN")}>
        switch zh
      </button>
      <button type="button" data-testid="switch-it-IT" onClick={() => setLocale("it-IT")}>
        switch it
      </button>
      <button type="button" data-testid="switch-en" onClick={() => setLocale("en")}>
        switch en
      </button>
      <OrderWorkflowSettingsSection
        storeId={storeId}
        workflow={workflow}
        isLoading={false}
        isError={false}
        canEdit
        onRetry={vi.fn()}
      />
    </>
  );
}

function fireLocaleSwitch(locale: AppLocale) {
  fireEvent.click(screen.getByTestId(`switch-${locale}`));
}
