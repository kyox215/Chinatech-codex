import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { MoneyKeypadInput } from "./money-keypad-input";

afterEach(() => cleanup());

function MoneyKeypadHarness() {
  const [value, setValue] = useState("");

  return (
    <div>
      <MoneyKeypadInput ariaLabel="报价金额" value={value} onChange={setValue} />
      <span data-testid="value">{value}</span>
    </div>
  );
}

describe("MoneyKeypadInput", () => {
  it("edits money through the app keypad without rendering a native input", async () => {
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
});
