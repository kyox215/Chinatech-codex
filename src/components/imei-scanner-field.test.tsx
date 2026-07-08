import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ImeiScannerField } from "./imei-scanner-field";

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

const zxingMocks = vi.hoisted(() => ({
  decodeFromConstraints: vi.fn(),
  decodeFromImageElement: vi.fn(),
  stop: vi.fn(),
}));

const mediaMocks = vi.hoisted(() => ({
  play: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMocks,
}));

vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: vi.fn(function BrowserMultiFormatReaderMock() {
    return {
      decodeFromConstraints: zxingMocks.decodeFromConstraints,
      decodeFromImageElement: zxingMocks.decodeFromImageElement,
    };
  }),
}));

beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => undefined;
  }
});

beforeEach(() => {
  toastMocks.error.mockReset();
  toastMocks.success.mockReset();
  toastMocks.warning.mockReset();
  zxingMocks.decodeFromConstraints.mockReset();
  zxingMocks.decodeFromImageElement.mockReset();
  zxingMocks.stop.mockReset();
  mediaMocks.play.mockReset();
  mediaMocks.play.mockResolvedValue(undefined);
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: mediaMocks.play,
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(),
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ImeiScannerField", () => {
  it("keeps camera unsupported errors inline and allows manual fallback", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });

    render(<ImeiScannerField value="" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));

    expect(
      await screen.findByText("当前浏览器不支持摄像头扫码。请使用照片上传或手动输入。"),
    ).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("无法识别时可手动输入"), " 49 015420 323751 8 ");
    await user.click(screen.getByRole("button", { name: "填入手动编号" }));

    expect(onChange).toHaveBeenLastCalledWith("490154203237518");
  });

  it.each([
    [
      "NotAllowedError",
      "摄像头权限被拒绝。请在浏览器设置允许相机后重试，或改用照片上传 / 手动输入。",
    ],
    ["NotFoundError", "没有找到可用摄像头。请改用照片上传或手动输入。"],
    ["NotReadableError", "摄像头正被其他应用占用。关闭占用后重试，或改用照片上传 / 手动输入。"],
    ["OverconstrainedError", "当前设备不支持请求的摄像头模式。请重试或改用照片上传。"],
  ])("shows a recoverable camera error for %s", async (errorName, message) => {
    const user = userEvent.setup();
    zxingMocks.decodeFromConstraints.mockRejectedValue(new DOMException("", errorName));

    render(<ImeiScannerField value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("无法识别时可手动输入")).toBeInTheDocument();
  });

  it("shows a secure-context camera error when the browser rejects camera access with TypeError", async () => {
    const user = userEvent.setup();
    zxingMocks.decodeFromConstraints.mockRejectedValue(new TypeError("insecure context"));

    render(<ImeiScannerField value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));

    expect(
      await screen.findByText("当前页面无法使用摄像头。请确认使用 HTTPS 或 localhost。"),
    ).toBeInTheDocument();
  });

  it("falls back to the default camera when rear-camera constraints are unsupported", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    zxingMocks.decodeFromConstraints
      .mockRejectedValueOnce(new DOMException("", "OverconstrainedError"))
      .mockImplementationOnce(async (_constraints, _video, callback) => {
        callback({
          getText: () => "356938035643809",
        });
        return { stop: zxingMocks.stop };
      });

    render(<ImeiScannerField value="" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));

    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(2));
    expect(zxingMocks.decodeFromConstraints.mock.calls[0]?.[0]).toEqual({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
    expect(zxingMocks.decodeFromConstraints.mock.calls[1]?.[0]).toEqual({
      audio: false,
      video: true,
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("已识别 1 个编号，请确认后再填入。");
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "使用选择的编号" }));

    expect(onChange).toHaveBeenLastCalledWith("356938035643809");
    expect(toastMocks.success).toHaveBeenCalledWith("已录入 IMEI / 序列号");
  });

  it("does not restart the camera when the parent rerenders with a new change handler", async () => {
    const user = userEvent.setup();
    zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: zxingMocks.stop });

    function RerenderingParent({ revision }: { revision: number }) {
      const [value, setValue] = useState("");

      return (
        <div data-revision={revision}>
          <ImeiScannerField
            value={value}
            onChange={(nextValue) => {
              setValue(nextValue);
            }}
          />
        </div>
      );
    }

    const { rerender } = render(<RerenderingParent revision={0} />);

    await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));
    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("摄像头预览")).toHaveAttribute("autoplay");
    expect(mediaMocks.play).toHaveBeenCalled();

    rerender(<RerenderingParent revision={1} />);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1);
    expect(zxingMocks.stop).not.toHaveBeenCalled();
  });

  it("shows multiple camera candidates before committing a value", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onChange = vi.fn();
    zxingMocks.decodeFromConstraints.mockImplementation(async (_constraints, _video, callback) => {
      callback({
        getText: () => "IMEI1: 490154203237518 IMEI2: 356938035643809",
      });
      return { stop: zxingMocks.stop };
    });

    render(<ImeiScannerField value="" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "已识别 2 个候选，请选择要填入的编号。",
    );
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /356938035643809/ }));
    await user.click(screen.getByRole("button", { name: "使用选择的编号" }));

    expect(onChange).toHaveBeenLastCalledWith("356938035643809");
    expect(toastMocks.success).toHaveBeenCalledWith("已录入 IMEI / 序列号");
  });

  it("captures the current camera frame and shows all detected barcode candidates", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const imageDecodeDescriptor = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "decode",
    );
    const canvasGetContextDescriptor = Object.getOwnPropertyDescriptor(
      HTMLCanvasElement.prototype,
      "getContext",
    );
    const canvasToDataUrlDescriptor = Object.getOwnPropertyDescriptor(
      HTMLCanvasElement.prototype,
      "toDataURL",
    );
    const barcodeDetectorDescriptor = Object.getOwnPropertyDescriptor(window, "BarcodeDetector");

    zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: zxingMocks.stop });
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => ({ drawImage: vi.fn() })),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      value: vi.fn(() => "data:image/png;base64,iVBORw0KGgo="),
    });
    Object.defineProperty(window, "BarcodeDetector", {
      configurable: true,
      value: class BarcodeDetectorMock {
        async detect() {
          return [
            { rawValue: "IMEI1: 490154203237518" },
            { rawValue: "IMEI2: 356938035643809" },
            { rawValue: "SN:AUNWE02SB05002790" },
          ];
        }
      },
    });

    try {
      render(<ImeiScannerField value="" onChange={onChange} />);

      await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));
      await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1));

      const video = screen.getByLabelText("摄像头预览") as HTMLVideoElement;
      Object.defineProperty(video, "videoWidth", { configurable: true, value: 640 });
      Object.defineProperty(video, "videoHeight", { configurable: true, value: 480 });

      const captureFrameButton = await screen.findByRole("button", { name: "拍照识别" });
      await waitFor(() => expect(captureFrameButton).toBeEnabled());
      await user.click(captureFrameButton);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "已识别 3 个候选，请选择要填入的编号。",
      );
      expect(screen.getByRole("button", { name: /490154203237518/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /356938035643809/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /AUNWE02SB05002790/ })).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: /356938035643809/ }));
      await user.click(screen.getByRole("button", { name: "使用选择的编号" }));

      expect(onChange).toHaveBeenLastCalledWith("356938035643809");
    } finally {
      if (imageDecodeDescriptor) {
        Object.defineProperty(HTMLImageElement.prototype, "decode", imageDecodeDescriptor);
      } else {
        delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode;
      }
      if (canvasGetContextDescriptor) {
        Object.defineProperty(
          HTMLCanvasElement.prototype,
          "getContext",
          canvasGetContextDescriptor,
        );
      }
      if (canvasToDataUrlDescriptor) {
        Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", canvasToDataUrlDescriptor);
      }
      if (barcodeDetectorDescriptor) {
        Object.defineProperty(window, "BarcodeDetector", barcodeDetectorDescriptor);
      } else {
        delete (window as Partial<Window & { BarcodeDetector?: unknown }>).BarcodeDetector;
      }
    }
  });

  it("rejects unsupported uploaded image types without closing the dialog", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onChange = vi.fn();
    zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: zxingMocks.stop });

    render(<ImeiScannerField value="" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));
    await user.click(await screen.findByRole("button", { name: "上传图片" }));

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).toBeTruthy();
    await user.upload(fileInput!, new File(["not image"], "imei.txt", { type: "text/plain" }));

    expect(
      await screen.findByText("仅支持 JPG、PNG、WebP、HEIC 或 HEIF 图片。"),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("无法识别时可手动输入")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("accepts iPhone HEIC gallery files when the browser can decode them", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onChange = vi.fn();
    const imageDecodeDescriptor = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "decode",
    );
    const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

    zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: zxingMocks.stop });
    zxingMocks.decodeFromImageElement.mockResolvedValue({
      getText: () => "IMEI: 490154203237518",
    });
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:imei-heic-photo"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    try {
      render(<ImeiScannerField value="" onChange={onChange} />);

      await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));
      await user.click(await screen.findByRole("button", { name: "上传图片" }));

      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
      expect(fileInput).toBeTruthy();
      await user.upload(fileInput!, new File(["image"], "imei-label.heic", { type: "" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "已识别 1 个编号，请确认后再填入。",
      );
      expect(onChange).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "使用选择的编号" }));

      expect(onChange).toHaveBeenLastCalledWith("490154203237518");
      expect(toastMocks.error).not.toHaveBeenCalledWith(
        expect.stringContaining("仅支持 JPG、PNG、WebP、HEIC 或 HEIF 图片。"),
      );
    } finally {
      if (imageDecodeDescriptor) {
        Object.defineProperty(HTMLImageElement.prototype, "decode", imageDecodeDescriptor);
      } else {
        delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode;
      }
      if (createObjectUrlDescriptor) {
        Object.defineProperty(URL, "createObjectURL", createObjectUrlDescriptor);
      }
      if (revokeObjectUrlDescriptor) {
        Object.defineProperty(URL, "revokeObjectURL", revokeObjectUrlDescriptor);
      }
    }
  });

  it("keeps uploaded image barcode candidates selectable after processing finishes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const imageDecodeDescriptor = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "decode",
    );
    const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

    zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: zxingMocks.stop });
    zxingMocks.decodeFromImageElement.mockResolvedValue({
      getText: () => "IMEI1: 490154203237518 IMEI2: 356938035643809",
    });
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:imei-photo"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    try {
      render(<ImeiScannerField value="" onChange={onChange} />);

      await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));
      await user.click(await screen.findByRole("button", { name: "上传图片" }));

      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
      expect(fileInput).toBeTruthy();
      await user.upload(fileInput!, new File(["image"], "imei.webp", { type: "image/webp" }));

      await waitFor(
        () =>
          expect(screen.getByRole("alert")).toHaveTextContent(
            "已识别 2 个候选，请选择要填入的编号。",
          ),
        { timeout: 4000 },
      );
      await waitFor(() => expect(screen.queryByText("正在识别图片...")).not.toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: /356938035643809/ }));
      await user.click(screen.getByRole("button", { name: "使用选择的编号" }));

      expect(onChange).toHaveBeenLastCalledWith("356938035643809");
    } finally {
      if (imageDecodeDescriptor) {
        Object.defineProperty(HTMLImageElement.prototype, "decode", imageDecodeDescriptor);
      } else {
        delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode;
      }
      if (createObjectUrlDescriptor) {
        Object.defineProperty(URL, "createObjectURL", createObjectUrlDescriptor);
      }
      if (revokeObjectUrlDescriptor) {
        Object.defineProperty(URL, "revokeObjectURL", revokeObjectUrlDescriptor);
      }
    }
  });

  it("falls back to local OCR for uploaded numeric photos when barcode decoding fails", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const imageDecodeDescriptor = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "decode",
    );
    const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    const textDetectorDescriptor = Object.getOwnPropertyDescriptor(window, "TextDetector");

    zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: zxingMocks.stop });
    zxingMocks.decodeFromImageElement.mockRejectedValue(new Error("decoder failed internally"));
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:imei-photo"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "TextDetector", {
      configurable: true,
      value: class TextDetectorMock {
        async detect() {
          return [{ rawValue: "490154203237518" }, { rawValue: "356938035643809" }];
        }
      },
    });

    try {
      render(<ImeiScannerField value="" onChange={onChange} />);

      await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));
      await user.click(await screen.findByRole("button", { name: "上传图片" }));

      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
      expect(fileInput).toBeTruthy();
      await user.upload(fileInput!, new File(["image"], "imei.png", { type: "image/png" }));

      await waitFor(
        () =>
          expect(screen.getByRole("alert")).toHaveTextContent(
            "已识别 2 个候选，请选择要填入的编号。",
          ),
        { timeout: 4000 },
      );
      expect(screen.getByRole("button", { name: /490154203237518/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /356938035643809/ })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /356938035643809/ }));
      await user.click(screen.getByRole("button", { name: "使用选择的编号" }));

      expect(onChange).toHaveBeenLastCalledWith("356938035643809");
      expect(toastMocks.error).not.toHaveBeenCalledWith(
        expect.stringContaining("decoder failed internally"),
      );
    } finally {
      if (imageDecodeDescriptor) {
        Object.defineProperty(HTMLImageElement.prototype, "decode", imageDecodeDescriptor);
      } else {
        delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode;
      }
      if (createObjectUrlDescriptor) {
        Object.defineProperty(URL, "createObjectURL", createObjectUrlDescriptor);
      }
      if (revokeObjectUrlDescriptor) {
        Object.defineProperty(URL, "revokeObjectURL", revokeObjectUrlDescriptor);
      }
      if (textDetectorDescriptor) {
        Object.defineProperty(window, "TextDetector", textDetectorDescriptor);
      } else {
        delete (window as Partial<Window & { TextDetector?: unknown }>).TextDetector;
      }
    }
  });

  it("falls back to local OCR when uploaded image barcode decoding times out", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const imageDecodeDescriptor = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "decode",
    );
    const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    const textDetectorDescriptor = Object.getOwnPropertyDescriptor(window, "TextDetector");

    zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: zxingMocks.stop });
    zxingMocks.decodeFromImageElement.mockImplementation(() => new Promise(() => undefined));
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:imei-photo-timeout"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "TextDetector", {
      configurable: true,
      value: class TextDetectorMock {
        async detect() {
          return [{ rawValue: "490154203237518" }, { rawValue: "356938035643809" }];
        }
      },
    });

    try {
      render(<ImeiScannerField value="" onChange={onChange} />);

      await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));
      await user.click(await screen.findByRole("button", { name: "上传图片" }));

      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
      expect(fileInput).toBeTruthy();
      await user.upload(fileInput!, new File(["image"], "imei.png", { type: "image/png" }));

      await waitFor(
        () =>
          expect(screen.getByRole("alert")).toHaveTextContent(
            "已识别 2 个候选，请选择要填入的编号。",
          ),
        { timeout: 4000 },
      );
      expect(screen.getByRole("button", { name: /490154203237518/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /356938035643809/ })).toBeInTheDocument();
      expect(toastMocks.error).not.toHaveBeenCalledWith(expect.stringContaining("超时"));
    } finally {
      if (imageDecodeDescriptor) {
        Object.defineProperty(HTMLImageElement.prototype, "decode", imageDecodeDescriptor);
      } else {
        delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode;
      }
      if (createObjectUrlDescriptor) {
        Object.defineProperty(URL, "createObjectURL", createObjectUrlDescriptor);
      }
      if (revokeObjectUrlDescriptor) {
        Object.defineProperty(URL, "revokeObjectURL", revokeObjectUrlDescriptor);
      }
      if (textDetectorDescriptor) {
        Object.defineProperty(window, "TextDetector", textDetectorDescriptor);
      } else {
        delete (window as Partial<Window & { TextDetector?: unknown }>).TextDetector;
      }
    }
  }, 7000);

  it("stops delayed scanner controls if the dialog closes before camera startup finishes", async () => {
    const user = userEvent.setup();
    let resolveControls: (controls: { stop: () => void }) => void = () => undefined;
    zxingMocks.decodeFromConstraints.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveControls = resolve;
        }),
    );

    render(<ImeiScannerField value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));
    await screen.findByText("录入 IMEI / 序列号");
    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalled());

    await user.keyboard("{Escape}");
    resolveControls({ stop: zxingMocks.stop });

    await waitFor(() => expect(zxingMocks.stop).toHaveBeenCalled());
  });

  it("stops scanner controls when the capture dialog closes", async () => {
    const user = userEvent.setup();
    zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: zxingMocks.stop });

    render(<ImeiScannerField value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));
    await screen.findByText("录入 IMEI / 序列号");
    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalled());

    await user.keyboard("{Escape}");

    await waitFor(() => expect(zxingMocks.stop).toHaveBeenCalled());
  });
});
