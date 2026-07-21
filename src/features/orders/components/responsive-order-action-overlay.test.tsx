import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResponsiveOrderActionOverlay } from "./responsive-order-action-overlay";

const listeners = new Map<string, Set<EventListener>>();

beforeEach(() => {
  listeners.clear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: "(min-width: 1024px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: {
      height: 844,
      offsetTop: 0,
      addEventListener: (name: string, listener: EventListener) => {
        const entries = listeners.get(name) ?? new Set<EventListener>();
        entries.add(listener);
        listeners.set(name, entries);
      },
      removeEventListener: (name: string, listener: EventListener) => {
        listeners.get(name)?.delete(listener);
      },
    },
  });
});

afterEach(cleanup);

function Harness({ pending = false }: { pending?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <output data-testid="open-state">{String(open)}</output>
      <ResponsiveOrderActionOverlay
        open={open}
        pending={pending}
        onOpenChange={setOpen}
        title="测试操作"
        description="测试说明"
        footer={<button type="button">确认</button>}
        dataAttribute="data-test-order-overlay"
      >
        <label>
          其他说明
          <textarea />
        </label>
      </ResponsiveOrderActionOverlay>
    </>
  );
}

describe("ResponsiveOrderActionOverlay", () => {
  it("moves the mobile sheet above the visual keyboard and keeps the footer reachable", () => {
    const { container } = render(<Harness />);
    const viewport = window.visualViewport as VisualViewport;
    Object.defineProperty(viewport, "height", { configurable: true, value: 500 });

    act(() => {
      listeners.get("resize")?.forEach((listener) => listener(new Event("resize")));
    });

    const overlay = document.querySelector('[data-test-order-overlay="true"]');
    expect(overlay).toHaveStyle({ bottom: "344px", maxHeight: "492px" });
    expect(screen.getByRole("button", { name: "确认" })).toBeVisible();
    expect(container).not.toBeNull();
  });

  it("cannot close through the overlay close control while submitting", async () => {
    const user = userEvent.setup();
    render(<Harness pending />);

    await user.click(screen.getByRole("button", { name: "关闭" }));

    expect(screen.getByTestId("open-state")).toHaveTextContent("true");
  });

  it("closes normally when not submitting", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "关闭" }));

    expect(screen.getByTestId("open-state")).toHaveTextContent("false");
  });
});
