import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  it("shows only connection steps while preserving the distinct point identities and encoded order", async () => {
    render(<DeviceUnlockHarness />);
    fireEvent.click(screen.getByRole("button", { name: "图案" }));
    const pattern = [1, 2, 3, 5, 7, 8, 9];
    for (const point of pattern) {
      fireEvent.keyDown(document.querySelector(`[data-device-unlock-pattern-point="${point}"]`)!, {
        key: "Enter",
      });
    }
    expect(screen.getByTestId("unlock-value")).toHaveTextContent(
      JSON.stringify({ method: "pattern", pattern }),
    );
    expect(
      Array.from(
        document.querySelectorAll('[data-device-unlock-pattern-point][aria-pressed="true"]'),
      ).map((point) => point.textContent),
    ).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(screen.getByRole("button", { name: "图案点 4" })).toBeEmptyDOMElement();
    expect(screen.getByRole("button", { name: "图案点 6" })).toBeEmptyDOMElement();
    fireEvent.keyDown(screen.getByRole("button", { name: /图案点 5，第 4 步/ }), { key: "Enter" });
    expect(screen.getByTestId("unlock-value")).toHaveTextContent(
      JSON.stringify({ method: "pattern", pattern }),
    );
    expect(document.querySelector("[data-device-unlock-pattern-grid] svg")).toHaveAttribute(
      "viewBox",
      "0 0 156 156",
    );
  });
  it("records a continuous swipe and includes points crossed by a fast gesture", () => {
    render(<DeviceUnlockHarness />);
    fireEvent.click(screen.getByRole("button", { name: "图案" }));
    const grid = document.querySelector<HTMLElement>("[data-device-unlock-pattern-grid]");
    if (!grid) throw new Error("Pattern grid not rendered");
    vi.spyOn(grid, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 156,
      bottom: 156,
      width: 156,
      height: 156,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(grid, { pointerId: 7, clientX: 22, clientY: 22 });
    fireEvent.pointerMove(grid, { pointerId: 7, clientX: 134, clientY: 22 });
    fireEvent.pointerUp(grid, { pointerId: 7, clientX: 134, clientY: 22 });

    expect(screen.getByTestId("unlock-value")).toHaveTextContent(
      JSON.stringify({ method: "pattern", pattern: [1, 2, 3] }),
    );
  });
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
