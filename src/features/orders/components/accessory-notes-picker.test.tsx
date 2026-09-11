import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AccessoryNotesPicker } from "./accessory-notes-picker";
import { DenseOptionMenu } from "./dense-option-menu";
import { ACCESSORY_NOTE_OPTIONS } from "../model/order-accessory-notes";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { localizeAccessoryNoteOption } from "../model/order-i18n";
import { translateMessage } from "@/shared/i18n/messages";
afterEach(cleanup);
it("quick accessories use the existing exclusive selection and preserve custom notes", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const result = render(<AccessoryNotesPicker value="无" onChange={onChange} quickChoices />);
  await user.click(screen.getByRole("button", { name: "SIM卡" }));
  expect(onChange).toHaveBeenLastCalledWith("SIM卡");
  result.rerender(
    <AccessoryNotesPicker value="SIM卡、其他：收纳袋" onChange={onChange} quickChoices />,
  );
  await user.click(screen.getByRole("button", { name: "手机壳" }));
  expect(onChange).toHaveBeenLastCalledWith("SIM卡、手机壳、其他：收纳袋");
  expect(screen.getByRole("button", { name: "SIM卡" })).toHaveAttribute("aria-pressed", "true");
  result.rerender(
    <AccessoryNotesPicker value="SIM卡、其他：收纳袋" onChange={onChange} quickChoices disabled />,
  );
  onChange.mockClear();
  await user.click(screen.getByRole("button", { name: "SIM卡" }));
  expect(onChange).not.toHaveBeenCalled();
});
it("none remains exclusive and locking disables every direct choice", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const result = render(<AccessoryNotesPicker value="SIM卡，手机壳" onChange={onChange} />);
  await user.click(screen.getByRole("button", { name: "无" }));
  expect(onChange).toHaveBeenCalledWith("无");
  onChange.mockClear();
  result.rerender(<AccessoryNotesPicker value="SIM卡" onChange={onChange} disabled />);
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  screen.getAllByRole("button").forEach((button) => expect(button).toBeDisabled());
  expect(onChange).not.toHaveBeenCalled();
});
it.each(["zh-CN", "it-IT", "en"] as const)(
  "shows all accessory choices exactly once in %s",
  (locale) => {
    render(
      <LocaleProvider initialLocale={locale}>
        <AccessoryNotesPicker
          value="SIM卡、其他：Synthetic pouch"
          onChange={vi.fn()}
          quickChoices
        />
      </LocaleProvider>,
    );
    expect(screen.getAllByRole("button")).toHaveLength(ACCESSORY_NOTE_OPTIONS.length);
    for (const option of ACCESSORY_NOTE_OPTIONS) {
      const label = localizeAccessoryNoteOption(option, (key, values) =>
        translateMessage(locale, key, values),
      );
      expect(screen.getAllByRole("button", { name: label })).toHaveLength(1);
    }
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Synthetic pouch");
  },
);
it("keeps legacy custom text when toggling another option, and clears it only through other or none", async () => {
  function Harness() {
    const [value, setValue] = useState("Synthetic pouch");
    return (
      <>
        <AccessoryNotesPicker value={value} onChange={setValue} />
        <output data-testid="accessories-value">{value}</output>
      </>
    );
  }
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole("button", { name: "SIM卡" }));
  expect(screen.getByRole("textbox")).toHaveValue("Synthetic pouch");
  await user.click(screen.getByRole("button", { name: "其他" }));
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.getByTestId("accessories-value")).toHaveTextContent("SIM卡");
  await user.click(screen.getByRole("button", { name: "无" }));
  expect(screen.getByTestId("accessories-value")).toHaveTextContent(/^无$/);
  await user.click(screen.getByRole("button", { name: "SIM卡托" }));
  expect(screen.getByTestId("accessories-value")).toHaveTextContent(/^SIM卡托$/);
});
it("a disabled suggestion menu does not reopen when permission returns", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const props = { label: "品牌", value: "Apple", options: ["Apple", "Samsung"], onSelect };
  const result = render(<DenseOptionMenu {...props} />);
  await user.click(screen.getByRole("button"));
  expect(screen.getByRole("menu")).toBeVisible();
  result.rerender(<DenseOptionMenu {...props} disabled />);
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  result.rerender(<DenseOptionMenu {...props} />);
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(onSelect).not.toHaveBeenCalled();
});
