import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

describe("Popover nested modal scrolling", () => {
  it("keeps native inner scroll gestures away from the parent scroll lock and preserves handlers", () => {
    const parentWheel = vi.fn();
    const parentTouch = vi.fn();
    const wheel = vi.fn();
    const touch = vi.fn();
    render(
      <div onWheel={parentWheel} onTouchMove={parentTouch}>
        <Popover open>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent onWheel={wheel} onTouchMove={touch}>
            <button>Inside</button>
          </PopoverContent>
        </Popover>
      </div>,
    );
    const inside = screen.getByRole("button", { name: "Inside" });
    const wheelEvent = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 120 });
    const touchEvent = new Event("touchmove", { bubbles: true, cancelable: true });
    fireEvent(inside, wheelEvent);
    fireEvent(inside, touchEvent);
    expect(wheel).toHaveBeenCalledOnce();
    expect(touch).toHaveBeenCalledOnce();
    expect(parentWheel).not.toHaveBeenCalled();
    expect(parentTouch).not.toHaveBeenCalled();
    expect(wheelEvent.defaultPrevented).toBe(false);
    expect(touchEvent.defaultPrevented).toBe(false);
    expect(screen.getByRole("dialog")).toHaveClass("overscroll-contain");
  });
});
