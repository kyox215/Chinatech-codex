import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { InventoryNoActionGuidanceCard } from "./inventory-no-action-guidance-card";

describe("InventoryNoActionGuidanceCard", () => {
  it("explains terminal state without showing a write action", () => {
    render(<InventoryNoActionGuidanceCard guidance={{ state: "terminal-complete" }} />);
    expect(screen.getByRole("heading", { name: "当前流程已完成" })).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("不会重复写入");
  });

  it("keeps target unavailable distinct from permissions", () => {
    render(
      <InventoryNoActionGuidanceCard
        guidance={{ state: "target-unavailable", targetCommand: "reservation.create" }}
      />,
    );
    expect(screen.getByRole("heading", { name: "当前目标动作不可用" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("不会把它解释为权限结论");
  });

  it("provides only caller-owned read-only recovery", async () => {
    const user = userEvent.setup();
    const onReadOnly = vi.fn();
    render(
      <InventoryNoActionGuidanceCard
        guidance={{ state: "server-readonly" }}
        onReadOnly={onReadOnly}
      />,
    );
    await user.click(screen.getByRole("button", { name: "只读核对最新状态" }));
    expect(onReadOnly).toHaveBeenCalledTimes(1);
  });

  it("redacts business details while preserving guidance semantics", () => {
    render(
      <InventoryNoActionGuidanceCard guidance={{ state: "facts-need-review" }} privacyRedacted />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("业务详情已裁剪");
    expect(screen.queryByText(/SKU|IMEI|€|sale-|客户姓名/)).not.toBeInTheDocument();
  });
});
