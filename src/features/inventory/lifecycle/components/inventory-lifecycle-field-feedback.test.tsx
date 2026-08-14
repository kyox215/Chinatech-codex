import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  InventoryLifecycleField,
  InventoryLifecycleValidationSummary,
} from "./inventory-lifecycle-field-feedback";

describe("InventoryLifecycleField", () => {
  it("associates a visible label, hint, and inline error with an explicit control id", () => {
    render(
      <InventoryLifecycleField
        id="feedback-amount"
        label="本次收款"
        required
        hint="不得超过待收余额"
        error="请输入有效金额"
      >
        <input
          id="feedback-amount"
          required
          aria-invalid="true"
          aria-describedby="feedback-amount-hint feedback-amount-error"
        />
      </InventoryLifecycleField>,
    );

    expect(screen.getByRole("textbox")).toHaveAttribute("id", "feedback-amount");
    expect(screen.getByRole("textbox")).toBeRequired();
    expect(document.querySelector('label[for="feedback-amount"]')).toHaveTextContent("本次收款");
    expect(screen.getByText("不得超过待收余额")).toHaveAttribute("id", "feedback-amount-hint");
    expect(screen.getByText("请输入有效金额")).toHaveAttribute("id", "feedback-amount-error");
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "aria-describedby",
      "feedback-amount-hint feedback-amount-error",
    );
  });
});

describe("InventoryLifecycleValidationSummary", () => {
  it("focuses when errors appear and sends an issue click to the caller", async () => {
    const user = userEvent.setup();
    const onFocusField = vi.fn();
    const { rerender } = render(<InventoryLifecycleValidationSummary />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(
      <InventoryLifecycleValidationSummary
        issues={[{ fieldId: "feedback-amount", label: "本次收款", message: "请输入有效金额" }]}
        onFocusField={onFocusField}
      />,
    );
    const summary = screen.getByRole("alert");
    expect(summary).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /本次收款/ }));
    expect(onFocusField).toHaveBeenCalledWith("feedback-amount");
  });

  it("exposes a server error without requiring raw payload text", () => {
    render(<InventoryLifecycleValidationSummary serverError="保存失败，请刷新后重试。" />);
    expect(screen.getByRole("alert")).toHaveTextContent("保存失败，请刷新后重试。");
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("refocuses when the caller advances the request key for the same issues", () => {
    const issues = [{ fieldId: "feedback-amount", label: "本次收款", message: "请输入有效金额" }];
    const { rerender } = render(
      <InventoryLifecycleValidationSummary
        issues={issues}
        focusRequestKey={1}
        onFocusField={vi.fn()}
      />,
    );
    const summary = screen.getByRole("alert");
    const issueButton = screen.getByRole("button", { name: /本次收款/ });
    expect(summary).toHaveFocus();

    issueButton.focus();
    expect(issueButton).toHaveFocus();
    rerender(
      <InventoryLifecycleValidationSummary
        issues={issues}
        focusRequestKey={2}
        onFocusField={vi.fn()}
      />,
    );
    expect(summary).toHaveFocus();
  });
});
