import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import {
  fallbackOrderWorkflowStatuses,
  getWorkflowTransitionActions,
} from "../model/order-workflow";
import { getDefaultOrderTransitionReason } from "../model/order-transition-reasons";
import {
  OrderStatusTransitionPicker,
  type OrderStatusTransitionPickerProps,
} from "./order-status-transition-picker";

const workflow = { statuses: fallbackOrderWorkflowStatuses, transitions: [] };
const defaults = (): OrderStatusTransitionPickerProps => ({
  open: true,
  order: { id: "ord_1", public_no: "R0001", status: "repairing" },
  workflow,
  actions: getWorkflowTransitionActions(workflow, "repairing"),
  pending: false,
  canPublishQuote: true,
  getActionHint: (code) => `Hint: ${code}`,
  getErrorMessage: () => "Please retry",
  onOpenChange: vi.fn(),
  onTransition: vi.fn().mockResolvedValue(undefined),
});
const view = (props: OrderStatusTransitionPickerProps) => (
  <LocaleProvider initialLocale="zh-CN">
    <OrderStatusTransitionPicker {...props} />
  </LocaleProvider>
);
const element = (selector: string) => document.querySelector(selector) as HTMLButtonElement;
const choose = (code: string) => {
  fireEvent.click(element(`[data-status-option="${code}"]`));
};

