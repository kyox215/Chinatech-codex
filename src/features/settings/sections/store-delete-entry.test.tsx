import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StoreDeleteEntry } from "./store-delete-entry";

const store = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "ChinaTech",
  slug: "chinatech",
  role: "owner" as const,
  status: "active" as const,
};

describe("StoreDeleteEntry", () => {
  it("exposes an owner-only safe-check entry without making the button a direct purge", () => {
    const onStart = vi.fn();
    render(<StoreDeleteEntry store={store} canStart isPreflighting={false} onStart={onStart} />);

    expect(screen.getByRole("heading", { name: "关闭与删除店铺" })).toBeVisible();
    expect(screen.getByText(/先安全关闭（可恢复）/)).toBeVisible();
    expect(screen.getByRole("button", { name: "开始安全检查" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "查看已关闭与删除" })).toHaveAttribute(
      "href",
      "/settings/closed-stores",
    );
    fireEvent.click(screen.getByRole("button", { name: "开始安全检查" }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("keeps the entry visible but locked when lifecycle mutations are unavailable", () => {
    render(
      <StoreDeleteEntry store={store} canStart={false} isPreflighting={false} onStart={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "关闭功能暂未启用" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("当前不会修改店铺状态");
  });
});
