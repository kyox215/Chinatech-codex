import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { InventorySyncStatusPanel } from "./inventory-sync-status-panel";

describe("inventory sync status contract", () => {
  it("announces a committed write while reads are still pending", () => {
    render(<InventorySyncStatusPanel status="committed-refreshing" />);

    const panel = document.querySelector('[data-ui="inventory-sync-status-panel"]');
    expect(panel).toHaveAttribute("aria-busy", "true");
    expect(panel).toHaveTextContent("写入已完成");
    expect(panel).toHaveTextContent("不要重复提交");
    expect(panel).toHaveTextContent("不会再次写入");
    expect(screen.queryByRole("button", { name: /重试同步/ })).not.toBeInTheDocument();
  });

  it("keeps committed refresh failure actionable without exposing raw data", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const open = vi.fn();
    render(
      <InventorySyncStatusPanel
        status="committed-refresh-failed"
        onRetry={retry}
        onOpenCommitted={open}
        privacyRedacted
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("写入已完成");
    expect(screen.getByRole("alert")).toHaveTextContent("请不要重复提交");
    expect(screen.getByRole("alert")).toHaveTextContent("只读取最新状态");
    expect(screen.getByRole("alert")).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByText(/IMEI|SKU|€|成本|商品名/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试同步" })).toHaveClass("min-h-11");
    await user.click(screen.getByRole("button", { name: "重试同步" }));
    await user.click(screen.getByRole("button", { name: "打开已完成记录" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("supports a recovered state and keeps offline draft distinct", () => {
    const { rerender } = render(<InventorySyncStatusPanel status="recovered" />);
    expect(screen.getByRole("status")).toHaveTextContent("已读取最新状态");
    expect(screen.getByRole("status")).toHaveTextContent("写入已完成");

    rerender(<InventorySyncStatusPanel status="offline-draft" />);
    expect(screen.getByRole("status")).toHaveTextContent("仍是离线草稿");
    expect(screen.getByRole("status")).toHaveTextContent("尚未写入服务端");
    fireEvent.keyDown(screen.getByRole("status"), { key: "Escape" });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("does not turn a failed retry into a mutation-like action", async () => {
    const retry = vi.fn().mockRejectedValue(new Error("offline"));
    render(<InventorySyncStatusPanel status="committed-refresh-failed" onRetry={retry} />);

    fireEvent.click(screen.getByRole("button", { name: "重试同步" }));
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alert")).toHaveTextContent("不会再次写入");
  });
});
