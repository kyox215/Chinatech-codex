import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { DesktopVirtualKeyboardPreferenceContext } from "@/components/desktop-virtual-keyboard-preference-context";

import { PhoneKeypadInput } from "./phone-keypad-input";

function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
}

afterEach(() => {
  cleanup();
  setViewport(1024);
});

function PhoneKeypadHarness({
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
        <PhoneKeypadInput ariaLabel="客户电话号码" value={value} onChange={setValue} />
        <span data-testid="value">{value}</span>
      </div>
    </DesktopVirtualKeyboardPreferenceContext.Provider>
  );
}

describe("PhoneKeypadInput", () => {
  it("keeps the app keypad on mobile and tablet breakpoints", async () => {
    setViewport(768);
    const user = userEvent.setup();
    const { container } = render(<PhoneKeypadHarness />);

    const nativeInput = container.querySelector('[data-phone-native-input="true"]');
    const keypadTrigger = container.querySelector('[data-phone-keypad-trigger="true"]');
    expect(nativeInput).toBeNull();
    expect(keypadTrigger).toBeVisible();

    await user.click(keypadTrigger as HTMLButtonElement);
    expect(await screen.findByRole("group", { name: "客户电话号码 虚拟数字键盘" })).toBeVisible();
    expect(document.querySelector('[data-virtual-keyboard-dock="true"]')).toHaveClass(
      "fixed",
      "justify-center",
    );

    await user.click(screen.getByRole("button", { name: "+39" }));
    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("button", { name: "4" }));
    expect(screen.getByTestId("value")).toHaveTextContent("+3934");

    await user.click(screen.getByRole("button", { name: "删除最后一位电话号码" }));
    expect(screen.getByTestId("value")).toHaveTextContent("+393");

    await user.click(screen.getByRole("button", { name: "清空" }));
    expect(screen.getByTestId("value")).toBeEmptyDOMElement();
  });

  it("uses a native tel input for desktop typing without opening the app keypad", async () => {
    setViewport(1280);
    const user = userEvent.setup();
    const { container } = render(<PhoneKeypadHarness />);
    const nativeInput = container.querySelector(
      '[data-phone-native-input="true"]',
    ) as HTMLInputElement;

    expect(nativeInput).toHaveAttribute("type", "tel");
    expect(nativeInput).toHaveAttribute("inputmode", "tel");
    expect(nativeInput).toHaveAttribute("data-phone-native-input", "true");
    expect(nativeInput).toHaveAttribute("data-phone-keypad-native-input", "true");
    expect(nativeInput).toHaveAttribute("role", "combobox");

    await user.click(nativeInput);
    await user.type(nativeInput, "+39333a4");

    expect(document.activeElement).toBe(nativeInput);
    expect(nativeInput).toHaveValue("+393334");
    expect(screen.getByTestId("value")).toHaveTextContent("+393334");
    expect(document.querySelector('[data-virtual-keyboard-dock="true"]')).toBeNull();
  });

  it("allows a desktop user to opt back into the app keypad", async () => {
    setViewport(1280);
    const user = userEvent.setup();
    const { container } = render(<PhoneKeypadHarness desktopVirtualKeyboardEnabled />);

    expect(container.querySelector('[data-phone-native-input="true"]')).toBeNull();
    await user.click(screen.getByRole("button", { name: "客户电话号码" }));
    expect(await screen.findByRole("group", { name: "客户电话号码 虚拟数字键盘" })).toBeVisible();
  });
});
