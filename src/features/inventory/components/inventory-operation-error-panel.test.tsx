import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { InventoryOperationErrorPanel } from "./inventory-operation-error-panel";

const unknownError = {
  kind: "outcome-unknown" as const,
  subtype: "connectivity" as const,
  status: 408,
  code: "timeout",
};

describe("InventoryOperationErrorPanel", () => {
  it("keeps raw errors out and exposes a read-only verification action", async () => {
    const user = userEvent.setup();
    const verify = vi.fn();
    render(<InventoryOperationErrorPanel error={unknownError} onVerify={verify} />);

    expect(screen.getByRole("alert")).toHaveTextContent("写入可能已经完成");
    expect(screen.queryByText(/timeout|私人|raw/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /读取最新状态/ }));
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("shows verifying and failed states without exposing a mutation action", async () => {
    const verify = vi.fn().mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    const { rerender } = render(
      <InventoryOperationErrorPanel
        error={unknownError}
        verificationStatus="verifying"
        onVerify={verify}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("不会调用写入操作");
    expect(screen.getByRole("button", { name: /正在读取最新状态/ })).toBeDisabled();

    rerender(
      <InventoryOperationErrorPanel
        error={unknownError}
        verificationStatus="failed"
        onVerify={verify}
        privacyRedacted
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("读取最新状态失败");
    expect(screen.getByText("读取最新状态失败；仍不要重复提交，请稍后再次读取。")).toHaveClass(
      "text-status-danger-foreground",
    );
    expect(screen.getByText(/不显示商品、金额或设备标识/)).toBeVisible();
    expect(screen.queryByText(/IMEI|SKU|€|成本/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /读取最新状态/ }));
    await waitFor(() => expect(verify).toHaveBeenCalledTimes(1));
  });

  it("contains a rejected read-only verification after the caller records its failed state", async () => {
    const user = userEvent.setup();
    const rawSentinel = "PRIVATE-READBACK-SENTINEL";
    const unhandled: unknown[] = [];
    const listener = (event: PromiseRejectionEvent) => unhandled.push(event.reason);
    window.addEventListener("unhandledrejection", listener);
    const verify = vi.fn().mockRejectedValue(new Error(rawSentinel));

    render(<InventoryOperationErrorPanel error={unknownError} onVerify={verify} />);
    await user.click(screen.getByRole("button", { name: /读取最新状态/ }));
    await waitFor(() => expect(verify).toHaveBeenCalledTimes(1));
    await Promise.resolve();

    expect(unhandled).toEqual([]);
    expect(screen.queryByText(rawSentinel)).not.toBeInTheDocument();
    window.removeEventListener("unhandledrejection", listener);
  });

  it("requires an explicit acknowledgement after a successful readback", async () => {
    const user = userEvent.setup();
    const acknowledge = vi.fn();
    const { rerender } = render(
      <InventoryOperationErrorPanel
        error={unknownError}
        verificationStatus="verified"
        onAcknowledge={acknowledge}
      />,
    );

    const acknowledgement = screen.getByRole("button", { name: "我已核对最新状态" });
    expect(acknowledgement).toHaveClass("min-h-11");
    await user.click(acknowledgement);
    expect(acknowledge).toHaveBeenCalledTimes(1);

    rerender(
      <InventoryOperationErrorPanel
        error={unknownError}
        verificationStatus="verified"
        acknowledged
        onAcknowledge={acknowledge}
      />,
    );
    expect(screen.queryByRole("button", { name: "我已核对最新状态" })).not.toBeInTheDocument();
    expect(
      screen.getByText("已确认你已核对最新状态；如需再次写入，请使用当前业务账中的明确动作。"),
    ).toBeVisible();
  });

  it("renders safe rejected and authorization copy", () => {
    const { rerender } = render(
      <InventoryOperationErrorPanel
        error={{ kind: "rejected", subtype: "validation", status: 422, code: "invalid_input" }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("操作未被接受");
    rerender(
      <InventoryOperationErrorPanel
        error={{ kind: "authorization", subtype: "authorization", status: 403 }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("当前账号无法执行此操作");
  });
});
