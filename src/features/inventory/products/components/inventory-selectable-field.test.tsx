import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InventorySelectableField } from "./inventory-selectable-field";

afterEach(cleanup);

const options = [
  { value: "128 GB", description: "常用容量" },
  { value: "256 GB" },
  { value: "512 GB", disabled: true },
] as const;

describe("InventorySelectableField", () => {
  it("keeps the desktop surface disclosure-first and closes on selection", async () => {
    const onChange = vi.fn();
    render(
      <InventorySelectableField
        id="storage"
        label="存储容量"
        placeholder="选择容量"
        options={options}
        mode="desktop"
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "选择容量" });
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-controls");

    fireEvent.click(trigger);
    const listbox = screen.getByRole("listbox", { name: "存储容量选择" });
    expect(screen.getByRole("dialog", { name: "存储容量选择" })).toBeInTheDocument();
    expect(screen.queryByText("✓")).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-inventory-selectable-field-surface="desktop"]'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-inventory-selectable-field-surface="mobile"]'),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", listbox.id);
    expect(screen.getByRole("option", { name: "128 GB" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "512 GB" })).toBeDisabled();

    fireEvent.click(screen.getByRole("option", { name: "128 GB" }));
    expect(onChange).toHaveBeenCalledWith("128 GB");
    expect(screen.queryByRole("listbox", { name: "存储容量选择" })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-controls");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes the desktop listbox on Escape and restores focus", async () => {
    render(
      <InventorySelectableField
        id="condition"
        label="成色"
        value="90%"
        options={[{ value: "100%" }, { value: "90%" }]}
        mode="desktop"
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "成色：90%" });
    fireEvent.click(trigger);
    const listbox = screen.getByRole("listbox", { name: "成色选择" });
    fireEvent.keyDown(listbox, { key: "Escape" });

    expect(screen.queryByRole("listbox", { name: "成色选择" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("focuses the selected desktop option after keyboard activation", async () => {
    const user = userEvent.setup();
    render(
      <InventorySelectableField
        id="storage-keyboard"
        label="存储容量"
        value="256 GB"
        options={options}
        mode="desktop"
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "存储容量：256 GB" });
    trigger.focus();
    await user.keyboard("{Enter}");

    const selected = screen.getByRole("option", { name: "256 GB" });
    await waitFor(() => expect(selected).toHaveFocus());

    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("roams enabled options with ArrowDown and selects with Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <InventorySelectableField
        id="storage-roaming"
        label="存储容量"
        value="128 GB"
        options={options}
        mode="desktop"
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "存储容量：128 GB" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const first = screen.getByRole("option", { name: "128 GB" });
    const next = screen.getByRole("option", { name: "256 GB" });
    await waitFor(() => expect(first).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(next).toHaveFocus());
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("256 GB");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("uses a separate mobile Sheet/listbox surface", async () => {
    const onChange = vi.fn();
    render(
      <InventorySelectableField
        id="ram"
        label="内存（RAM）"
        placeholder="选择内存"
        options={[{ value: "8 GB" }, { value: "16 GB" }]}
        mode="mobile"
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "选择内存" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const surface = document.querySelector('[data-inventory-selectable-field-surface="mobile"]');
    expect(surface).toBeInTheDocument();
    expect(
      document.querySelector('[data-inventory-selectable-field-surface="desktop"]'),
    ).not.toBeInTheDocument();
    const listbox = screen.getByRole("listbox", { name: "内存（RAM）选择" });
    expect(trigger).toHaveAttribute("aria-controls", listbox.id);

    fireEvent.click(screen.getByRole("option", { name: "16 GB" }));
    expect(onChange).toHaveBeenCalledWith("16 GB");
    expect(screen.queryByRole("listbox", { name: "内存（RAM）选择" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps pending fields safe and explicit without mounting a selector", () => {
    render(
      <InventorySelectableField
        id="color"
        label="设备颜色"
        options={[]}
        mode="mobile"
        pending
        pendingMessage="等待官方颜色映射审核"
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "选择" });
    expect(trigger).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("等待官方颜色映射审核");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
