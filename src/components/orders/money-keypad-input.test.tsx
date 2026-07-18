import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { DesktopVirtualKeyboardPreferenceContext } from "@/components/desktop-virtual-keyboard-preference-context";

import { MoneyKeypadInput } from "./money-keypad-input";

function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
}

afterEach(() => {
  cleanup();
  setViewport(1024);
});

function MoneyKeypadHarness({
  desktopVirtualKeyboardEnabled = false,
}: {
  desktopVirtualKeyboardEnabled?: boolean;
}) {
  const [value, setValue] = useState("");

  return (
    <DesktopVirtualKeyboardPreferenceContext.Provider
      value={{
        desktopVirtualKeyboardEnabled,
        preferenceReady: true,
        setDesktopVirtualKeyboardEnabled: () => undefined,
      }}
    >
      <div>
        <MoneyKeypadInput ariaLabel="报价金额" value={value} onChange={setValue} />
        <span data-testid="value">{value}</span>
      </div>
    </DesktopVirtualKeyboardPreferenceContext.Provider>
  );
}

describe("MoneyKeypadInput", () => {
  it("edits money through the app keypad without rendering a native input", async () => {
    setViewport(768);
    const user = userEvent.setup();
    const { container } = render(<MoneyKeypadHarness />);

    expect(container.querySelector("input")).toBeNull();

    await user.click(screen.getByRole("button", { name: "报价金额" }));
    expect(await screen.findByRole("group", { name: "报价金额 虚拟金额键盘" })).toBeVisible();
    expect(document.querySelector('[data-virtual-keyboard-dock="true"]')).toHaveClass(
      "fixed",
      "justify-center",
    );

    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "." }));
    await user.click(screen.getByRole("button", { name: "5" }));
    expect(screen.getByTestId("value")).toHaveTextContent("12.5");

    await user.click(screen.getByRole("button", { name: "删除最后一位金额" }));
    expect(screen.getByTestId("value")).toHaveTextContent("12.");

    await user.click(screen.getByRole("button", { name: "清空" }));
    expect(screen.getByTestId("value")).toBeEmptyDOMElement();
  });

  it("uses a native decimal input on desktop by default", async () => {
    setViewport(1280);
    const user = userEvent.setup();
    const { container } = render(<MoneyKeypadHarness />);
    const nativeInput = container.querySelector("input") as HTMLInputElement;

    expect(container.querySelector('[data-money-keypad-native-input="true"]')).toBeInTheDocument();
    expect(nativeInput).toHaveAttribute("inputmode", "decimal");
    await user.type(nativeInput, "12.5x");

    expect(nativeInput).toHaveValue("12.5");
    expect(screen.getByTestId("value")).toHaveTextContent("12.5");
    expect(document.querySelector('[data-virtual-keyboard-dock="true"]')).toBeNull();
  });

  it("keeps the app keypad available when enabled by a desktop user", async () => {
    setViewport(1280);
    const user = userEvent.setup();
    render(<MoneyKeypadHarness desktopVirtualKeyboardEnabled />);

    await user.click(screen.getByRole("button", { name: "报价金额" }));
    expect(await screen.findByRole("group", { name: "报价金额 虚拟金额键盘" })).toBeVisible();
  });
});
