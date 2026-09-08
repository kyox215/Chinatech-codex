import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { NumericKeypadInput } from "./numeric-keypad-input";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
});
function compact() {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Linux; Android 15)");
}

it("preserves uncontrolled FormData, required/range/step validation and reset", async () => {
  compact();
  const user = userEvent.setup();
  const submit = vi.fn((event) => event.preventDefault());
  const { container } = render(
    <form onSubmit={submit}>
      <NumericKeypadInput
        aria-label="Quantity"
        name="quantity"
        defaultValue=""
        required
        min={1}
        max={5}
        step={1}
      />
      <button type="submit">Save</button>
      <button type="reset">Reset</button>
    </form>,
  );
  const form = container.querySelector("form")!;
  const input = container.querySelector("input")!;
  expect(input.type).toBe("number");
  expect(input.readOnly).toBe(false);
  expect(input.willValidate).toBe(true);
  expect(form.checkValidity()).toBe(false);
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Quantity" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Quantity" }));
  await user.click(screen.getByRole("button", { name: "6" }));
  expect(new FormData(form).get("quantity")).toBe("6");
  expect(input.validity.rangeOverflow).toBe(true);
  await user.click(screen.getByRole("button", { name: "清空" }));
  await user.click(screen.getByRole("button", { name: "3" }));
  await user.click(screen.getByRole("button", { name: "完成" }));
  expect(form.checkValidity()).toBe(true);
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(submit).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Reset" }));
  expect(new FormData(form).get("quantity")).toBe("");
  expect(form.checkValidity()).toBe(false);
});

it("retains ten decimal exchange-rate precision and native step validity", async () => {
  compact();
  const user = userEvent.setup();
  const { container } = render(
    <form>
      <NumericKeypadInput
        aria-label="Rate"
        name="rate"
        defaultValue="0.123456789"
        min="0.0000000001"
        max="1000000"
        step="0.0000000001"
      />
    </form>,
  );
  await user.click(screen.getByRole("button", { name: "Rate" }));
  await user.click(screen.getByRole("button", { name: "1" }));
  await user.click(screen.getByRole("button", { name: "完成" }));
  expect(new FormData(container.querySelector("form")!).get("rate")).toBe("0.1234567891");
  expect(container.querySelector("input")!.validity.stepMismatch).toBe(false);
});

it("preserves text identifiers with leading zero and forwards native changes", async () => {
  compact();
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { container } = render(
    <NumericKeypadInput
      aria-label="Code"
      type="text"
      inputMode="numeric"
      defaultValue="001"
      onChange={onChange}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Code" }));
  await user.click(screen.getByRole("button", { name: "2" }));
  expect(container.querySelector("input")!.value).toBe("0012");
  expect(onChange).toHaveBeenCalledTimes(1);
  fireEvent.change(container.querySelector("input")!, { target: { value: "0042" } });
  expect(onChange).toHaveBeenCalledTimes(2);
});

it("uses the latest closed value and forwards cancellable key events with the real input target", async () => {
  compact();
  const onChange = vi.fn();
  const onKeyDown = vi.fn((event) => {
    expect(event.currentTarget).toBeInstanceOf(HTMLInputElement);
    expect(event.target).toBe(event.currentTarget);
    if (event.key === "4") event.preventDefault();
  });
  const { rerender, container } = render(
    <NumericKeypadInput aria-label="Value" value="12" onChange={onChange} onKeyDown={onKeyDown} />,
  );
  rerender(
    <NumericKeypadInput aria-label="Value" value="99" onChange={onChange} onKeyDown={onKeyDown} />,
  );
  const trigger = screen.getByRole("button", { name: "Value" });
  fireEvent.keyDown(trigger, { key: "3" });
  expect(onChange.mock.calls[0][0].target).toBe(container.querySelector("input"));
  expect(trigger).toHaveTextContent("993");
  fireEvent.keyDown(trigger, { key: "4" });
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onKeyDown).toHaveBeenCalledTimes(2);
});

it("reopens scientific numeric values as decimal drafts without changing the ten-place boundary", async () => {
  compact();
  const user = userEvent.setup();
  function Rate() {
    const [value, setValue] = useState(1e-10);
    return (
      <NumericKeypadInput
        aria-label="Rate"
        value={value}
        step={1e-10}
        min={1e-10}
        onChange={(event) => setValue(Number(event.target.value))}
      />
    );
  }
  const { container } = render(<Rate />);
  const trigger = screen.getByRole("button", { name: "Rate" });
  expect(trigger).toHaveTextContent("0.0000000001");
  await user.click(trigger);
  await user.click(screen.getByRole("button", { name: "5" }));
  expect(trigger).toHaveTextContent("0.0000000001");
  await user.click(screen.getByRole("button", { name: "完成" }));
  await user.click(trigger);
  await user.click(document.querySelector<HTMLButtonElement>('[data-numeric-key="backspace"]')!);
  await user.click(screen.getByRole("button", { name: "2" }));
  await user.click(screen.getByRole("button", { name: "完成" }));
  expect(trigger).toHaveTextContent("0.0000000002");
  expect(container.querySelector("input")!.valueAsNumber).toBe(2e-10);
  fireEvent.keyDown(trigger, { key: "Backspace" });
  fireEvent.keyDown(trigger, { key: "3" });
  expect(trigger).toHaveTextContent("0.0000000003");
});
