import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";

import {
  FaultDiagnosisPicker,
  type SelectedFault,
} from "@/components/orders/fault-diagnosis-picker";

import { AccessoryNotesPicker } from "./accessory-notes-picker";
import { WarrantyPicker, type WarrantyDraftValue } from "./warranty-picker";

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => undefined;
  }
});

function AccessoryHarness() {
  const [value, setValue] = useState("");
  return (
    <div>
      <AccessoryNotesPicker value={value} onChange={setValue} compact />
      <output data-testid="accessory-value">{value}</output>
    </div>
  );
}

function WarrantyHarness() {
  const [value, setValue] = useState<WarrantyDraftValue>({
    warranty_months: 6,
    warranty_text: "6个月",
  });
  return (
    <div>
      <WarrantyPicker
        valueMonths={value.warranty_months}
        valueText={value.warranty_text}
        reason={value.warranty_change_reason}
        defaultMonths={6}
        onChange={setValue}
        compact
      />
      <output data-testid="warranty-value">
        {value.warranty_months}|{value.warranty_text}|{value.warranty_change_reason ?? ""}
      </output>
    </div>
  );
}

function FaultHarness() {
  const [selected, setSelected] = useState<SelectedFault[]>([]);
  return (
    <div>
      <FaultDiagnosisPicker selected={selected} onChange={setSelected} />
      <output data-testid="fault-value">{selected.map((item) => item.name).join("|")}</output>
    </div>
  );
}

describe("order option pickers", () => {
  it("hides generic no-subtype fault options while preserving category selection", async () => {
    const user = userEvent.setup();
    render(<FaultHarness />);

    await user.click(screen.getByRole("button", { name: "尾插" }));

    expect(screen.getByTestId("fault-value")).toHaveTextContent("尾插");

    await user.click(screen.getByRole("button", { name: "展开尾插细分选项" }));

    expect(screen.queryByText("不细分")).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /接口松动/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
  });

  it("uses a multi-select dropdown for accessory notes and keeps none exclusive", async () => {
    const user = userEvent.setup();
    render(<AccessoryHarness />);

    await user.click(screen.getByRole("button", { name: /选择留存物品/ }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "SIM卡" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "手机壳" }));

    expect(screen.getByTestId("accessory-value")).toHaveTextContent("SIM卡、手机壳");
    expect(screen.getByText("SIM卡等2项")).toBeInTheDocument();

    await user.click(screen.getByRole("menuitemcheckbox", { name: "无" }));

    expect(screen.getByTestId("accessory-value")).toHaveTextContent("无");
    await user.keyboard("{Escape}");
  });

  it("uses a select for warranty and preserves the required non-default reason", async () => {
    const user = userEvent.setup();
    render(<WarrantyHarness />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "12个月" }));

    expect(screen.getByPlaceholderText("请输入非默认质保原因")).toBeInTheDocument();
    expect(screen.getByTestId("warranty-value")).toHaveTextContent("12|12个月|");

    await user.type(screen.getByPlaceholderText("请输入非默认质保原因"), "客户购买延保");

    expect(screen.getByTestId("warranty-value")).toHaveTextContent("12|12个月|客户购买延保");
  });
});
