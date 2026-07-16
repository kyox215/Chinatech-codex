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

  it("shows expanded front desk service options for every fault category", async () => {
    const user = userEvent.setup();
    render(<FaultHarness />);

    const expectedOptions = [
      { category: "屏幕", options: ["黑屏无显示", "贴膜服务"] },
      { category: "电池", options: ["自动关机", "电池校准"] },
      { category: "尾插", options: ["快充异常", "无线充异常"] },
      { category: "摄像头", options: ["无法对焦", "相机打不开"] },
      { category: "进水", options: ["资料抢救", "进水检测报告"] },
      { category: "主板", options: ["Wi-Fi/蓝牙异常", "主板维修"] },
      { category: "系统", options: ["屏幕锁解锁", "激活锁核验咨询"] },
      { category: "后盖", options: ["后壳总成", "防水胶重贴"] },
      { category: "面容/指纹", options: ["距离感应异常", "Home 指纹键"] },
      { category: "扬声器", options: ["听筒无声", "听筒网清洁"] },
      { category: "麦克风", options: ["对方听不到", "麦克风清洁"] },
      { category: "按键", options: ["相机控制键", "震动马达"] },
    ];

    for (const { category, options } of expectedOptions) {
      await user.click(screen.getByRole("button", { name: `展开${category}细分选项` }));

      for (const option of options) {
        expect(screen.getByRole("menuitem", { name: new RegExp(option) })).toBeInTheDocument();
      }

      await user.keyboard("{Escape}");
    }
  });

  it("selects system unlock services without changing picker behavior", async () => {
    const user = userEvent.setup();
    render(<FaultHarness />);

    await user.click(screen.getByRole("button", { name: "展开系统细分选项" }));
    await user.click(screen.getByRole("menuitem", { name: /屏幕锁解锁/ }));

    expect(screen.getByTestId("fault-value")).toHaveTextContent("系统 - 屏幕锁解锁");
  });

  it("uses a multi-select dropdown for accessory notes and keeps none exclusive", async () => {
    const user = userEvent.setup();
    render(<AccessoryHarness />);

    await user.click(screen.getByRole("button", { name: /选择随附物品/ }));
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
