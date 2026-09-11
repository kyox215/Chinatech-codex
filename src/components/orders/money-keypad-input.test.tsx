import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MoneyKeypadInput } from "./money-keypad-input";

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

function MoneyKeypadHarness() {
  const [value, setValue] = useState("");

  return (
    <div>
      <MoneyKeypadInput ariaLabel="报价金额" value={value} onChange={setValue} />
      <span data-testid="value">{value}</span>
    </div>
  );
}

function NativeNumericHarness({ forced = true }: { forced?: boolean }) {
  const [value, setValue] = useState(0);
  return (
    <MoneyKeypadInput
      keyboardMode={forced ? "native" : undefined}
      ariaLabel="原生报价"
      value={value ? String(value) : ""}
      onChange={(next) => setValue(Number(next) || 0)}
    />
  );
}

describe("MoneyKeypadInput", () => {
  it("keeps a focused native draft through external prop updates and adopts the prop on blur", async () => {
    setViewport(430, true);
    const user = userEvent.setup();
    const view = render(
      <MoneyKeypadInput
        keyboardMode="native"
        ariaLabel="外部更新金额"
        value="12"
        onChange={() => undefined}
      />,
    );
    const input = screen.getByRole("textbox", { name: "外部更新金额" });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "0.");
    view.rerender(
      <MoneyKeypadInput
        keyboardMode="native"
        ariaLabel="外部更新金额"
        value="99"
        onChange={() => undefined}
      />,
    );
    expect(input).toHaveValue("0.");
    await user.tab();
    expect(input).toHaveValue("99");
  });

  it("preserves native decimal drafts on mobile even with numeric parent state", async () => {
    setViewport(390, true);
    const user = userEvent.setup();
    render(<NativeNumericHarness />);
    const input = screen.getByRole("textbox", { name: "原生报价" });
    expect(input).toHaveAttribute("inputmode", "decimal");
    await user.type(input, "0.");
    expect(input).toHaveValue("0.");
    await user.type(input, "5");
    expect(input).toHaveValue("0.5");
    await user.clear(input);
    expect(input).toHaveValue("");
    await user.type(input, "0,5");
    expect(input).toHaveValue("0.5");
    await user.tab();
    expect(input).toHaveValue("0.5");
    expect(document.querySelector('[data-virtual-keyboard-dock="true"]')).toBeNull();
  });
  it("preserves decimal drafts for the resolved desktop native surface with numeric parent state", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    render(<NativeNumericHarness forced={false} />);
    const input = screen.getByRole("textbox", { name: "原生报价" });
    await user.type(input, "0.");
    expect(input).toHaveValue("0.");
    await user.type(input, "5");
    expect(input).toHaveValue("0.5");
    await user.clear(input);
    await user.type(input, "0,5");
    expect(input).toHaveValue("0.5");
  });

  it("edits money through the app keypad without rendering a native input", async () => {
    setViewport(768, true);
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

  it("keeps keypad actions inside the portal while finishing an amount of 100", async () => {
    setViewport(390, true);
    const user = userEvent.setup();
    const onQuoteClick = vi.fn();
    const onBackCoverClick = vi.fn();
    render(
      <div onClick={onQuoteClick}>
        <MoneyKeypadHarness />
        <button type="button" onClick={onBackCoverClick}>
          后盖
        </button>
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "报价金额" }));
    onQuoteClick.mockClear();

    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "删除最后一位金额" }));
    expect(screen.getByTestId("value")).toBeEmptyDOMElement();
    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "清空" }));
    expect(screen.getByTestId("value")).toBeEmptyDOMElement();
    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "00" }));
    expect(screen.getByTestId("value")).toHaveTextContent("100");
    await user.click(screen.getByRole("button", { name: "完成" }));

    expect(document.querySelector('[data-virtual-keyboard-dock="true"]')).toBeNull();
    expect(screen.getByRole("button", { name: "报价金额" })).toHaveTextContent("100");
    expect(onQuoteClick).not.toHaveBeenCalled();
    expect(onBackCoverClick).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "后盖" }));
    expect(onBackCoverClick).toHaveBeenCalledOnce();
  });

  it.each([390, 1024, 1280, 1440])(
    "uses a native decimal input on a %ipx desktop",
    async (width) => {
      setViewport(width);
      const user = userEvent.setup();
      const { container } = render(<MoneyKeypadHarness />);
      const nativeInput = container.querySelector("input") as HTMLInputElement;

      expect(
        container.querySelector('[data-money-keypad-native-input="true"]'),
      ).toBeInTheDocument();
      expect(nativeInput).toHaveAttribute("inputmode", "decimal");
      await user.type(nativeInput, "12.5x");

      expect(nativeInput).toHaveValue("12.5");
      expect(screen.getByTestId("value")).toHaveTextContent("12.5");
      expect(document.querySelector('[data-virtual-keyboard-dock="true"]')).toBeNull();
    },
  );

  it("keeps the app keypad available on a wide iPad", async () => {
    setViewport(1280, true);
    const user = userEvent.setup();
    render(<MoneyKeypadHarness />);

    await user.click(screen.getByRole("button", { name: "报价金额" }));
    expect(await screen.findByRole("group", { name: "报价金额 虚拟金额键盘" })).toBeVisible();
  });

  it("overlays a scoped editor without scrolling or moving the controls behind it", async () => {
    setViewport(768, true);
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const onFaultClick = vi.fn();
    render(
      <div data-keypad-scope="true">
        <button type="button" onClick={onFaultClick}>
          屏幕
        </button>
        <MoneyKeypadInput
          layout="quote-editor"
          ariaLabel="定金"
          value="0"
          onChange={() => undefined}
        />
        <div data-virtual-keyboard-host />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "定金" }));
    const dock = document.querySelector('[data-virtual-keyboard-dock="true"]');
    expect(dock).toHaveAttribute("data-virtual-keyboard-layout", "overlay");
    expect(dock).toHaveClass("absolute");
    expect(scrollIntoView).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "屏幕" }));
    expect(onFaultClick).not.toHaveBeenCalled();
    expect(document.querySelector('[data-virtual-keyboard-dock="true"]')).toBeNull();
    await user.click(screen.getByRole("button", { name: "屏幕" }));
    expect(onFaultClick).toHaveBeenCalledOnce();
  });

  it.each([390, 768])(
    "uses the roomier quote editor keypad layout at %ipx without changing its input flow",
    async (width) => {
      setViewport(width, true);
      const user = userEvent.setup();
      render(
        <MoneyKeypadInput
          layout="quote-editor"
          ariaLabel="报价金额"
          value="12"
          onChange={() => undefined}
        />,
      );

      await user.click(screen.getByRole("button", { name: "报价金额" }));
      const keypad = document.querySelector('[data-money-keypad-layout="quote-editor"]');
      expect(keypad).toBeVisible();
      expect(screen.getByRole("button", { name: "1" })).toHaveClass("h-12", "sm:h-14");
      expect(screen.getByRole("button", { name: "完成" })).toHaveClass("h-12", "sm:h-14");
    },
  );

  it("does not treat browser shortcuts or composition as money input", async () => {
    setViewport(768, true);
    const user = userEvent.setup();
    render(<MoneyKeypadHarness />);
    const trigger = screen.getByRole("button", { name: "报价金额" });
    await user.click(trigger);
    fireEvent.keyDown(trigger, { key: "1", ctrlKey: true });
    fireEvent.keyDown(trigger, { key: "2", metaKey: true });
    fireEvent.keyDown(trigger, { key: "3", altKey: true });
    fireEvent.keyDown(trigger, { key: "4", isComposing: true });
    expect(screen.getByTestId("value")).toBeEmptyDOMElement();
  });

  it("accepts physical money keys while the virtual keypad is open", async () => {
    setViewport(1280, true);
    const user = userEvent.setup();
    render(<MoneyKeypadHarness />);
    const trigger = screen.getByRole("button", { name: "报价金额" });

    await user.click(trigger);
    await user.keyboard("12,50");
    expect(screen.getByTestId("value")).toHaveTextContent("12.50");
    await user.keyboard("{Backspace}7");
    expect(screen.getByTestId("value")).toHaveTextContent("12.57");
    await user.keyboard("{Delete}3.25");
    expect(screen.getByTestId("value")).toHaveTextContent("3.25");
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("group", { name: "报价金额 虚拟金额键盘" })).toBeNull();
    expect(trigger).toHaveFocus();
    expect(screen.getByTestId("value")).toHaveTextContent("3.25");
  });

  it("continues physical input after clicking a virtual key and restores focus on Escape", async () => {
    setViewport(1280, true);
    const user = userEvent.setup();
    render(<MoneyKeypadHarness />);
    const trigger = screen.getByRole("button", { name: "报价金额" });

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "1" }));
    await user.keyboard("2.5");
    expect(screen.getByTestId("value")).toHaveTextContent("12.5");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "报价金额 虚拟金额键盘" })).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
