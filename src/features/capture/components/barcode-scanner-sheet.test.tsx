import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BarcodeScannerSheet } from "@/features/capture/components/barcode-scanner-sheet";

type ScannerControlsMock = { stop: ReturnType<typeof vi.fn> };

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

const navigationMocks = vi.hoisted(() => ({
  pathname: "/orders",
}));

const zxingMocks = vi.hoisted(() => ({
  decodeFromVideoDevice: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMocks,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMocks.pathname,
}));

vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: vi.fn(function BrowserMultiFormatReaderMock() {
    return {
      decodeFromVideoDevice: zxingMocks.decodeFromVideoDevice,
    };
  }),
}));

describe("BarcodeScannerSheet", () => {
  beforeEach(() => {
    toastMocks.error.mockReset();
    toastMocks.success.mockReset();
    zxingMocks.decodeFromVideoDevice.mockReset();
    navigationMocks.pathname = "/orders";
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(),
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("stops late scanner controls when the sheet closes before startup resolves", async () => {
    const controls: ScannerControlsMock = { stop: vi.fn() };
    let resolveControls: (controls: ScannerControlsMock) => void = () => undefined;
    zxingMocks.decodeFromVideoDevice.mockReturnValue(
      new Promise((resolve) => {
        resolveControls = resolve;
      }),
    );

    const view = render(<BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={vi.fn()} />);
    await waitFor(() => expect(zxingMocks.decodeFromVideoDevice).toHaveBeenCalledTimes(1));

    view.rerender(<BarcodeScannerSheet open={false} onOpenChange={vi.fn()} onDetected={vi.fn()} />);
    resolveControls(controls);

    await waitFor(() => expect(controls.stop).toHaveBeenCalledTimes(1));
  });

  it("accepts only the first scanner result for one session", async () => {
    const controls = { stop: vi.fn() };
    let onResult: ((result: { getText: () => string } | null) => void) | undefined;
    zxingMocks.decodeFromVideoDevice.mockImplementation((_device, _video, callback) => {
      onResult = callback;
      return Promise.resolve(controls);
    });
    const onDetected = vi.fn();

    render(<BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={onDetected} />);
    await waitFor(() => expect(zxingMocks.decodeFromVideoDevice).toHaveBeenCalledTimes(1));

    onResult?.({ getText: () => "490154203237518" });
    onResult?.({ getText: () => "C39ZQ123N70M" });

    await waitFor(() => expect(onDetected).toHaveBeenCalledTimes(1));
    expect(onDetected).toHaveBeenCalledWith(
      expect.objectContaining({
        value: "490154203237518",
      }),
    );
  });

  it("stops video tracks when the user pauses scanning", async () => {
    const controls = { stop: vi.fn() };
    const track = { stop: vi.fn() };
    zxingMocks.decodeFromVideoDevice.mockResolvedValue(controls);

    render(<BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={vi.fn()} />);
    await waitFor(() => expect(zxingMocks.decodeFromVideoDevice).toHaveBeenCalledTimes(1));

    const video = document.querySelector("video") as HTMLVideoElement;
    expect(video).toBeTruthy();
    video.srcObject = {
      getTracks: () => [track],
    } as unknown as MediaStream;

    fireEvent.click(screen.getByRole("button", { name: "停止" }));

    expect(controls.stop).toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
  });

  it("masks customer status bearer links and removes the copy action", async () => {
    const controls = { stop: vi.fn() };
    let onResult: ((result: { getText: () => string } | null) => void) | undefined;
    zxingMocks.decodeFromVideoDevice.mockImplementation((_device, _video, callback) => {
      onResult = callback;
      return Promise.resolve(controls);
    });
    const token = `v2.1.${"P".repeat(22)}.1.${"S".repeat(43)}`;

    render(<BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={vi.fn()} />);
    await waitFor(() => expect(zxingMocks.decodeFromVideoDevice).toHaveBeenCalledTimes(1));
    onResult?.({ getText: () => `/r#${token}` });

    expect(await screen.findByText("敏感链接已隐藏")).toBeVisible();
    expect(screen.queryByText(token)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "复制" })).not.toBeInTheDocument();
  });
});
