import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { initialNewOrderForm } from "@/features/orders/model/new-order-form";
import type { DeviceCustodyStatus } from "@/lib/repairdesk/types";

import {
  NewOrderDeviceInfoSection,
  NewOrderDeviceUnlockSection,
} from "./new-order-customer-device-section";
import { NewOrderValidationContext } from "./new-order-validation";

function DeviceForm() {
  const [form, setForm] = useState(initialNewOrderForm);
  return (
    <NewOrderValidationContext.Provider
      value={{ "device-brand": "请补充设备品牌", "device-model": "请补充设备型号" }}
    >
      <NewOrderDeviceInfoSection
        form={form}
        setForm={setForm}
        historyDevices={[]}
        onSelectHistoryDevice={vi.fn()}
        editorOnly
      />
    </NewOrderValidationContext.Provider>
  );
}

describe("new-order missing fields", () => {
  it("highlights the entire missing row then clears it while preserving the corrected draft", () => {
    const { container } = render(<DeviceForm />);
    expect(container.querySelector('[data-new-order-field="device-brand"]')).toHaveClass(
      "!bg-status-danger/10",
    );
    expect(screen.getByText("请补充设备品牌")).toBeVisible();
    const brand = screen.getByRole("combobox", { name: "品牌" });
    fireEvent.change(brand, { target: { value: "S" } });
    fireEvent.keyDown(brand, { key: "Enter" });
    expect(brand).toHaveValue("Samsung");
    expect(screen.queryByText("请补充设备品牌")).not.toBeInTheDocument();
    const model = screen.getByRole("combobox", { name: "型号" });
    fireEvent.change(model, { target: { value: "A135F" } });
    fireEvent.keyDown(model, { key: "Enter" });
    expect(model).toHaveValue("Galaxy A13");
    expect(screen.queryByText("请补充设备型号")).not.toBeInTheDocument();
  });
});

describe("NewOrderDeviceUnlockSection", () => {
  it.each([null, "with_shop", "with_customer"] as const)(
    "keeps phone-password editing available when custody is %s",
    (deviceCustodyStatus: DeviceCustodyStatus | null) => {
      render(
        <NewOrderDeviceUnlockSection
          form={{ ...initialNewOrderForm, deviceCustodyStatus }}
          setForm={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByText("手机密码"));
      expect(screen.getByRole("button", { name: "无" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "文字" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "PIN" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "图案" })).toBeEnabled();
    },
  );
});
