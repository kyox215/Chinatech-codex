import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewOrderGuidedWorkspace } from "./new-order-guided-workspace";
import { initialNewOrderForm } from "@/features/orders/model/new-order-form";

afterEach(cleanup);

describe("NewOrderGuidedWorkspace", () => {
  it("exposes one step at a time and only renders submit on the review step", () => {
    render(<Harness />);

    expect(screen.getByRole("heading", { name: "客户资料" })).toBeVisible();
    expect(screen.getByText("customer-fields")).toBeVisible();
    expect(screen.queryByRole("button", { name: /确认并创建工单/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /下一步/ }));
    expect(screen.getByRole("heading", { name: "设备与交接" })).toBeVisible();
    expect(screen.getByText("device-fields")).toBeVisible();
    expect(screen.getByText("unlock-fields")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /下一步/ }));
    expect(screen.getByRole("heading", { name: "维修与报价" })).toBeVisible();
    expect(screen.getByText("quotation-fields")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /下一步/ }));
    expect(screen.getByRole("heading", { name: "确认创建" })).toBeVisible();
    expect(screen.getByRole("button", { name: /确认并创建工单/ })).toHaveAttribute(
      "type",
      "submit",
    );
    expect(screen.getByText("解锁信息：已记录（不显示内容）")).toBeVisible();
  });
});

function Harness() {
  const [step, setStep] = useState(0);
  return (
    <NewOrderGuidedWorkspace
      step={step}
      form={{
        ...initialNewOrderForm,
        customerName: "Mario",
        customerPhone: "+393331112222",
        brand: "Apple",
        model: "iPhone 15",
        deviceCustodyStatus: "with_shop",
        deviceUnlock: { method: "pin", value: "1234" },
      }}
      total={120}
      statusLabel="新建"
      diagnosisDeferred
      pending={false}
      customer={<div>customer-fields</div>}
      device={<div>device-fields</div>}
      unlock={<div>unlock-fields</div>}
      quotation={<div>quotation-fields</div>}
      onStepChange={setStep}
      onNext={() => setStep((current) => Math.min(3, current + 1))}
      onCancel={vi.fn()}
    />
  );
}