describe("OrderStatusTransitionPicker", () => {
  it("labels quoted as a dedicated publish action and preserves current status until navigation", async () => {
    const props = defaults();
    render(view(props));
    choose("quoted");
    expect(element("[data-status-confirm]")).toHaveTextContent("前往发布报价");
    expect(element("[data-status-selected-hint]")).toHaveTextContent("校验诊断、金额和报价版本");
    expect(element('[data-status-current="true"]')).toHaveAttribute(
      "data-status-sequence-entry",
      "repairing",
    );
    expect(props.onTransition).not.toHaveBeenCalled();
    fireEvent.click(element("[data-status-confirm]"));
    await waitFor(() => expect(props.onTransition).toHaveBeenCalledWith("quoted", undefined));
  });

  it("shows pending approval reasons and opens the existing decision entry without submitting a status", () => {
    const props = defaults();
    props.order = {
      ...props.order,
      status: "waiting_approval",
      approval_status: "pending",
      approval_flow_status: "waiting_customer",
    };
    props.actions = getWorkflowTransitionActions(workflow, "waiting_approval");
    props.onApprovalDecision = vi.fn();
    render(view(props));
    expect(element('[data-status-sequence-entry="repairing"]')).toBeDisabled();
    expect(element('[data-status-sequence-entry="repairing"]')).toHaveTextContent(
      "记录客户同意或拒绝",
    );
    expect(element('[data-status-sequence-entry="quoted"]')).toBeDisabled();
    expect(element('[data-status-current="true"]')).toHaveAttribute(
      "data-status-sequence-entry",
      "waiting_approval",
    );
    fireEvent.click(screen.getByRole("button", { name: "审批处理" }));
    expect(props.onApprovalDecision).toHaveBeenCalledOnce();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onTransition).not.toHaveBeenCalled();
  });

  it("keeps quote permission denial visible and blocks its confirmation", () => {
    const props = { ...defaults(), canPublishQuote: false };
    render(view(props));
    const quote = element('[data-status-sequence-entry="quoted"]');
    expect(quote).toBeDisabled();
    expect(quote).toHaveTextContent("当前权限不允许此操作");
    fireEvent.click(quote);
    expect(element("[data-status-confirm]")).toBeDisabled();
    expect(props.onTransition).not.toHaveBeenCalled();
  });
  it("shows all ordered states, one accurate current marker and no explanation before selection", async () => {
    const props = defaults();
    render(view(props));
    expect(document.querySelectorAll("[data-status-current-summary]")).toHaveLength(1);
    expect(document.querySelectorAll("[data-status-option]")).toHaveLength(props.actions.length);
    expect(document.querySelectorAll("[data-status-sequence-entry]")).toHaveLength(
      workflow.statuses.length,
    );
    expect(element('[data-status-current="true"]')).toHaveAttribute(
      "data-status-sequence-entry",
      "repairing",
    );
    expect(element('[data-status-current="true"]')).toBeDisabled();
    expect(element("[data-status-confirm]")).toBeDisabled();
    expect(element("[data-status-selected]")).toBeNull();
    choose("repaired");
    expect(props.onTransition).not.toHaveBeenCalled();
    expect(element('[data-status-option="repaired"]')).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(element("[data-status-confirm]"));
    await waitFor(() =>
      expect(props.onTransition).toHaveBeenCalledExactlyOnceWith("repaired", undefined),
    );
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("preserves canonical default reasons, validates edits and only submits after confirmation", async () => {
    const props = defaults();
    render(view(props));
    choose("cancelled");
    expect(screen.getByRole("textbox")).toHaveValue(getDefaultOrderTransitionReason("cancelled"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    expect(element("[data-status-confirm]")).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  customer note  " } });
    fireEvent.click(element("[data-status-confirm]"));
    await waitFor(() =>
      expect(props.onTransition).toHaveBeenCalledExactlyOnceWith("cancelled", "customer note"),
    );
  });

  it("retains selection and reason on failure, retranslates feedback and retries the same draft", async () => {
    const props = defaults();
    const failure = new Error("synthetic");
    vi.mocked(props.onTransition).mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined);
    const result = render(view(props));
    choose("cancelled");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Keep this reason" } });
    fireEvent.click(element("[data-status-confirm]"));
    await screen.findByRole("alert");
    expect(props.onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("Keep this reason");
    result.rerender(
      view({
        ...props,
        getErrorMessage: (error) => (error === failure ? "Riprova" : "Unexpected"),
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Riprova");
    expect(element('[data-status-option="cancelled"]')).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(element("[data-status-confirm]"));
    await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false));
    expect(props.onTransition).toHaveBeenNthCalledWith(2, "cancelled", "Keep this reason");
  });

  it("locks all controls during submission and does not duplicate confirmation", async () => {
    let resolve!: () => void;
    const props = defaults();
    vi.mocked(props.onTransition).mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    render(view(props));
    choose("repaired");
    fireEvent.click(element("[data-status-confirm]"));
    fireEvent.click(element("[data-status-confirm]"));
    expect(props.onTransition).toHaveBeenCalledTimes(1);
    expect(element("[data-status-cancel]")).toBeDisabled();
    expect(element('[data-status-layout-option="list"]')).toBeDisabled();
    expect(element('[data-status-layout-option="grid"]')).toBeDisabled();
    for (const button of document.querySelectorAll("[data-status-option]"))
      expect(button).toBeDisabled();
    expect(props.onOpenChange).not.toHaveBeenCalled();
    await act(async () => resolve());
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clears drafts when the open picker changes order or is reopened", () => {
    const props = defaults();
    const result = render(view(props));
    choose("cancelled");
    result.rerender(view({ ...props, order: { ...props.order, id: "ord_2" } }));
    expect(element("[data-status-selected]")).toBeNull();
    expect(element("[data-status-confirm]")).toBeDisabled();
    choose("repaired");
    result.rerender(view({ ...props, open: false }));
    result.rerender(view(props));
    expect(element("[data-status-selected]")).toBeNull();
  });

  it("does not invent actions for empty or capability-filtered input", () => {
    const props = defaults();
    props.actions = [];
    const result = render(view(props));
    expect(element("[data-status-empty]")).not.toBeNull();
    expect(element("[data-status-confirm]")).toBeDisabled();
    props.actions = defaults().actions.filter(({ to }) => to === "repaired");
    result.rerender(view(props));
    expect(document.querySelectorAll("[data-status-option]")).toHaveLength(1);
    expect(element("[data-status-more]")).toBeNull();
  });

  it("switches two layouts without hiding states, changing selection or clearing an edited reason", () => {
    const props = defaults();
    render(view(props));
    const codes = () =>
      Array.from(document.querySelectorAll("[data-status-sequence-entry]"), (node) =>
        node.getAttribute("data-status-sequence-entry"),
      );
    const before = codes();
    choose("cancelled");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Keep across layouts" } });
    fireEvent.click(element('[data-status-layout-option="grid"]'));
    expect(element("[data-status-picker]")).toHaveAttribute("data-status-layout", "grid");
    expect(codes()).toEqual(before);
    expect(screen.getByRole("textbox")).toHaveValue("Keep across layouts");
    expect(element('[data-status-option="cancelled"]')).toHaveAttribute("aria-pressed", "true");
    choose("cancelled");
    expect(screen.getByRole("textbox")).toHaveValue("Keep across layouts");
    fireEvent.click(element('[data-status-layout-option="list"]'));
    expect(codes()).toEqual(before);
    expect(props.onTransition).not.toHaveBeenCalled();
  });

  it("keeps a disabled or unknown current state read-only and locatable", () => {
    const props = defaults();
    props.workflow = {
      ...workflow,
      statuses: workflow.statuses.map((status) =>
        status.code === "repairing" ? { ...status, enabled: false } : status,
      ),
    };
    const result = render(view(props));
    expect(element('[data-status-current="true"]')).toHaveTextContent("已停用");
    expect(element('[data-status-current="true"]')).toBeDisabled();
    const current = element('[data-status-current="true"]');
    current.scrollIntoView = vi.fn();
    fireEvent.click(element("[data-status-locate-current]"));
    expect(current.scrollIntoView).toHaveBeenCalledWith({ block: "center" });
    result.rerender(view({ ...props, order: { ...props.order, status: "legacy_unknown" } }));
    expect(element('[data-status-current="true"]')).toHaveTextContent("legacy_unknown");
    expect(element('[data-status-current="true"]')).toHaveTextContent("未配置顺序");
    expect(element('[data-status-current="true"]')).not.toHaveAttribute("data-status-position");
    expect(element('[data-status-current="true"]')).toBeDisabled();
  });

  it("keeps identically named custom codes distinct and requires a reason for a custom cancellation", async () => {
    const props = defaults();
    props.workflow = {
      ...workflow,
      statuses: [
        ...workflow.statuses,
        {
          ...workflow.statuses[0]!,
          code: "cancel_a",
          label: "Custom status",
          is_system: false,
          bucket: "cancelled",
        },
        {
          ...workflow.statuses[0]!,
          code: "cancel_b",
          label: "Custom status",
          is_system: false,
          bucket: "cancelled",
        },
      ],
    };
    props.actions = getWorkflowTransitionActions(props.workflow, "repairing");
    render(view(props));
    choose("cancel_b");
    expect(element('[data-status-option="cancel_a"]')).toHaveTextContent("cancel_a");
    expect(element('[data-status-option="cancel_b"]')).toHaveTextContent("cancel_b");
    expect(screen.getByRole("textbox")).toHaveValue(getDefaultOrderTransitionReason("cancelled"));
    expect(element("[data-status-selected-hint]")).toHaveTextContent("Hint: cancelled");
    fireEvent.click(element("[data-status-confirm]"));
    await waitFor(() =>
      expect(props.onTransition).toHaveBeenCalledExactlyOnceWith(
        "cancel_b",
        getDefaultOrderTransitionReason("cancelled"),
      ),
    );
  });
});
