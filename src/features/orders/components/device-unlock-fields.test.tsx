import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DeviceUnlockInput } from "@/lib/repairdesk/types";

import { DeviceUnlockEditor } from "./device-unlock-fields";

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
    setViewport(768, true);
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

  it("uses a native password input for PIN on desktop while retaining leading zeroes", async () => {
    setViewport(1280);
    const user = userEvent.setup();
    const { container } = render(<DeviceUnlockHarness />);

    await user.click(screen.getByRole("button", { name: "PIN" }));
    const input = await screen.findByLabelText("数字 PIN");

    expect(container.querySelector('[data-device-unlock-pin-native-input="true"]')).toBe(input);
    expect(input).toHaveAttribute("type", "password");
    await user.type(input, "001a2");

    expect(input).toHaveValue("0012");
    expect(screen.getByTestId("unlock-value")).toHaveTextContent(
      JSON.stringify({ method: "pin", value: "0012" }),
    );
    expect(document.querySelector('[data-virtual-keyboard-dock="true"]')).toBeNull();
  });
});
