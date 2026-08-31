import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CapturePayload } from "@/features/capture/model/barcode-parser";
import { OrderQrScannerButton, OrderQrScannerSheet } from "./order-qr-scanner";
import { OrdersErrorState } from "./order-list-states";

const scannerProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/navigation-guard-provider", () => ({
  useNavigationGuard: () => ({ runGuardedTransition: vi.fn() }),
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

  it("exposes the safe list error state to assistive technology", () => {
    render(<OrdersErrorState message="Orders could not be loaded." onRetry={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveAttribute("data-ui", "order-list-error-state");
  });
});
