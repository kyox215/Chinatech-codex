import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhoneKeypadInput } from "./phone-keypad-input";

function setViewport(width: number, touchDevice = false) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    touchDevice ? "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)" : "Mozilla/5.0 (Windows NT 10.0)",
  );
}

afterEach(() => {
  cleanup();
  setViewport(1024);
  vi.restoreAllMocks();
});

function PhoneKeypadHarness() {
  const [value, setValue] = useState("");

  return (
    <div>
      <PhoneKeypadInput ariaLabel="客户电话号码" value={value} onChange={setValue} />
      <span data-testid="value">{value}</span>
    </div>
  );
}

describe("PhoneKeypadInput", () => {
  it("keeps the app keypad on a touch tablet", async () => {
    setViewport(768, true);
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

  it("closes on Enter without the button default click reopening the keypad", async () => {
    setViewport(390, true);
    const user = userEvent.setup();
    render(<PhoneKeypadHarness />);
    const trigger = screen.getByRole("button", { name: "客户电话号码" });
    await user.click(trigger);
    await user.keyboard("2025550100{Enter}");
    expect(document.querySelector("[data-phone-keypad]")).toBeNull();
    expect(screen.getByTestId("value")).toHaveTextContent("2025550100");
    expect(trigger).toHaveFocus();
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
    expect(nativeInput).not.toHaveAttribute("role", "combobox");

    await user.click(nativeInput);
    await user.type(nativeInput, "+39333a4");

    expect(document.activeElement).toBe(nativeInput);
    expect(nativeInput).toHaveValue("+393334");
    expect(screen.getByTestId("value")).toHaveTextContent("+393334");
    expect(document.querySelector('[data-virtual-keyboard-dock="true"]')).toBeNull();
  });

  it("keeps a wide iPad on the app keypad", async () => {
    setViewport(1280, true);
    const user = userEvent.setup();
    const { container } = render(<PhoneKeypadHarness />);

    expect(container.querySelector('[data-phone-native-input="true"]')).toBeNull();
    await user.click(screen.getByRole("button", { name: "客户电话号码" }));
    expect(await screen.findByRole("group", { name: "客户电话号码 虚拟数字键盘" })).toBeVisible();
  });
});

it("preserves legacy native formatting and enforces maxLength in the virtual editor", async () => {
  const user = userEvent.setup();
  const change = vi.fn();
  setViewport(1280);
  const { unmount } = render(
    <PhoneKeypadInput
      id="supplier-phone"
      ariaLabel="Phone"
      value="+39 12"
      preserveFormatting
      maxLength={6}
      autoComplete="tel"
      onChange={change}
    />,
  );
  const native = screen.getByRole("textbox", { name: "Phone" });
  expect(native).toHaveValue("+39 12");
  expect(native).toHaveAttribute("maxlength", "6");
  expect(native).toHaveAttribute("autocomplete", "tel");
  setViewport(390, true);
  unmount();
  render(
    <PhoneKeypadInput
      id="supplier-phone"
      ariaLabel="Phone"
      value="+39123"
      preserveFormatting
      maxLength={6}
      onChange={change}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Phone" }));
  await user.click(screen.getByRole("button", { name: "4" }));
  expect(change).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "删除最后一位电话号码" }));
  expect(change).toHaveBeenLastCalledWith("+3912");
});
