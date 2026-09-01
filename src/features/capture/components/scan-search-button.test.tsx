import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CapturePayload } from "@/features/capture/model/barcode-parser";
import { ScanSearchButton, ScanSearchSheet } from "./scan-search-button";

const token = `v2.1.${"P".repeat(22)}.1.${"S".repeat(43)}`;
const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  runGuardedTransition: vi.fn(({ run }: { run: () => void }) => {
    run();
    return { status: "executed" as const };
  }),
}));
const scannerState = vi.hoisted(() => ({
  calls: 0,
  props: null as {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onOutsideDismiss?: () => void;
    onCloseAutoFocus?: (event: Event) => void;
  } | null,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: navigationMocks.push }) }));
vi.mock("@/components/navigation-guard-provider", () => ({
  useNavigationGuard: () => ({ runGuardedTransition: navigationMocks.runGuardedTransition }),
}));
vi.mock("@/features/capture/components/barcode-scanner-sheet", () => ({
  BarcodeScannerSheet: (props: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    renderActions?: (
      payload: CapturePayload,
      helpers: { close: () => void; rescan: () => void },
    ) => React.ReactNode;
  }) => {
    scannerState.calls += 1;
    scannerState.props = props;
    return (
      <div>
        {props.renderActions?.(
          {
            kind: "customer_status_link",
            raw: "",
            value: "",
            label: "维修工单二维码",
            targetHref: `/r#${token}`,
            sensitive: true,
          },
          { close: vi.fn(), rescan: vi.fn() },
        )}
      </div>
    );
  },
}));

