import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getInventoryConflictDetails, InventoryConflictPanel } from "./inventory-conflict-panel";

describe("inventory conflict contract", () => {
  it("classifies structured 409 codes without reading localized message text", () => {
    expect(
      getInventoryConflictDetails({
        status: 409,
        code: "version_conflict",
        message: "任意本地化文本",
      }),
    ).toMatchObject({ kind: "version", code: "version_conflict" });
    expect(getInventoryConflictDetails({ status: 409, code: "projection_mismatch" })).toMatchObject(
      { kind: "projection" },
    );
    expect(
      getInventoryConflictDetails({ status: 409, code: "idempotency_conflict" }),
    ).toMatchObject({ kind: "idempotency" });
    expect(getInventoryConflictDetails({ status: 409, code: "other" })).toMatchObject({
      kind: "generic",
      code: "other",
    });
    expect(getInventoryConflictDetails({ status: 409 })).toMatchObject({ kind: "generic" });
    expect(getInventoryConflictDetails(new Error("其他设备已更新"))).toBeNull();
  });

  it("keeps recovery explicit and never runs a mutation by itself", async () => {
    const user = userEvent.setup();
    const recover = vi.fn();
    const conflict = getInventoryConflictDetails({ status: 409, code: "stale_version" })!;
    render(<InventoryConflictPanel conflict={conflict} onRecover={recover} preserveDraft />);

    expect(screen.getByRole("alert")).toHaveTextContent("不会自动保存或重放");
    const button = screen.getByRole("button", { name: "刷新并保留我的改动" });
    expect(button).toHaveClass("min-h-11");
    await user.click(button);
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it("exposes a resolving status and redacts sensitive context", () => {
    const conflict = getInventoryConflictDetails({ status: 409, code: "invalid_state" })!;
    render(
      <InventoryConflictPanel conflict={conflict} onRecover={vi.fn()} pending privacyRedacted />,
    );

    expect(screen.getByRole("button", { name: "正在刷新…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("不会提交任何写入");
    expect(screen.getByRole("alert")).toHaveTextContent("不显示商品、金额或设备标识");
    expect(screen.queryByText(/IMEI|SKU|€|成本/)).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("alert"), { key: "Escape" });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("reports a failed recovery without clearing the panel", async () => {
    const recover = vi.fn().mockRejectedValue(new Error("offline"));
    const conflict = getInventoryConflictDetails({ status: 409, code: "conflict" })!;
    render(<InventoryConflictPanel conflict={conflict} onRecover={recover} />);

    fireEvent.click(screen.getByRole("button", { name: "刷新最新状态" }));
    await waitFor(() =>
      expect(
        screen.getByText("刷新失败，当前内容没有自动提交；请稍后再次刷新。"),
      ).toBeInTheDocument(),
    );
    expect(document.querySelector('[data-ui="inventory-conflict-panel"]')).toBeInTheDocument();
  });
});
