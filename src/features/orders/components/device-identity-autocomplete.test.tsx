import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DeviceIdentityAutocomplete } from "./device-identity-autocomplete";
import { orderBrandSuggestions, type DeviceSuggestion } from "../model/device-autocomplete";

function Harness({
  onSubmit = () => undefined,
  options = orderBrandSuggestions,
}: {
  onSubmit?: () => void;
  options?: readonly DeviceSuggestion[];
}) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <DeviceIdentityAutocomplete
        id="brand"
        value={value}
        label="Brand"
        placeholder="Brand"
        options={options}
        onChange={setValue}
        onSelect={(option) => setValue(option.value)}
      />
    </form>
  );
}

describe("device identity autocomplete", () => {
  it("retains mouse input focus without cancelling touch or pen native clicks", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Brand" });
    fireEvent.focus(input);
    const option = screen.getByRole("option", { name: "Apple" });
    for (const pointerType of ["mouse", "touch", "pen"]) {
      const event = new Event("pointerdown", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "pointerType", { value: pointerType });
      fireEvent(option, event);
      expect(event.defaultPrevented).toBe(pointerType === "mouse");
    }
    fireEvent.click(option);
    expect(input).toHaveValue("Apple");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "false");
  });
  it("offers immediate prefixes and selects with Enter without submitting the form", () => {
    const submit = vi.fn();
    render(<Harness onSubmit={submit} />);
    const input = screen.getByRole("combobox", { name: "Brand" });
    fireEvent.change(input, { target: { value: "A" } });
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Apple");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("Apple");
    expect(submit).not.toHaveBeenCalled();
  });
  it("retains unmatched text, closes on Escape and does not accept IME Enter", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Brand" });
    fireEvent.change(input, { target: { value: "S" } });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(input).toHaveValue("S");
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveAttribute("aria-expanded", "false");
    fireEvent.change(input, { target: { value: "Unknown Brand" } });
    expect(screen.getByRole("status")).toBeVisible();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("Unknown Brand");
  });
  it("opens the full brand catalog progressively and reaches its final item", () => {
    const options = Array.from({ length: 105 }, (_, index) => ({
      value: `Model ${String(index + 1).padStart(3, "0")}`,
      aliases: [],
    }));
    render(<Harness options={options} />);
    const input = screen.getByRole("combobox", { name: "Brand" });
    fireEvent.focus(input);
    expect(screen.getAllByRole("option")).toHaveLength(40);
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-setsize", "105");
    const popup = screen.getByRole("listbox").parentElement!;
    Object.defineProperties(popup, {
      scrollTop: { configurable: true, value: 1500 },
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 1800 },
    });
    fireEvent.scroll(popup);
    expect(screen.getAllByRole("option")).toHaveLength(80);
    fireEvent.scroll(popup);
    expect(screen.getAllByRole("option")).toHaveLength(105);
    fireEvent.keyDown(input, { key: "End" });
    fireEvent.mouseEnter(screen.getByRole("option", { name: "Model 080" }));
    expect(screen.getByRole("option", { name: "Model 105" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.keyDown(input, { key: "Home" });
    expect(screen.getByRole("option", { name: "Model 001" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.keyDown(input, { key: "End" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("Model 105");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "false");
  });
  it("searches beyond the rendered batch and clears stale suggestions when the brand changes", () => {
    const models = Array.from({ length: 81 }, (_, index) => ({
      value: `Samsung ${index + 1}`,
      aliases: [],
    }));
    const { rerender } = render(<Harness options={models} />);
    const input = screen.getByRole("combobox", { name: "Brand" });
    fireEvent.change(input, { target: { value: "Samsung 81" } });
    expect(screen.getByRole("option", { name: "Samsung 81" })).toBeVisible();
    rerender(<Harness options={[{ value: "Name-only model", aliases: [] }]} />);
    expect(screen.queryByRole("option", { name: "Samsung 81" })).not.toBeInTheDocument();
    expect(input).toHaveValue("Samsung 81");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("Name-only model");
  });

  it("uses a scrollable bottom sheet from the 44px compact selector trigger", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    render(<Harness />);

    const input = screen.getByRole("combobox", { name: "Brand" });
    const trigger = document.querySelector(
      '[data-device-identity-selector-trigger="true"]',
    ) as HTMLButtonElement;
    input.focus();
    fireEvent.click(trigger);

    expect(trigger).toHaveClass("size-11");
    expect(input).not.toHaveFocus();
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("listbox", { name: "Brand" })).toHaveClass(
      "overflow-y-auto",
      "overscroll-contain",
    );
    fireEvent.click(within(sheet).getByRole("option", { name: "Apple" }));
    expect(input).toHaveValue("Apple");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
