import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardDesktopQuickStart, DashboardMobileQuickStart } from "./dashboard-quick-start";

const push = vi.fn();
type ScannerSheetProps = {
  open: boolean;
  scope: string;
  onOpenChange?: (open: boolean) => void;
  onOutsideDismiss?: () => void;
  onCloseAutoFocus?: (event: Event) => void;
};
const scannerSheetState = vi.hoisted(() => ({
  props: null as ScannerSheetProps | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/features/capture", () => ({
  ScanSearchSheet: (props: ScannerSheetProps) => {
    scannerSheetState.props = props;
    return props.open ? <div role="dialog">{props.scope} scanner</div> : null;
  },
}));

afterEach(() => {
  cleanup();
  push.mockReset();
  scannerSheetState.props = null;
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

  it("opens the existing order scanner from the mobile quick actions", () => {
    render(<DashboardMobileQuickStart />);

    fireEvent.click(screen.getByRole("button", { name: "扫码查单，扫描工单二维码或输入订单信息" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("orders scanner");
    expect(screen.getByRole("link", { name: "快速接单，客户维修 · 新建工单" })).toBeVisible();
    expect(screen.getByRole("link", { name: "快速回收报价，iPhone 旧机估价" })).toBeVisible();
  });

  it("restores the exact scanner trigger on keyboard close but not outside dismiss", () => {
    render(<DashboardMobileQuickStart />);
    const trigger = screen.getByRole("button", { name: "扫码查单，扫描工单二维码或输入订单信息" });

    fireEvent.click(trigger);
    expect(scannerSheetState.props).not.toBeNull();
    trigger.focus();
    const closeEvent = new Event("close", { cancelable: true });
    scannerSheetState.props?.onCloseAutoFocus?.(closeEvent);

    expect(closeEvent.defaultPrevented).toBe(true);
    expect(trigger).toHaveFocus();

    scannerSheetState.props?.onOutsideDismiss?.();
    const outsideCloseEvent = new Event("close", { cancelable: true });
    scannerSheetState.props?.onCloseAutoFocus?.(outsideCloseEvent);

    expect(outsideCloseEvent.defaultPrevented).toBe(false);
  });
});
