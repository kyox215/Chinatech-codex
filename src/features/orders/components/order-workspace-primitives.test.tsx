import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockTouchKeyboardDevice } from "@/shared/lib/virtual-keyboard-device.test-utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MoneyKeypadInput } from "@/components/orders/money-keypad-input";
import {
  OrderWorkspaceQuoteDisclosure,
  OrderWorkspaceQuoteTextField,
  OrderWorkspaceMoneyStrip,
  OrderWorkspaceRepairItems,
  OrderWorkspaceFullText,
} from "./order-workspace-primitives";

describe("workbench money summary", () => {
  it("shows only canonical total, deposit and balance without recomputing paid balance", () => {
    const { container } = render(
      <OrderWorkspaceMoneyStrip
        total={120}
        deposit={10}
        balance={35}
        appearance="workbench-summary"
      />,
    );
    expect(container.querySelectorAll("[data-order-workbench-amount]")).toHaveLength(3);
    expect(container.querySelector('[data-order-workbench-amount="total"] dd')).toHaveTextContent(
      "120.00",
    );
    expect(container.querySelector('[data-order-workbench-amount="deposit"] dd')).toHaveTextContent(
      "10.00",
    );
    expect(container.querySelector('[data-order-workbench-amount="balance"] dd')).toHaveTextContent(
      "35.00",
    );
  });
});

