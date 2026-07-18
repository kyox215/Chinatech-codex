import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { PhoneKeypadInput } from "./phone-keypad-input";

afterEach(() => cleanup());

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
  it("keeps the app keypad on mobile and tablet breakpoints", async () => {
    const user = userEvent.setup();
    const { container } = render(<PhoneKeypadHarness />);

    const nativeInput = container.querySelector('[data-phone-native-input="true"]');
    const keypadTrigger = container.querySelector('[data-phone-keypad-trigger="true"]');
    expect(nativeInput).toHaveClass("hidden", "lg:flex");
    expect(keypadTrigger).toHaveClass("lg:hidden");

    await user.click(keypadTrigger as HTMLButtonElement);
    expect(await screen.findByRole("group", { name: "客户电话号码 虚拟数字键盘" })).toBeVisible();
    expect(document.querySelector('[data-virtual-keyboard-dock="true"]')).toHaveClass(
      "fixed",
      "justify-center",
      "lg:hidden",
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
    const user = userEvent.setup();
    const { container } = render(<PhoneKeypadHarness />);
    const nativeInput = container.querySelector(
      '[data-phone-native-input="true"]',
    ) as HTMLInputElement;

    expect(nativeInput).toHaveAttribute("type", "tel");
    expect(nativeInput).toHaveAttribute("inputmode", "tel");

    await user.click(nativeInput);
    await user.type(nativeInput, "+39333a4");

    expect(document.activeElement).toBe(nativeInput);
    expect(nativeInput).toHaveValue("+393334");
    expect(screen.getByTestId("value")).toHaveTextContent("+393334");
    expect(document.querySelector('[data-virtual-keyboard-dock="true"]')).toBeNull();
  });
});
