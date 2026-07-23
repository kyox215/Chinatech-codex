import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardDesktopQuickStart, DashboardMobileQuickStart } from "./dashboard-quick-start";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

afterEach(() => {
  cleanup();
  push.mockReset();
});

describe("dashboard quick order entry", () => {
  it.each([
    ["desktop", DashboardDesktopQuickStart],
    ["mobile", DashboardMobileQuickStart],
  ] as const)("opens the shared dialog from the %s action without navigating", (_, Entry) => {
    const onCreateOrder = vi.fn();
    render(<Entry onCreateOrder={onCreateOrder} />);

    const link = screen.getByRole("link", { name: "快速接单，客户维修 · 新建工单" });
    expect(link).toHaveAttribute("href", "/orders?workspace=new-order&source=dashboard");
    fireEvent.click(link);

    expect(onCreateOrder).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps the shareable workspace URL as the modified-click fallback", () => {
    const onCreateOrder = vi.fn();
    render(<DashboardDesktopQuickStart onCreateOrder={onCreateOrder} />);

    const link = screen.getByRole("link", { name: "快速接单，客户维修 · 新建工单" });
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link, { ctrlKey: true });

    expect(onCreateOrder).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
