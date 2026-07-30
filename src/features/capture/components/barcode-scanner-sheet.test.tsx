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
  constructor: vi.fn(),
  decodeFromConstraints: vi.fn(),
  decodeFromImageElement: vi.fn(),
}));

const barcodeFormats = vi.hoisted(() => ({
  QR_CODE: 1,
  DATA_MATRIX: 2,
  CODE_128: 3,
  CODE_39: 4,
  EAN_13: 5,
  EAN_8: 6,
}));

vi.mock("sonner", () => ({
  toast: toastMocks,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMocks.pathname,
}));

vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: vi.fn(function BrowserMultiFormatReaderMock(...args: unknown[]) {
    zxingMocks.constructor(...args);
    return {
      decodeFromConstraints: zxingMocks.decodeFromConstraints,
      decodeFromImageElement: zxingMocks.decodeFromImageElement,
    };
  }),
}));

vi.mock("@zxing/library", () => ({
  BarcodeFormat: barcodeFormats,
  DecodeHintType: { POSSIBLE_FORMATS: 100 },
}));

describe("BarcodeScannerSheet", () => {
  beforeEach(() => {
    toastMocks.error.mockReset();
    toastMocks.success.mockReset();
    zxingMocks.constructor.mockReset();
    zxingMocks.decodeFromConstraints.mockReset();
    zxingMocks.decodeFromImageElement.mockReset();
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
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:scanner-image"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
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
    zxingMocks.decodeFromConstraints.mockReturnValue(
      new Promise((resolve) => {
        resolveControls = resolve;
      }),
    );

    const view = render(<BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={vi.fn()} />);
    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1));

    view.rerender(<BarcodeScannerSheet open={false} onOpenChange={vi.fn()} onDetected={vi.fn()} />);
    resolveControls(controls);

    await waitFor(() => expect(controls.stop).toHaveBeenCalledTimes(1));
  });

  it("accepts only the first scanner result for one session", async () => {
    const controls = { stop: vi.fn() };
    let onResult: ((result: { getText: () => string } | null) => void) | undefined;
    zxingMocks.decodeFromConstraints.mockImplementation((_constraints, _video, callback) => {
      onResult = callback;
      return Promise.resolve(controls);
    });
    const onDetected = vi.fn();

    render(<BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={onDetected} />);
    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1));

    onResult?.({ getText: () => "490154203237518" });
    onResult?.({ getText: () => "C39ZQ123N70M" });

    await waitFor(() => expect(onDetected).toHaveBeenCalledTimes(1));
    expect(onDetected).toHaveBeenCalledWith(
      expect.objectContaining({
        value: "490154203237518",
      }),
    );
    expect(navigator.vibrate).toHaveBeenCalledTimes(1);
  });

  it("stops video tracks when the user pauses scanning", async () => {
    const controls = { stop: vi.fn() };
    const track = { stop: vi.fn() };
    zxingMocks.decodeFromConstraints.mockResolvedValue(controls);

    render(<BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={vi.fn()} />);
    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1));

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

  it("requests the rear camera with format hints and falls back through safe constraints", async () => {
    const controls = { stop: vi.fn() };
    const overconstrained = new Error("unsupported camera constraint");
    Object.defineProperty(overconstrained, "name", { value: "OverconstrainedError" });
    zxingMocks.decodeFromConstraints
      .mockRejectedValueOnce(overconstrained)
      .mockRejectedValueOnce(overconstrained)
      .mockResolvedValueOnce(controls);

    render(<BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={vi.fn()} />);

    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(3));
    expect(zxingMocks.decodeFromConstraints.mock.calls[0]?.[0]).toMatchObject({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
    expect(zxingMocks.decodeFromConstraints.mock.calls[1]?.[0]).toMatchObject({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    expect(zxingMocks.decodeFromConstraints.mock.calls[2]?.[0]).toEqual({
      audio: false,
      video: true,
    });

    const hints = zxingMocks.constructor.mock.calls[0]?.[0] as Map<number, number[]>;
    expect(hints.get(100)).toEqual([
      barcodeFormats.QR_CODE,
      barcodeFormats.DATA_MATRIX,
      barcodeFormats.CODE_128,
      barcodeFormats.CODE_39,
      barcodeFormats.EAN_13,
      barcodeFormats.EAN_8,
    ]);
    expect(screen.getByRole("status")).toHaveTextContent("正在扫描");
  });

  it("recognizes a local image and always revokes its object URL", async () => {
    zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: vi.fn() });
    zxingMocks.decodeFromImageElement.mockResolvedValue({ getText: () => "inventory:sku-42" });
    const onDetected = vi.fn();

    render(<BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={onDetected} />);
    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1));

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["image"], "barcode.png", { type: "image/png" })] },
    });

    await waitFor(() =>
      expect(onDetected).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "inventory_link", value: "sku-42" }),
      ),
    );
    expect(zxingMocks.decodeFromImageElement).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:scanner-image");
  });

  it("hides and disables copying protected customer status QR credentials", async () => {
    zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: vi.fn() });
    const token = "A".repeat(43);

    render(<BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={vi.fn()} />);
    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText("无法扫码时，可手动输入或粘贴"), {
      target: { value: `https://www.chinatech.in/r#${token}` },
    });
    fireEvent.click(screen.getByRole("button", { name: "识别内容" }));

    await screen.findByText("凭据已保护，可通过安全入口打开工单");
    expect(screen.queryByText(new RegExp(token))).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "复制" })).not.toBeInTheDocument();
  });
});
