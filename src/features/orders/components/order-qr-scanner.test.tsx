import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CapturePayload } from "@/features/capture/model/barcode-parser";
import { OrderQrScannerSheet } from "./order-qr-scanner";

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

  it("binds the order feature to QR-only mode and its own parser", () => {
    render(<OrderQrScannerSheet open onOpenChange={vi.fn()} />);

    expect(scannerProps.current).toMatchObject({
      scanMode: "qr-only",
      title: "扫描订单二维码",
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
});
