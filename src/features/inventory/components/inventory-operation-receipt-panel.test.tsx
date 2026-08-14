import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { InventoryLifecycleCommandResult } from "@/lib/repairdesk/types";

import { InventoryOperationReceiptPanel } from "./inventory-operation-receipt-panel";
import { resolveInventoryOperationReceipt } from "../model/inventory-operation-receipt";

const successResult: InventoryLifecycleCommandResult = {
  ok: true,
  code: "appended",
  sale_order_id: "sale-private-id",
  payment_id: "payment-private-id",
  balance: 123.45,
};

describe("InventoryOperationReceiptPanel", () => {
  it("announces a safe receipt and keeps sync responsibilities separate", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const receipt = resolveInventoryOperationReceipt("payment.append", successResult);
    expect(receipt).not.toBeNull();

    render(
      <InventoryOperationReceiptPanel
        receipt={receipt!}
        receiptKey={1}
        privacyRedacted
        nextAction={{ label: "查看当前业务记录", onClick }}
      />,
    );

    const panel = screen.getByRole("status");
    expect(panel).toHaveAttribute("data-operation-receipt-kind", "confirmed");
    expect(panel).toHaveTextContent("付款记录已确认追加");
    expect(panel).toHaveTextContent("等待同步");
    expect(panel).toHaveTextContent("不显示商品、金额或设备标识");
    expect(panel).not.toHaveTextContent("sale-private-id");
    expect(panel).not.toHaveTextContent("payment-private-id");
    expect(panel).not.toHaveTextContent("123.45");

    const action = screen.getByRole("button", { name: "查看当前业务记录" });
    expect(action).toHaveClass("min-h-11");
    await user.click(action);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps replay wording safe and focuses only for a new receipt key", () => {
    const receipt = resolveInventoryOperationReceipt("sale.complete", {
      ok: true,
      code: "idempotent_replay",
    });
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const { rerender } = render(
      <InventoryOperationReceiptPanel receipt={receipt!} receiptKey="one" />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("幂等凭证");
    expect(screen.getByRole("status")).not.toHaveTextContent("重复写入");
    const initialCalls = focus.mock.calls.length;
    rerender(<InventoryOperationReceiptPanel receipt={receipt!} receiptKey="one" />);
    expect(focus).toHaveBeenCalledTimes(initialCalls);
    rerender(<InventoryOperationReceiptPanel receipt={receipt!} receiptKey="two" />);
    expect(focus).toHaveBeenCalledTimes(initialCalls + 1);
    focus.mockRestore();
  });
});
