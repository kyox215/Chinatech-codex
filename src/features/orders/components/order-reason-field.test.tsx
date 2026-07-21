import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import {
  createEmptyOrderReasonDraft,
  getOrderReasonCatalog,
  type OrderReasonDraft,
} from "@/features/orders/model/order-reason-catalog";

import { OrderReasonField } from "./order-reason-field";

afterEach(cleanup);

function Harness() {
  const [value, setValue] = useState<OrderReasonDraft>(createEmptyOrderReasonDraft);
  return (
    <>
      <OrderReasonField
        catalog={getOrderReasonCatalog("transition.cancel")}
        value={value}
        onChange={setValue}
      />
      <output data-testid="selection">
        {value.primaryCode}|{value.note}
      </output>
    </>
  );
}

describe("OrderReasonField", () => {
  it("starts with no selected reason and exposes native radio semantics", () => {
    render(<Harness />);

    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.getAllByRole("radio").every((radio) => !radio.hasAttribute("checked"))).toBe(
      true,
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("selects a preset without opening a text field", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText("客户主动取消"));

    expect(screen.getByTestId("selection")).toHaveTextContent("customer_cancelled|");
    expect(screen.getByRole("radio", { name: /客户主动取消/ })).toBeChecked();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("only shows the required note after other is explicitly selected", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /查看全部/ }));
    await user.click(screen.getByText("其他原因"));
    const note = screen.getByRole("textbox", { name: "其他原因（必填）" });
    expect(note).toHaveAttribute("data-order-other-reason", "true");
    await user.type(note, "需要特殊处理");

    expect(screen.getByTestId("selection")).toHaveTextContent("other|需要特殊处理");
  });

  it("supports arrow-key radio navigation", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const first = screen.getByRole("radio", { name: /客户主动取消/ });
    await user.click(first);
    first.focus();

    await user.keyboard("{ArrowDown}");
    const second = screen.getByRole("radio", { name: /重复或误建/ });
    expect(second).toHaveFocus();
  });
});