describe("repair item edit trigger compatibility", () => {
  it("keeps repeated business items and exposes the complete list without edit permission", () => {
    const names = ["Display", "Display", "Battery", "Labour", "Seal", "Diagnostic"];
    const { container } = render(<OrderWorkspaceRepairItems names={names} />);
    expect(within(container).getAllByText("Display")).toHaveLength(2);
    const expand = within(container).getByRole("button", { name: "查看全部 · 6" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(expand);
    expect(expand).toHaveAttribute("aria-expanded", "true");
    expect(container.querySelectorAll("li")).toHaveLength(6);
    expect(within(container).getByText("Diagnostic")).toBeInTheDocument();
  });

  it("provides full multiline text without nesting its disclosure inside an edit button", () => {
    const text = "Read-only complete description. ".repeat(12);
    const { container } = render(
      <section>
        <p>{text}</p>
        <OrderWorkspaceFullText text={text} />
      </section>,
    );
    const disclosure = container.querySelector("details")!;
    expect(disclosure).not.toHaveAttribute("hidden");
    expect(disclosure.closest("button")).toBeNull();
    fireEvent.click(within(disclosure).getByText("展开完整描述"));
    expect(disclosure).toHaveAttribute("open");
    expect(within(disclosure).getByText(text.trim())).toBeVisible();
  });

  it("passes the real click target exactly once and keeps the legacy element callback", () => {
    const legacy = vi.fn();
    let target: HTMLButtonElement | null = null;
    const click = vi.fn((event) => {
      target = event.currentTarget;
    });
    const view = render(
      <OrderWorkspaceRepairItems names={["Display"]} onEdit={legacy} onEditClick={click} />,
    );
    const button = within(view.container).getByRole("button");
    fireEvent.click(button);
    expect(click).toHaveBeenCalledOnce();
    expect(target).toBe(button);
    expect(legacy).not.toHaveBeenCalled();
    view.rerender(<OrderWorkspaceRepairItems names={["Display"]} onEdit={legacy} />);
    fireEvent.click(button);
    expect(legacy).toHaveBeenCalledExactlyOnceWith(button);
    expect(click).toHaveBeenCalledOnce();
  });
});

describe("OrderWorkspaceQuoteTextField popup", () => {
  it("localizes the trigger while editing and preserving the original value", async () => {
    const change = vi.fn();
    const view = render(
      <OrderWorkspaceQuoteTextField
        value="屏幕"
        displayValue="Display"
        onValueChange={change}
        ariaLabel="Quote name"
      />,
    );
    const trigger = screen.getByRole("button", { name: "Quote name" });
    expect(trigger).toHaveTextContent("Display");
    fireEvent.click(trigger);
    expect(screen.getByRole("textbox")).toHaveValue("屏幕");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(change).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Temporary" } });
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(change).not.toHaveBeenCalled();
    view.rerender(
      <OrderWorkspaceQuoteTextField
        value="屏幕"
        displayValue="Schermo"
        onValueChange={change}
        ariaLabel="Quote name"
      />,
    );
    expect(trigger).toHaveTextContent("Schermo");
    fireEvent.click(trigger);
    expect(screen.getByRole("textbox")).toHaveValue("屏幕");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Custom repair" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(change).toHaveBeenCalledExactlyOnceWith("Custom repair");
  });

  it("dismisses the keypad without pointer-through, then opens the popup on a deliberate tap", async () => {
    mockTouchKeyboardDevice();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const user = userEvent.setup();
    render(
      <Dialog open>
        <DialogContent mobileEditor aria-describedby={undefined}>
          <MoneyKeypadInput value="12" onChange={vi.fn()} ariaLabel="Amount" />
          <OrderWorkspaceQuoteTextField
            value="Original"
            onValueChange={vi.fn()}
            ariaLabel="Quote name"
          />
          <input aria-label="Unmarked input" />
        </DialogContent>
      </Dialog>,
    );
    const amount = screen.getByRole("button", { name: "Amount" });
    const trigger = screen.getByRole("button", { name: "Quote name" });
    fireEvent.click(amount);
    expect(document.querySelector("[data-money-keypad]")).not.toBeNull();
    fireEvent.pointerDown(trigger);
    fireEvent.pointerUp(trigger);
    fireEvent.click(trigger);
    await waitFor(() => expect(document.querySelector("[data-money-keypad]")).toBeNull());
    expect(document.querySelector("[data-order-quote-popup]")).toBeNull();
    fireEvent.click(trigger);
    const popup = document.querySelector("[data-order-quote-popup]");
    expect(popup).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Quote name" })).not.toHaveFocus();
    fireEvent.keyDown(popup!, { key: "Escape" });
    await waitFor(() => expect(document.querySelector("[data-order-quote-popup]")).toBeNull());
    expect(trigger).toHaveFocus();
    fireEvent.click(amount);
    fireEvent.pointerDown(screen.getByRole("textbox", { name: "Unmarked input" }));
    expect(document.querySelector("[data-money-keypad]")).toBeNull();
    for (const key of ["{Enter}", " "]) {
      fireEvent.click(amount);
      trigger.focus();
      await user.keyboard(key);
      const nextPopup = document.querySelector("[data-order-quote-popup]");
      expect(nextPopup).toHaveFocus();
      expect(document.querySelector("[data-money-keypad]")).toBeNull();
      fireEvent.keyDown(nextPopup!, { key: "Escape" });
      await waitFor(() => expect(document.querySelector("[data-order-quote-popup]")).toBeNull());
      expect(trigger).toHaveFocus();
    }
  });

  it("opens only on explicit activation, keeps a local draft, and cancels with focus return", async () => {
    const change = vi.fn();
    render(
      <OrderWorkspaceQuoteTextField
        value="Original name"
        onValueChange={change}
        ariaLabel="Quote name"
      />,
    );
    const trigger = screen.getByRole("button", { name: "Quote name" });
    trigger.focus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    const input = within(dialog).getByRole("textbox");
    expect(dialog).toHaveFocus();
    expect(input).not.toHaveFocus();
    fireEvent.change(input, { target: { value: "Uncommitted name" } });
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveTextContent("Original name");
    fireEvent.click(trigger);
    expect(screen.getByRole("textbox")).toHaveValue("Original name");
    expect(change).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "saves only the parent quote draft, never an outer form (default disabled=%s)",
    async (defaultDisabled) => {
      const submit = vi.fn();
      const click = vi.fn();
      const change = vi.fn();
      function Harness() {
        const [value, setValue] = useState("Original");
        return (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <OrderWorkspaceQuoteTextField
              value={value}
              onValueChange={(next) => {
                change(next);
                setValue(next);
              }}
              ariaLabel="Quote name"
            />
            <button type="submit" disabled={defaultDisabled} onClick={click}>
              Outer save
            </button>
          </form>
        );
      }
      render(<Harness />);
      const trigger = screen.getByRole("button", { name: "Quote name" });
      fireEvent.click(trigger);
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "New\nname\r\n屏幕" } });
      expect(input).toHaveValue("Newname屏幕");
      fireEvent.keyDown(input, { key: "Enter", isComposing: true });
      fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
      expect(change).not.toHaveBeenCalled();
      fireEvent.keyDown(input, { key: "Enter" });
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(change).toHaveBeenCalledExactlyOnceWith("Newname屏幕");
      expect(trigger).toHaveTextContent("Newname屏幕");
      expect(submit).not.toHaveBeenCalled();
      expect(click).not.toHaveBeenCalled();
    },
  );

  it("saves via the explicit popup button outside any form", async () => {
    const change = vi.fn();
    render(
      <OrderWorkspaceQuoteTextField
        value="Original"
        onValueChange={change}
        ariaLabel="Quote name"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Quote name" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Saved name" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(change).toHaveBeenCalledExactlyOnceWith("Saved name");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes an unchanged value without calling the parent name callback", async () => {
    const change = vi.fn();
    render(
      <OrderWorkspaceQuoteTextField
        value="Original catalog name"
        onValueChange={change}
        ariaLabel="Quote name"
      />,
    );
    const trigger = screen.getByRole("button", { name: "Quote name" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(change).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it("shows catalog content without an editable field or save action", () => {
    const change = vi.fn();
    render(
      <OrderWorkspaceQuoteTextField
        value="Original catalog component"
        onValueChange={change}
        ariaLabel="Quote name"
        readOnly
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Quote name" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Original catalog component")).toBeVisible();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "保存" })).not.toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });

  it("closes only the inner popup with Escape and does not reopen on returned focus", async () => {
    const outerClose = vi.fn();
    render(
      <Dialog open onOpenChange={outerClose}>
        <DialogContent aria-describedby={undefined}>
          <OrderWorkspaceQuoteDisclosure>
            Original complete specification
          </OrderWorkspaceQuoteDisclosure>
        </DialogContent>
      </Dialog>,
    );
    const trigger = screen.getByRole("button", { name: "Original complete specification" });
    fireEvent.click(trigger);
    const popup = document.querySelector('[data-order-quote-popup="true"]')!;
    fireEvent.keyDown(popup, { key: "Escape" });
    await waitFor(() =>
      expect(document.querySelector('[data-order-quote-popup="true"]')).toBeNull(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(outerClose).not.toHaveBeenCalled();
  });

  it("preserves disabled and invalid state on the compact trigger", () => {
    render(
      <OrderWorkspaceQuoteTextField
        value="Original"
        onValueChange={vi.fn()}
        ariaLabel="Quote name"
        disabled
        invalid
      />,
    );
    const trigger = screen.getByRole("button", { name: "Quote name" });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
