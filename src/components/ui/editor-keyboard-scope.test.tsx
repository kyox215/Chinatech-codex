import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./sheet";
import { NumericKeypadInput } from "./numeric-keypad-input";
import { PhoneKeypadInput } from "@/components/orders/phone-keypad-input";
import { MoneyKeypadInput } from "@/components/orders/money-keypad-input";
import { mockTouchKeyboardDevice } from "@/shared/lib/virtual-keyboard-device.test-utils";

beforeEach(mockTouchKeyboardDevice);
afterEach(cleanup);

it.each([390, 820, 1180, 1440])(
  "honors explicit container focus at %ipx and keeps keyboard navigation and return focus",
  async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open workspace</button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent initialFocus="container">
              <DialogTitle>Workspace</DialogTitle>
              <DialogDescription>New synthetic order</DialogDescription>
              <input aria-label="First field" />
            </DialogContent>
          </Dialog>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open workspace" });
    await user.click(opener);
    expect(screen.getByRole("dialog")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("textbox", { name: "First field" })).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(opener).toHaveFocus();
  },
);

it("keeps implicit mobileEditor desktop autofocus and explicit caller focus overrides", () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
  const view = render(
    <Dialog open>
      <DialogContent mobileEditor>
        <DialogTitle>Editor</DialogTitle>
        <DialogDescription>Draft</DialogDescription>
        <input aria-label="Desktop field" />
      </DialogContent>
    </Dialog>,
  );
  expect(screen.getByRole("textbox")).toHaveFocus();
  view.unmount();
  render(
    <Dialog open>
      <DialogContent
        initialFocus="container"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.querySelector<HTMLInputElement>("#custom-editor-focus")?.focus();
        }}
      >
        <DialogTitle>Editor</DialogTitle>
        <DialogDescription>Draft</DialogDescription>
        <input id="custom-editor-focus" aria-label="Caller field" />
      </DialogContent>
    </Dialog>,
  );
  expect(screen.getByRole("textbox", { name: "Caller field" })).toHaveFocus();
});

for (const surface of ["dialog", "sheet"] as const) {
  it(`${surface} opens without text focus and isolates keypad Done/Escape from parent save/close`, async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const user = userEvent.setup();
    const save = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(true);
      const [money, setMoney] = useState("12");
      const Root = surface === "dialog" ? Dialog : Sheet;
      const Content = surface === "dialog" ? DialogContent : SheetContent;
      const Title = surface === "dialog" ? DialogTitle : SheetTitle;
      const Description = surface === "dialog" ? DialogDescription : SheetDescription;
      return (
        <Root open={open} onOpenChange={setOpen}>
          <Content mobileEditor>
            <Title>Editor</Title>
            <Description>Draft</Description>
            <input aria-label="Name" />
            <MoneyKeypadInput ariaLabel="Amount" value={money} onChange={setMoney} />
            <button onClick={save}>Save</button>
          </Content>
        </Root>
      );
    }
    render(<Harness />);
    const editor = screen.getByRole("dialog", { name: "Editor" });
    expect(editor).toHaveFocus();
    const trigger = screen.getByRole("button", { name: "Amount" });
    await user.click(trigger);
    expect(
      editor.querySelector("[data-virtual-keyboard-host] [data-virtual-keyboard-dock]"),
    ).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("button", { name: "完成" }));
    expect(trigger).toHaveFocus();
    expect(save).not.toHaveBeenCalled();
    await user.click(trigger);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(editor.querySelector("[data-virtual-keyboard-dock]")).toBeNull());
    expect(editor).toBeVisible();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.click(screen.getByRole("textbox", { name: "Name" }));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editor" })).toBeNull());
  });
}

for (const kind of ["money", "phone", "numeric"] as const) {
  for (const lock of ["disabled", "fieldset", "readonly"] as const) {
    it(`${kind} closes and refuses keypad writes when ${lock} changes while open`, async () => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
      const user = userEvent.setup();
      const change = vi.fn();
      function Harness({ locked }: { locked: boolean }) {
        const props = {
          disabled: locked && lock === "disabled",
          readOnly: locked && lock === "readonly",
        };
        return (
          <Dialog open>
            <DialogContent mobileEditor>
              <DialogTitle>Editor</DialogTitle>
              <DialogDescription>Draft</DialogDescription>
              <fieldset disabled={locked && lock === "fieldset"}>
                {kind === "money" ? (
                  <MoneyKeypadInput ariaLabel="Value" value="12" onChange={change} {...props} />
                ) : kind === "phone" ? (
                  <PhoneKeypadInput ariaLabel="Value" value="12" onChange={change} {...props} />
                ) : (
                  <NumericKeypadInput aria-label="Value" value="12" onChange={change} {...props} />
                )}
              </fieldset>
            </DialogContent>
          </Dialog>
        );
      }
      const { rerender } = render(<Harness locked={false} />);
      await user.click(screen.getByRole("button", { name: "Value" }));
      const key = screen.getByRole("button", { name: "3" });
      rerender(<Harness locked />);
      // A detached or just-disabled portal key must not dispatch another business change.
      fireEvent.click(key);
      await waitFor(() =>
        expect(document.querySelector("[data-virtual-keyboard-dock]")).toBeNull(),
      );
      expect(change).not.toHaveBeenCalled();
      rerender(<Harness locked={false} />);
      await user.click(screen.getByRole("button", { name: "Value" }));
      await user.click(screen.getByRole("button", { name: "完成" }));
      expect(document.querySelector("[data-virtual-keyboard-dock]")).toBeNull();
    });
  }
}

it("blocks a scoped key immediately when its source fieldset becomes disabled before observation", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  const user = userEvent.setup();
  const change = vi.fn();
  render(
    <Dialog open>
      <DialogContent mobileEditor>
        <DialogTitle>Editor</DialogTitle>
        <DialogDescription>Draft</DialogDescription>
        <fieldset>
          <MoneyKeypadInput ariaLabel="Amount" value="12" onChange={change} />
        </fieldset>
      </DialogContent>
    </Dialog>,
  );
  await user.click(screen.getByRole("button", { name: "Amount" }));
  document.querySelector("fieldset")!.disabled = true;
  fireEvent.click(screen.getByRole("button", { name: "3" }));
  expect(change).not.toHaveBeenCalled();
  await waitFor(() => expect(document.querySelector("[data-virtual-keyboard-dock]")).toBeNull());
});
