import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { DeviceUnlockInput } from "@/lib/repairdesk/types";

import { DeviceUnlockEditor } from "./device-unlock-fields";

afterEach(() => cleanup());

function DeviceUnlockHarness() {
  const [value, setValue] = useState<DeviceUnlockInput>({ method: "none" });

  return (
    <div>
      <DeviceUnlockEditor value={value} onChange={setValue} />
      <output data-testid="unlock-value">{JSON.stringify(value)}</output>
    </div>
  );
}

describe("DeviceUnlockEditor", () => {
  it("edits PIN through the fixed bottom virtual keypad", async () => {
    const user = userEvent.setup();
    render(<DeviceUnlockHarness />);

    await user.click(screen.getByRole("button", { name: "PIN" }));
    await user.click(screen.getByRole("button", { name: "数字 PIN" }));

    expect(await screen.findByRole("group", { name: "PIN 数字键盘" })).toBeVisible();
    expect(document.querySelector('[data-virtual-keyboard-dock="true"]')).toHaveClass(
      "fixed",
      "justify-center",
    );

    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "2" }));

    expect(screen.getByTestId("unlock-value")).toHaveTextContent(
      JSON.stringify({ method: "pin", value: "12" }),
    );

    await user.click(screen.getByRole("button", { name: "退格" }));
    expect(screen.getByTestId("unlock-value")).toHaveTextContent(
      JSON.stringify({ method: "pin", value: "1" }),
    );

    await user.click(screen.getByRole("button", { name: "完成" }));
    expect(screen.queryByRole("group", { name: "PIN 数字键盘" })).not.toBeInTheDocument();
  });
});
