import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  initialNewOrderForm,
  type NewOrderFormState,
} from "@/features/orders/model/new-order-form";

import { NewOrderFaultDiagnosisSection } from "./new-order-fault-diagnosis-section";

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("NewOrderFaultDiagnosisSection", () => {
  it("keeps customer and quote drafts while the compact mode switch stays in place", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    const section = container.querySelector<HTMLElement>(
      '[data-new-order-section="fault-diagnosis"]',
    );
    expect(section).not.toBeNull();
    if (!section) return;

    expect(within(section).getByText("掉电很快")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "客户描述的故障现象" })).not.toBeInTheDocument();

    await user.click(within(section).getByRole("button", { name: "编辑客户报障" }));
    const dialog = await screen.findByRole("dialog", { name: "编辑客户报障" });
    const description = within(dialog).getByRole("textbox", {
      name: "客户描述的故障现象",
    });
    expect(description).toHaveAttribute("aria-describedby", "new-order-customer-report-count");
    await user.clear(description);
    await user.type(description, "屏幕偶发闪烁");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(section).getByText("屏幕偶发闪烁")).toBeInTheDocument();

    await user.click(within(section).getByRole("button", { name: "问题未知，需检测" }));
    expect(within(section).getByText("客户暂时无法确认具体故障，需检测")).toBeInTheDocument();
    expect(screen.getByTestId("form-state")).toHaveTextContent('"issue":"屏幕偶发闪烁"');
    expect(screen.getByTestId("form-state")).toHaveTextContent('"deposit":20');
    expect(screen.getByTestId("form-state")).toHaveTextContent('"name":"更换电池"');

    await user.click(within(section).getByRole("button", { name: "编辑客户报障" }));
    const unknownDialog = await screen.findByRole("dialog", { name: "编辑客户报障" });
    await user.click(within(unknownDialog).getByRole("button", { name: "问题明确" }));
    expect(within(unknownDialog).getByRole("textbox", { name: "客户描述的故障现象" })).toHaveValue(
      "屏幕偶发闪烁",
    );
  });
});

function Harness() {
  const [form, setForm] = useState<NewOrderFormState>({
    ...initialNewOrderForm,
    issue: "掉电很快",
    deposit: 20,
    faults: [
      {
        key: "battery:main",
        categoryKey: "battery",
        categoryLabel: "电池",
        name: "更换电池",
        price: 59,
        note: "Sostituzione batteria",
      },
    ],
  });

  return (
    <>
      <NewOrderFaultDiagnosisSection form={form} setForm={setForm} />
      <output data-testid="form-state">{JSON.stringify(form)}</output>
    </>
  );
}
