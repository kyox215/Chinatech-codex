import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DeviceIdentityAutocomplete } from "./device-identity-autocomplete";
import { orderBrandSuggestions } from "../model/device-autocomplete";

function Harness({ onSubmit = () => undefined }: { onSubmit?: () => void }) {
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
        options={orderBrandSuggestions}
        onChange={setValue}
        onSelect={(option) => setValue(option.value)}
      />
    </form>
  );
}

describe("device identity autocomplete", () => {
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
});
