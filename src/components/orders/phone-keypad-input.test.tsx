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
  it("edits phone numbers through the app keypad without rendering a native input", async () => {
    const user = userEvent.setup();
    const { container } = render(<PhoneKeypadHarness />);

    expect(container.querySelector("input")).toBeNull();

    await user.click(screen.getByRole("button", { name: "客户电话号码" }));
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
});
