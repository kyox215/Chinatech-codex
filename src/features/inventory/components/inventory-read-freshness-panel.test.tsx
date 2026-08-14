import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { InventoryReadFreshnessPanel } from "./inventory-read-freshness-panel";

const stale = { state: "stale" as const, hidden: false, lastSuccessAt: 1_754_000_000_000 };

describe("InventoryReadFreshnessPanel", () => {
  it("keeps cached stale data read-only and offers a read-only refresh", async () => {
    const user = userEvent.setup();
    const onVerify = vi.fn();
    render(<InventoryReadFreshnessPanel freshness={stale} onVerify={onVerify} />);

    const panel = screen.getByRole("alert");
    expect(panel).toHaveAttribute("data-read-freshness-state", "stale");
    expect(panel).toHaveTextContent("本机最后成功读取");
    expect(panel).toHaveTextContent("写入动作已锁定");
    const button = screen.getByRole("button", { name: "只读刷新最新状态" });
    expect(button).toHaveClass("min-h-11");
    await user.click(button);
    expect(onVerify).toHaveBeenCalledTimes(1);
  });

  it("renders verifying, failed, recovered, and privacy states with safe roles", () => {
    const { rerender } = render(
      <InventoryReadFreshnessPanel
        freshness={{ ...stale, state: "verifying" }}
        onVerify={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");

    rerender(
      <InventoryReadFreshnessPanel
        freshness={{ ...stale, state: "verify-failed" }}
        onVerify={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("读取失败");

    rerender(
      <InventoryReadFreshnessPanel
        freshness={{ ...stale, state: "recovered" }}
        onVerify={vi.fn()}
      />,
    );
    const recoveredPanel = document.querySelector('[data-ui="inventory-read-freshness-panel"]');
    expect(within(recoveredPanel as HTMLElement).getByRole("heading")).toHaveTextContent("已读取");

    rerender(
      <InventoryReadFreshnessPanel
        freshness={{ ...stale, state: "privacy-redacted" }}
        onVerify={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("资料已裁剪");
    expect(screen.getByRole("alert")).not.toHaveTextContent("本机最后成功读取：");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("hides fresh resolution", () => {
    const { container } = render(
      <InventoryReadFreshnessPanel
        freshness={{ state: "fresh", hidden: true, lastSuccessAt: 1 }}
        onVerify={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-ui="inventory-read-freshness-panel"]')).toBeNull();
  });
});
