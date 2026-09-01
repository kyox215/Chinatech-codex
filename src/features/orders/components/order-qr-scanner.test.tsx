import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CapturePayload } from "@/features/capture/model/barcode-parser";
import { OrderQrScannerButton, OrderQrScannerSheet } from "./order-qr-scanner";
import { OrdersErrorState } from "./order-list-states";
import { LocaleProvider } from "@/shared/i18n/locale-provider";

const scannerProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  runGuardedTransition: vi.fn(({ run }: { run: () => void }) => {
    run();
    return { status: "executed" as const };
  }),
}));
type RenderActions = (
  payload: CapturePayload,
  helpers: { close: () => void; rescan: () => void },
) => ReactNode;

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: navigationMocks.push }) }));
vi.mock("@/components/navigation-guard-provider", () => ({
  useNavigationGuard: () => ({ runGuardedTransition: navigationMocks.runGuardedTransition }),
}));
vi.mock("@/features/capture/components/barcode-scanner-sheet", () => ({
  BarcodeScannerSheet: (props: Record<string, unknown>) => {
    scannerProps.current = props;
    return <div data-testid="order-qr-sheet" />;
  },
}));

describe("OrderQrScannerSheet", () => {
  afterEach(() => {
    cleanup();
    scannerProps.current = null;
    vi.clearAllMocks();
  });

  it("binds the order feature to QR-only mode and its own parser", async () => {
    render(<OrderQrScannerSheet open onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(scannerProps.current).toMatchObject({
        scanMode: "qr-only",
        title: "扫描订单二维码",
      });
    });
    const parsePayload = scannerProps.current?.parsePayload as (
      rawValue: string,
      origin: string,
    ) => CapturePayload;
    expect(parsePayload("490154203237518", "https://www.chinatech.in")).toMatchObject({
      value: "",
      label: "不是有效订单二维码",
    });
  });

  it("fails closed for malformed protected credentials without exposing actions", async () => {
    const token = "A".repeat(43);
    render(<OrderQrScannerSheet open onOpenChange={vi.fn()} />);
    await waitFor(() => expect(scannerProps.current).not.toBeNull());
    const parsePayload = scannerProps.current?.parsePayload as (
      rawValue: string,
      origin: string,
    ) => CapturePayload;
    const payload = parsePayload(
      `https://[invalid/r#${token}.trailing`,
      "https://www.chinatech.in",
    );

    expect(payload).toEqual({
      kind: "customer_status_link",
      raw: "",
      value: "",
      label: "无效客户工单二维码",
      sensitive: true,
    });
    expect(payload).not.toHaveProperty("targetHref");

    const actions = (scannerProps.current?.renderActions as RenderActions)(payload, {
      close: vi.fn(),
      rescan: vi.fn(),
    });
    const { container } = render(actions);
    expect(container.querySelector("button")).toBeNull();
    expect(document.body.textContent).not.toContain(token);
    expect(navigationMocks.push).not.toHaveBeenCalled();
  });

  it("does not load before the trigger and keeps the sheet mounted after close", async () => {
    render(<OrderQrScannerButton />);
    expect(scannerProps.current).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "扫描订单二维码" }));
    await waitFor(() => expect(scannerProps.current).not.toBeNull());
    expect(scannerProps.current?.open).toBe(true);

    const onOpenChange = scannerProps.current?.onOpenChange as
      | ((open: boolean) => void)
      | undefined;
    onOpenChange?.(false);
    await waitFor(() => expect(scannerProps.current?.open).toBe(false));
    expect(scannerProps.current).not.toBeNull();
  });

  it("supports localized trigger aria and visible labels", () => {
    render(<OrderQrScannerButton showLabel ariaLabel="Scan order QR code" label="Scan QR" />);

    expect(screen.getByRole("button", { name: "Scan order QR code" })).toHaveTextContent("Scan QR");
  });

  it.each([
    ["zh-CN", "扫描订单二维码", "仅扫描订单查询二维码"],
    ["it-IT", "Scansiona il QR dell’ordine", "Scansiona solo il QR di ricerca ordine"],
    ["en", "Scan order QR code", "Scan order lookup QR codes only"],
  ] as const)("localizes the QR-only shell in %s", async (locale, title, description) => {
    render(
      <LocaleProvider initialLocale={locale}>
        <OrderQrScannerSheet open onOpenChange={vi.fn()} />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(scannerProps.current).toMatchObject({
        title,
        description: expect.stringContaining(description),
      });
    });
    expect(scannerProps.current?.scanMode).toBe("qr-only");
  });

  it("routes valid order and protected QR actions without exposing protected tokens", async () => {
    const token = "A".repeat(43);
    const navigateDocument = vi.fn();
    render(<OrderQrScannerSheet open onOpenChange={vi.fn()} navigateDocument={navigateDocument} />);
    await waitFor(() => expect(scannerProps.current).not.toBeNull());
    const renderActions = scannerProps.current?.renderActions as RenderActions;
    const helpers = { close: vi.fn(), rescan: vi.fn() };

    const validAction = renderActions(
      {
        kind: "order_link",
        raw: "order:ord_1",
        value: "ord_1",
        label: "工单编号",
        targetHref: "/orders/ord_1",
      },
      helpers,
    );
    cleanup();
    render(validAction);
    fireEvent.click(screen.getByRole("button", { name: "打开订单" }));
    expect(navigationMocks.push).toHaveBeenCalledWith("/orders/ord_1");

    cleanup();
    scannerProps.current = null;
    render(<OrderQrScannerSheet open onOpenChange={vi.fn()} navigateDocument={navigateDocument} />);
    await waitFor(() => expect(scannerProps.current).not.toBeNull());
    const protectedActions = (
      (scannerProps.current as unknown as Record<string, unknown>).renderActions as RenderActions
    )(
      {
        kind: "customer_status_link",
        raw: "",
        value: "",
        label: "客户维修状态二维码",
        targetHref: `/r#${token}`,
        sensitive: true,
      },
      helpers,
    );
    cleanup();
    render(protectedActions);
    fireEvent.click(screen.getByRole("button", { name: "打开订单" }));
    expect(navigateDocument).toHaveBeenCalledWith(`/r#${token}`);
    expect(document.body.textContent).not.toContain(token);
  });

  it("does not navigate invalid payloads and preserves outside-dismiss focus target", async () => {
    render(
      <>
        <button type="button" data-testid="outside-target">
          Outside
        </button>
        <OrderQrScannerButton />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "扫描订单二维码" });
    fireEvent.click(trigger);
    await waitFor(() => expect(scannerProps.current).not.toBeNull());
    const invalid = (scannerProps.current?.renderActions as RenderActions)(
      { kind: "text", raw: "bad", value: "", label: "不是有效订单二维码" },
      { close: vi.fn(), rescan: vi.fn() },
    );
    render(invalid);
    expect(screen.queryByRole("button", { name: "查看此订单" })).not.toBeInTheDocument();
    expect(navigationMocks.push).not.toHaveBeenCalled();

    const outside = scannerProps.current?.onOutsideDismiss as (() => void) | undefined;
    screen.getByTestId("outside-target").focus();
    outside?.();
    (scannerProps.current?.onOpenChange as ((open: boolean) => void) | undefined)?.(false);
    const outsideCloseEvent = new Event("closeAutoFocus", { cancelable: true });
    (scannerProps.current?.onCloseAutoFocus as ((event: Event) => void) | undefined)?.(
      outsideCloseEvent,
    );
    expect(outsideCloseEvent.defaultPrevented).toBe(false);
    expect(trigger).not.toHaveFocus();
  });

  it("restores exact trigger focus through close auto-focus for Escape/programmatic close", async () => {
    render(<OrderQrScannerButton />);
    const trigger = screen.getByRole("button", { name: "扫描订单二维码" });
    fireEvent.click(trigger);
    await waitFor(() => expect(scannerProps.current).not.toBeNull());
    const triggerFocus = vi.spyOn(trigger, "focus");

    const onOpenChange = scannerProps.current?.onOpenChange as
      | ((open: boolean) => void)
      | undefined;
    onOpenChange?.(false);
    const closeEvent = new Event("closeAutoFocus", { cancelable: true });
    (scannerProps.current?.onCloseAutoFocus as ((event: Event) => void) | undefined)?.(closeEvent);
    expect(closeEvent.defaultPrevented).toBe(true);
    expect(triggerFocus).toHaveBeenLastCalledWith({ preventScroll: true });
  });

  it("exposes the safe list error state to assistive technology", () => {
    render(<OrdersErrorState message="Orders could not be loaded." onRetry={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveAttribute("data-ui", "order-list-error-state");
  });
});
