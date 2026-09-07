import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OrderWorkspaceQuoteTextField } from "./order-workspace-primitives";

describe("OrderWorkspaceQuoteTextField", () => {
  it("defers observed width resizing and cancels pending writes on unmount", () => {
    let notify: ResizeObserverCallback = () => undefined;
    const frames: FrameRequestCallback[] = [];
    const disconnect = vi.fn();
    const cancelFrame = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          notify = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    try {
      const { unmount } = render(
        <OrderWorkspaceQuoteTextField
          value="Long quote"
          onValueChange={vi.fn()}
          ariaLabel="Quote name"
        />,
      );
      const field = screen.getByRole("textbox");
      let width = 120;
      vi.spyOn(field, "getBoundingClientRect").mockImplementation(() => ({ width }) as DOMRect);
      Object.defineProperty(field, "scrollHeight", { configurable: true, value: 77 });
      const initialHeight = field.style.height;
      notify([], {} as ResizeObserver);
      expect(field.style.height).toBe(initialHeight);
      expect(frames).toHaveLength(1);
      frames[0](0);
      expect(parseFloat(field.style.height)).toBeGreaterThanOrEqual(77);
      width = 0;
      notify([], {} as ResizeObserver);
      expect(frames).toHaveLength(1);
      width = 110;
      notify([], {} as ResizeObserver);
      expect(frames).toHaveLength(2);
      unmount();
      expect(disconnect).toHaveBeenCalledOnce();
      expect(cancelFrame).toHaveBeenCalledWith(2);
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it("wraps presentation while retaining single-line values and IME Enter behavior", () => {
    const submit = vi.fn();
    function Harness() {
      const [value, setValue] = useState("Ricambio originale · 屏幕");
      return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <OrderWorkspaceQuoteTextField
            value={value}
            onValueChange={setValue}
            ariaLabel="Quote name"
          />
        </form>
      );
    }
    render(<Harness />);
    const field = screen.getByRole("textbox", { name: "Quote name" });
    expect(field).not.toHaveFocus();
    fireEvent.change(field, { target: { value: "Ricambio\noriginale\r\n屏幕" } });
    expect(field).toHaveValue("Ricambiooriginale屏幕");
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
    expect(submit).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(field).toHaveValue("Ricambiooriginale屏幕");
  });

  it("preserves disabled and invalid editing state", () => {
    render(
      <OrderWorkspaceQuoteTextField
        value="Intervento personalizzato"
        onValueChange={vi.fn()}
        ariaLabel="Quote name"
        disabled
        invalid
      />,
    );
    const field = screen.getByRole("textbox", { name: "Quote name" });
    expect(field).toBeDisabled();
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("does not activate a later submit button when the default is disabled", () => {
    const submit = vi.fn();
    const click = vi.fn();
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <OrderWorkspaceQuoteTextField
          value="Display"
          onValueChange={vi.fn()}
          ariaLabel="Quote name"
        />
        <button type="submit" disabled>
          Default
        </button>
        <button type="submit" onClick={click}>
          Later
        </button>
      </form>,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(submit).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it("clicks the default submit button so its cancellation handler remains effective", () => {
    const submit = vi.fn();
    const click = vi.fn();
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <OrderWorkspaceQuoteTextField
          value="Display"
          onValueChange={vi.fn()}
          ariaLabel="Quote name"
        />
        <button
          type="submit"
          onClick={(event) => {
            event.preventDefault();
            click();
          }}
        >
          Default
        </button>
      </form>,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(click).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });

  it.each(["text", "number", "hidden"])(
    "retains implicit submission blocking for another %s input",
    (type) => {
      const submit = vi.fn();
      render(
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <OrderWorkspaceQuoteTextField
            value="Display"
            onValueChange={vi.fn()}
            ariaLabel="Quote name"
          />
          <input type={type} aria-label="Other field" />
        </form>,
      );
      fireEvent.keyDown(screen.getByRole("textbox", { name: "Quote name" }), { key: "Enter" });
      expect(submit).toHaveBeenCalledTimes(type === "hidden" ? 1 : 0);
    },
  );

  it("keeps Enter inert outside a form", () => {
    const change = vi.fn();
    render(
      <OrderWorkspaceQuoteTextField
        value="Display"
        onValueChange={change}
        ariaLabel="Quote name"
      />,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(change).not.toHaveBeenCalled();
  });
});