describe("ScanSearchSheet customer status routing", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    scannerState.calls = 0;
    scannerState.props = null;
  });

  it("routes only through /r and never invokes ordinary order search", async () => {
    const onSearch = vi.fn();
    const navigateDocument = vi.fn();
    render(
      <ScanSearchSheet
        open
        onOpenChange={vi.fn()}
        scope="orders"
        onSearch={onSearch}
        navigateDocument={navigateDocument}
      />,
    );

    expect(document.body.textContent).not.toContain(token);
    fireEvent.click(await screen.findByRole("button", { name: "查看此订单" }));

    expect(navigateDocument).toHaveBeenCalledWith(`/r#${token}`);
    expect(navigationMocks.push).not.toHaveBeenCalled();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("does not mount the scanner before the trigger and keeps it mounted across close", async () => {
    const { rerender } = render(<ScanSearchButton scope="orders" />);
    expect(scannerState.calls).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "订单扫码查询" }));
    await waitFor(() => expect(scannerState.calls).toBeGreaterThan(0));
    expect(scannerState.props?.open).toBe(true);

    scannerState.props?.onOpenChange?.(false);
    rerender(<ScanSearchButton scope="orders" />);
    await waitFor(() => expect(scannerState.props?.open).toBe(false));
    expect(scannerState.calls).toBeGreaterThan(0);
  });

  it("coordinates Radix close auto-focus with the trigger while preserving outside focus", async () => {
    render(
      <>
        <button type="button" data-testid="outside-target">
          Outside
        </button>
        <ScanSearchButton scope="orders" />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "订单扫码查询" });
    fireEvent.click(trigger);
    await waitFor(() => expect(scannerState.props).not.toBeNull());
    const triggerFocus = vi.spyOn(trigger, "focus");

    const closeEvent = new Event("closeAutoFocus", { cancelable: true });
    scannerState.props?.onCloseAutoFocus?.(closeEvent);
    expect(closeEvent.defaultPrevented).toBe(true);
    expect(triggerFocus).toHaveBeenLastCalledWith({ preventScroll: true });

    screen.getByTestId("outside-target").focus();
    scannerState.props?.onOutsideDismiss?.();
    const outsideCloseEvent = new Event("closeAutoFocus", { cancelable: true });
    scannerState.props?.onCloseAutoFocus?.(outsideCloseEvent);
    expect(outsideCloseEvent.defaultPrevented).toBe(false);
  });

  it("prefers a controlled return-focus target over the ambient opener", async () => {
    const returnFocusRef = createRef<HTMLButtonElement>();
    const { rerender } = render(
      <>
        <button ref={returnFocusRef} type="button" data-testid="controlled-target">
          Controlled
        </button>
        <button type="button" data-testid="ambient-target">
          Ambient
        </button>
      </>,
    );
    const controlledTarget = screen.getByTestId("controlled-target");
    const ambientTarget = screen.getByTestId("ambient-target");
    ambientTarget.focus();
    const controlledFocus = vi.spyOn(controlledTarget, "focus");
    const ambientFocus = vi.spyOn(ambientTarget, "focus");

    rerender(
      <>
        <button ref={returnFocusRef} type="button" data-testid="controlled-target">
          Controlled
        </button>
        <button type="button" data-testid="ambient-target">
          Ambient
        </button>
        <ScanSearchSheet
          open
          onOpenChange={vi.fn()}
          scope="global"
          returnFocusRef={returnFocusRef}
        />
      </>,
    );
    await waitFor(() => expect(scannerState.props).not.toBeNull());

    const closeEvent = new Event("closeAutoFocus", { cancelable: true });
    scannerState.props?.onCloseAutoFocus?.(closeEvent);
    expect(closeEvent.defaultPrevented).toBe(true);
    expect(controlledFocus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(ambientFocus).not.toHaveBeenCalled();
  });

  it("falls back to the ambient opener without a controlled return-focus target", async () => {
    const { rerender } = render(
      <button type="button" data-testid="ambient-target">
        Ambient
      </button>,
    );
    const ambientTarget = screen.getByTestId("ambient-target");
    ambientTarget.focus();
    const ambientFocus = vi.spyOn(ambientTarget, "focus");

    rerender(
      <>
        <button type="button" data-testid="ambient-target">
          Ambient
        </button>
        <ScanSearchSheet open onOpenChange={vi.fn()} scope="global" />
      </>,
    );
    await waitFor(() => expect(scannerState.props).not.toBeNull());

    const closeEvent = new Event("closeAutoFocus", { cancelable: true });
    scannerState.props?.onCloseAutoFocus?.(closeEvent);
    expect(closeEvent.defaultPrevented).toBe(true);
    expect(ambientFocus).toHaveBeenLastCalledWith({ preventScroll: true });
  });

  it("does not force controlled or ambient focus after outside dismissal", async () => {
    const returnFocusRef = createRef<HTMLButtonElement>();
    const { rerender } = render(
      <>
        <button ref={returnFocusRef} type="button" data-testid="controlled-target">
          Controlled
        </button>
        <button type="button" data-testid="ambient-target">
          Ambient
        </button>
        <button type="button" data-testid="outside-target">
          Outside
        </button>
      </>,
    );
    const controlledTarget = screen.getByTestId("controlled-target");
    const ambientTarget = screen.getByTestId("ambient-target");
    const outsideTarget = screen.getByTestId("outside-target");
    ambientTarget.focus();
    const controlledFocus = vi.spyOn(controlledTarget, "focus");
    const ambientFocus = vi.spyOn(ambientTarget, "focus");

    rerender(
      <>
        <button ref={returnFocusRef} type="button" data-testid="controlled-target">
          Controlled
        </button>
        <button type="button" data-testid="ambient-target">
          Ambient
        </button>
        <button type="button" data-testid="outside-target">
          Outside
        </button>
        <ScanSearchSheet
          open
          onOpenChange={vi.fn()}
          scope="global"
          returnFocusRef={returnFocusRef}
        />
      </>,
    );
    await waitFor(() => expect(scannerState.props).not.toBeNull());

    outsideTarget.focus();
    scannerState.props?.onOutsideDismiss?.();
    const closeEvent = new Event("closeAutoFocus", { cancelable: true });
    scannerState.props?.onCloseAutoFocus?.(closeEvent);
    expect(closeEvent.defaultPrevented).toBe(false);
    expect(controlledFocus).not.toHaveBeenCalled();
    expect(ambientFocus).not.toHaveBeenCalled();
  });
});
