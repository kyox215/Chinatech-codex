import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BarcodeScannerSheet } from "@/features/capture/components/barcode-scanner-sheet";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";

type ScannerControlsMock = { stop: ReturnType<typeof vi.fn> };

const toastMocks = vi.hoisted(() => ({
  dismiss: vi.fn(),
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

function LocaleControl() {
  const { setLocale } = useLocale();
  return (
    <button type="button" onClick={() => setLocale("it-IT")}>
      switch locale
    </button>
  );
}

describe("BarcodeScannerSheet", () => {
  beforeEach(() => {
    toastMocks.dismiss.mockReset();
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

  it("deduplicates StrictMode camera start errors and keeps raw errors out of the UI", async () => {
    const rawError = new DOMException("camera unavailable", "NotAllowedError");
    zxingMocks.decodeFromConstraints.mockRejectedValue(rawError);

    render(
      <StrictMode>
        <BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={vi.fn()} />
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(toastMocks.error).toHaveBeenCalledTimes(1);
    expect(toastMocks.error).toHaveBeenCalledWith(expect.any(String), {
      id: "repairdesk-scanner-camera-error",
    });
    expect(screen.getByRole("alert")).toHaveTextContent("无法打开摄像头");
    expect(screen.queryByText("camera unavailable")).not.toBeInTheDocument();
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

  it("limits the shared camera shell to QR when requested by the order component", async () => {
    zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: vi.fn() });

    render(
      <BarcodeScannerSheet open onOpenChange={vi.fn()} scanMode="qr-only" onDetected={vi.fn()} />,
    );

    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1));
    const hints = zxingMocks.constructor.mock.calls[0]?.[0] as Map<number, number[]>;
    expect(hints.get(100)).toEqual([barcodeFormats.QR_CODE]);
    expect(screen.getByLabelText("订单二维码摄像头预览")).toBeInTheDocument();
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
    const onDetected = vi.fn();

    render(<BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={onDetected} />);
    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText("无法扫码时，可手动输入或粘贴"), {
      target: { value: `https://www.chinatech.in/r#${token}` },
    });
    fireEvent.click(screen.getByRole("button", { name: "识别内容" }));

    await screen.findByText("凭据已保护，可通过安全入口打开工单");
    expect(onDetected).toHaveBeenCalledWith({
      kind: "customer_status_link",
      label: "客户工单二维码",
      raw: "",
      value: "",
      targetHref: `/r#${token}`,
      sensitive: true,
    });
    expect(screen.queryByText(new RegExp(token))).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "复制" })).not.toBeInTheDocument();
  });

  it("redacts parser-error customer credentials without exposing copy or open data", async () => {
    zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: vi.fn() });
    const token = "A".repeat(43);
    const onDetected = vi.fn();

    render(<BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={onDetected} />);
    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText("无法扫码时，可手动输入或粘贴"), {
      target: { value: `https://[invalid/r#${token}.trailing` },
    });
    fireEvent.click(screen.getByRole("button", { name: "识别内容" }));

    await screen.findByText("凭据已保护，可通过安全入口打开工单");
    expect(screen.getByText("无效客户工单二维码")).toBeInTheDocument();
    expect(onDetected).toHaveBeenCalledWith({
      kind: "customer_status_link",
      label: "无效客户工单二维码",
      raw: "",
      value: "",
      sensitive: true,
    });
    expect(screen.queryByText(new RegExp(token))).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "复制" })).not.toBeInTheDocument();
  });

  it("preserves manual result state and scanner session across locale changes", async () => {
    const controls = { stop: vi.fn() };
    zxingMocks.decodeFromConstraints.mockResolvedValue(controls);

    render(
      <LocaleProvider initialLocale="zh-CN">
        <LocaleControl />
        <BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={vi.fn()} />
      </LocaleProvider>,
    );
    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("手动输入扫码内容"), {
      target: { value: "inventory:sku-42" },
    });
    fireEvent.click(screen.getByRole("button", { name: "识别内容" }));
    await screen.findByText("sku-42");

    fireEvent.click(screen.getByText("switch locale", { exact: true }));

    expect(screen.getByText("sku-42")).toBeInTheDocument();
    expect(screen.getByText("Link magazzino")).toBeInTheDocument();
    expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1);
  });

  it("keeps manual input bounded and reports paste/copy success or failure safely", async () => {
    zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: vi.fn() });
    const readText = vi.fn().mockResolvedValue("inventory:sku-42");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText, writeText },
    });
    render(<BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={vi.fn()} />);
    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "粘贴扫码内容" }));
    await waitFor(() =>
      expect(screen.getByLabelText("手动输入扫码内容")).toHaveValue("inventory:sku-42"),
    );
    fireEvent.click(screen.getByRole("button", { name: "识别内容" }));
    await screen.findByText("sku-42");
    fireEvent.click(screen.getByRole("button", { name: "复制" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("sku-42"));
    writeText.mockRejectedValueOnce(new Error("clipboard unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "复制" }));
    await waitFor(() => expect(toastMocks.error).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "继续扫描" }));
    fireEvent.change(screen.getByLabelText("手动输入扫码内容"), {
      target: { value: "x".repeat(4_097) },
    });
    fireEvent.click(screen.getByRole("button", { name: "识别内容" }));
    expect(toastMocks.error).toHaveBeenCalledWith("扫码内容过长，请确认二维码或条码是否正确");
  });

  it("rejects invalid and oversized local images before recognition", async () => {
    zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: vi.fn() });
    render(<BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={vi.fn()} />);
    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const invalid = new File(["text"], "notes.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [invalid] } });
    expect(toastMocks.error).toHaveBeenCalledWith("请选择图片文件");

    const oversized = new File(["image"], "large.png", { type: "image/png" });
    Object.defineProperty(oversized, "size", { value: 12 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [oversized] } });
    expect(toastMocks.error).toHaveBeenCalledWith("图片过大，请选择 12MB 以内的图片");
  });

  it("surfaces safe decode and timeout states for local images", async () => {
    zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: vi.fn() });
    zxingMocks.decodeFromImageElement.mockRejectedValue(new Error("decoder failed"));
    render(<BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={vi.fn()} />);
    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["image"], "barcode.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("未识别到二维码"));
    expect(screen.queryByText("decoder failed")).not.toBeInTheDocument();
  });

  it("reports a safe timeout when image recognition does not settle", async () => {
    const nativeSetTimeout = globalThis.setTimeout;
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((handler: TimerHandler, timeout?: number) =>
        nativeSetTimeout(handler, timeout === 8_000 ? 0 : timeout)) as typeof setTimeout);
    try {
      zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: vi.fn() });
      zxingMocks.decodeFromImageElement.mockReturnValue(new Promise(() => undefined));
      render(<BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={vi.fn()} />);
      await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1));

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, {
        target: { files: [new File(["image"], "slow.png", { type: "image/png" })] },
      });
      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("图片识别超时"));
      expect(screen.queryByText("slow.png")).not.toBeInTheDocument();
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("reports clipboard read failures without exposing the raw error", async () => {
    zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: vi.fn() });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText: vi.fn().mockRejectedValue(new Error("clipboard secret")) },
    });
    render(<BarcodeScannerSheet open onOpenChange={vi.fn()} onDetected={vi.fn()} />);
    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "粘贴扫码内容" }));
    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith("无法读取剪贴板，请手动粘贴"),
    );
    expect(screen.queryByText("clipboard secret")).not.toBeInTheDocument();
  });
});
