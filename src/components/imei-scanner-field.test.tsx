import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ImeiScannerField } from "./imei-scanner-field";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";

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

const localOcrMocks = vi.hoisted(() => ({
  recognizeTextWithLocalOcr: vi.fn(),
}));

const imageInspectionMocks = vi.hoisted(() => ({
  inspectAiInventoryImage: vi.fn(),
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

vi.mock("@/features/capture/model/local-ocr", () => ({
  recognizeTextWithLocalOcr: localOcrMocks.recognizeTextWithLocalOcr,
}));

vi.mock("@/features/ai-assistant/model/inventory-image", () => ({
  inspectAiInventoryImage: imageInspectionMocks.inspectAiInventoryImage,
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
  localOcrMocks.recognizeTextWithLocalOcr.mockReset();
  localOcrMocks.recognizeTextWithLocalOcr.mockResolvedValue("");
  imageInspectionMocks.inspectAiInventoryImage.mockReset();
  imageInspectionMocks.inspectAiInventoryImage.mockImplementation(async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("仅支持 JPG、PNG 或 WebP 图片。");
    }
    return { mimeType: file.type, width: 100, height: 100 };
  });
  window.localStorage.clear();
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
  function StatefulScanner({
    initialValue = "490154203237518",
    onCommitSource,
  }: {
    initialValue?: string;
    onCommitSource?: (source: "manual" | "scan") => void;
  }) {
    const [value, setValue] = useState(initialValue);

    return (
      <ImeiScannerField
        value={value}
        onChange={setValue}
        identifierLabel="IMEI-DYNAMIC-设备"
        onCommitSource={onCommitSource}
      />
    );
  }

  it.each(["zh-CN", "it-IT", "en"] satisfies readonly AppLocale[])(
    "keeps heavy candidate, paste, clear, status, and toast states localized for %s",
    async (locale) => {
      const user = userEvent.setup();
      const onCommitSource = vi.fn();
      const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
      const rawCaptureSentinel = "OCR-CAMERA-RAW-SENTINEL";
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { readText: vi.fn().mockResolvedValue("IMEI: 490154203237518") },
      });
      zxingMocks.decodeFromConstraints.mockImplementation(
        async (_constraints, _video, callback) => {
          callback({
            getText: () => `${rawCaptureSentinel} IMEI1: 490154203237518 IMEI2: 356938035643809`,
          });
          return { stop: zxingMocks.stop };
        },
      );

      try {
        render(
          <LocaleProvider initialLocale={locale}>
            <StatefulScanner onCommitSource={onCommitSource} />
          </LocaleProvider>,
        );

        const input = screen.getByPlaceholderText(
          translateMessage(locale, "inventory2b4.scanner.placeholder"),
        );
        await user.click(
          screen.getByRole("button", {
            name: translateMessage(locale, "inventory2b4.scanner.clearAction", {
              identifier: "IMEI-DYNAMIC-设备",
            }),
          }),
        );
        expect(input).toHaveValue("");

        await user.click(
          screen.getByRole("button", {
            name: translateMessage(locale, "inventory2b4.scanner.pasteAction", {
              identifier: "IMEI-DYNAMIC-设备",
            }),
          }),
        );
        expect(input).toHaveValue("490154203237518");
        expect(toastMocks.success).toHaveBeenCalledWith(
          translateMessage(locale, "inventory2b4.scanner.pasted"),
        );
        expect(onCommitSource).toHaveBeenCalledWith("manual");

        await user.click(
          screen.getByRole("button", {
            name: translateMessage(locale, "inventory2b4.scanner.cameraAction", {
              identifier: "IMEI-DYNAMIC-设备",
            }),
          }),
        );
        expect(await screen.findByRole("alert")).toHaveTextContent(
          translateMessage(locale, "inventory2b4.scanner.candidatesMany", { count: 2 }),
        );
        expect(
          screen.getByText(
            translateMessage(locale, "inventory2b4.scanner.statusCandidates", { count: 2 }),
          ),
        ).toBeInTheDocument();
        expect(screen.queryByText(rawCaptureSentinel)).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /•••• 3809/ }));
        await user.click(
          screen.getByRole("button", {
            name: translateMessage(locale, "inventory2b4.scanner.useSelected"),
          }),
        );
        expect(input).toHaveValue("356938035643809");
        expect(toastMocks.success).toHaveBeenCalledWith(
          translateMessage(locale, "inventory2b4.scanner.recorded"),
        );
        expect(onCommitSource).toHaveBeenLastCalledWith("scan");
        expect(
          JSON.stringify([
            toastMocks.error.mock.calls,
            toastMocks.success.mock.calls,
            toastMocks.warning.mock.calls,
          ]),
        ).not.toContain(rawCaptureSentinel);
      } finally {
        if (clipboardDescriptor) {
          Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
        } else {
          delete (navigator as unknown as { clipboard?: Clipboard }).clipboard;
        }
      }
    },
  );

  it.each(["zh-CN", "it-IT", "en"] satisfies readonly AppLocale[])(
    "sanitizes internal camera failures for %s",
    async (locale) => {
      const user = userEvent.setup();
      const rawCameraSentinel = "CAMERA-INTERNAL-RAW-SENTINEL";
      zxingMocks.decodeFromConstraints.mockRejectedValue(new Error(rawCameraSentinel));

      render(
        <LocaleProvider initialLocale={locale}>
          <ImeiScannerField value="" onChange={vi.fn()} />
        </LocaleProvider>,
      );
      await user.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.scanner.cameraAction", {
            identifier: "IMEI",
          }),
        }),
      );

      expect(
        await screen.findByText(translateMessage(locale, "inventory2b4.scanner.cameraGeneric")),
      ).toBeInTheDocument();
      expect(document.body).not.toHaveTextContent(rawCameraSentinel);
      expect(
        JSON.stringify([
          toastMocks.error.mock.calls,
          toastMocks.success.mock.calls,
          toastMocks.warning.mock.calls,
        ]),
      ).not.toContain(rawCameraSentinel);
    },
  );

  it.each(["zh-CN", "it-IT", "en"] satisfies readonly AppLocale[])(
    "sanitizes internal image OCR failures for %s",
    async (locale) => {
      const user = userEvent.setup();
      const rawDecoderSentinel = "DECODER-INTERNAL-RAW-SENTINEL";
      const rawOcrSentinel = "OCR-INTERNAL-RAW-SENTINEL";
      const imageDecodeDescriptor = Object.getOwnPropertyDescriptor(
        HTMLImageElement.prototype,
        "decode",
      );
      const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
      const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
      const textDetectorDescriptor = Object.getOwnPropertyDescriptor(window, "TextDetector");

      zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: zxingMocks.stop });
      zxingMocks.decodeFromImageElement.mockRejectedValue(new Error(rawDecoderSentinel));
      localOcrMocks.recognizeTextWithLocalOcr.mockRejectedValue(new Error(rawOcrSentinel));
      Object.defineProperty(HTMLImageElement.prototype, "decode", {
        configurable: true,
        value: vi.fn().mockResolvedValue(undefined),
      });
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: vi.fn(() => "blob:imei-photo-safe-error"),
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: vi.fn(),
      });
      delete (window as Partial<Window & { TextDetector?: unknown }>).TextDetector;

      try {
        render(
          <LocaleProvider initialLocale={locale}>
            <ImeiScannerField value="" onChange={vi.fn()} />
          </LocaleProvider>,
        );
        await user.click(
          screen.getByRole("button", {
            name: translateMessage(locale, "inventory2b4.scanner.cameraAction", {
              identifier: "IMEI",
            }),
          }),
        );
        await user.click(
          await screen.findByRole("button", {
            name: translateMessage(locale, "inventory2b4.scanner.upload"),
          }),
        );
        const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
        expect(fileInput).not.toBeNull();
        await user.upload(fileInput!, new File(["image"], "imei.png", { type: "image/png" }));

        const safeMessage = translateMessage(locale, "inventory2b4.scanner.recognitionFailed");
        expect(await screen.findByText(safeMessage)).toBeInTheDocument();
        expect(toastMocks.error).toHaveBeenCalledWith(safeMessage);
        expect(document.body).not.toHaveTextContent(rawDecoderSentinel);
        expect(document.body).not.toHaveTextContent(rawOcrSentinel);
        expect(
          JSON.stringify([
            toastMocks.error.mock.calls,
            toastMocks.success.mock.calls,
            toastMocks.warning.mock.calls,
          ]),
        ).not.toContain(rawDecoderSentinel);
        expect(
          JSON.stringify([
            toastMocks.error.mock.calls,
            toastMocks.success.mock.calls,
            toastMocks.warning.mock.calls,
          ]),
        ).not.toContain(rawOcrSentinel);
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
    },
  );

  it.each([
    [
      "zh-CN",
      "扫描或输入 IMEI",
      "摄像头扫码录入 IMEI-DYNAMIC-设备",
      "扫描 IMEI",
      "当前浏览器不支持摄像头扫码。请使用照片上传或手动输入。",
    ],
    [
      "it-IT",
      "Scansiona o inserisci l’IMEI",
      "Scansiona IMEI-DYNAMIC-设备 con la fotocamera",
      "Scansiona IMEI",
      "Questo browser non supporta la scansione con fotocamera. Carica una foto o inserisci il valore manualmente.",
    ],
    [
      "en",
      "Scan or enter IMEI",
      "Scan IMEI-DYNAMIC-设备 with camera",
      "Scan IMEI",
      "This browser does not support camera scanning. Upload a photo or enter the value manually.",
    ],
  ] satisfies ReadonlyArray<[AppLocale, string, string, string, string]>)(
    "localizes scanner chrome for %s while preserving the caller identifier",
    async (locale, placeholder, cameraAction, title, unsupportedMessage) => {
      const user = userEvent.setup();
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: undefined,
      });

      render(
        <LocaleProvider initialLocale={locale}>
          <ImeiScannerField value="" onChange={vi.fn()} identifierLabel="IMEI-DYNAMIC-设备" />
        </LocaleProvider>,
      );

      expect(screen.getByPlaceholderText(placeholder)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: cameraAction }));
      expect(await screen.findByRole("dialog", { name: title })).toBeInTheDocument();
      expect(await screen.findByText(unsupportedMessage)).toBeInTheDocument();
    },
  );

  it.each([
    ["zh-CN", "图片格式或尺寸不安全", "摄像头扫码录入 IMEI"],
    [
      "it-IT",
      "Il formato o le dimensioni dell’immagine non sono sicuri",
      "Scansiona IMEI con la fotocamera",
    ],
    ["en", "The image format or dimensions are unsafe", "Scan IMEI with camera"],
  ] satisfies ReadonlyArray<[AppLocale, string, string]>)(
    "sanitizes image inspection failures for %s",
    async (locale, safeMessage, cameraAction) => {
      const user = userEvent.setup();
      imageInspectionMocks.inspectAiInventoryImage.mockRejectedValueOnce(
        new Error("PROVIDER-SECRET-SENTINEL"),
      );

      render(
        <LocaleProvider initialLocale={locale}>
          <ImeiScannerField value="" onChange={vi.fn()} />
        </LocaleProvider>,
      );
      await user.click(screen.getByRole("button", { name: cameraAction }));
      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
      expect(fileInput).not.toBeNull();
      await user.upload(fileInput!, new File(["image"], "imei.png", { type: "image/png" }));

      expect(await screen.findByText(safeMessage)).toBeInTheDocument();
      expect(screen.queryByText("PROVIDER-SECRET-SENTINEL")).not.toBeInTheDocument();
      expect(toastMocks.error).toHaveBeenCalledWith(safeMessage);
    },
  );

  it("forwards aria-required to the manual IMEI input", () => {
    render(<ImeiScannerField value="" onChange={vi.fn()} inputAriaLabel="IMEI 1" ariaRequired />);

    expect(screen.getByLabelText("IMEI 1")).toHaveAttribute("aria-required", "true");
  });

  it("requests numeric mobile keyboards for IMEI manual entry without changing text storage", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });

    render(<ImeiScannerField value="" onChange={vi.fn()} />);

    const inlineInput = screen.getByPlaceholderText("扫描或输入 IMEI");
    expect(inlineInput).toHaveAttribute("type", "text");
    expect(inlineInput).toHaveAttribute("inputmode", "numeric");

    await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));

    const fallbackInput = await screen.findByPlaceholderText("无法识别时可手动输入");
    expect(fallbackInput).toHaveAttribute("type", "text");
    expect(fallbackInput).toHaveAttribute("inputmode", "numeric");
  });

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

  it.each(["SN:C39ZQ123N70M", "SN:490154203237518", "EID:89043051202500726225007991441943"])(
    "does not auto-fill non-IMEI scanner input %s",
    async (identifier) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: undefined,
      });

      render(<ImeiScannerField value="" onChange={onChange} />);
      await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));
      await user.type(screen.getByPlaceholderText("无法识别时可手动输入"), identifier);
      await user.click(screen.getByRole("button", { name: "填入手动编号" }));

      expect(onChange).not.toHaveBeenCalled();
      expect(toastMocks.error).toHaveBeenCalledWith(
        "只接受通过校验的 15 位 IMEI；SN、EID 和其他编号请手动填写到对应字段",
      );
      expect(screen.getByText("扫描 IMEI")).toBeInTheDocument();
    },
  );

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

  it("starts with 1x high-resolution rear-camera constraints before falling back", async () => {
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
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 24, max: 30 },
      },
    });
    expect(zxingMocks.decodeFromConstraints.mock.calls[1]?.[0]).toEqual({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 24, max: 30 },
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "已识别 1 个有效 IMEI，请确认后再填入。",
    );
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "使用选择的编号" }));

    expect(onChange).toHaveBeenLastCalledWith("356938035643809");
    expect(toastMocks.success).toHaveBeenCalledWith("已录入 IMEI");
  });

  it("remembers the working camera mode and reuses it after reopening the scanner", async () => {
    const user = userEvent.setup();
    zxingMocks.decodeFromConstraints
      .mockRejectedValueOnce(new DOMException("", "OverconstrainedError"))
      .mockImplementationOnce(async () => ({ stop: zxingMocks.stop }));

    const { unmount } = render(<ImeiScannerField value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));

    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(2));
    expect(zxingMocks.decodeFromConstraints.mock.calls[1]?.[0]).toEqual({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 24, max: 30 },
      },
    });
    await waitFor(() =>
      expect(window.localStorage.getItem("repairdesk:imei-camera-access:v1")).toContain(
        '"mode":"standard"',
      ),
    );

    unmount();
    zxingMocks.decodeFromConstraints.mockReset();
    zxingMocks.decodeFromConstraints.mockImplementationOnce(async () => ({
      stop: zxingMocks.stop,
    }));

    render(<ImeiScannerField value="" onChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));

    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalledTimes(1));
    expect(zxingMocks.decodeFromConstraints.mock.calls[0]?.[0]).toEqual({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 24, max: 30 },
      },
    });
  });

  it("locks the live camera frame and excludes an EID while retaining visible IMEI candidates", async () => {
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
    const textDetectorDescriptor = Object.getOwnPropertyDescriptor(window, "TextDetector");
    const drawImageMock = vi.fn();
    const barcodeDetectMock = vi.fn();

    zxingMocks.decodeFromConstraints.mockImplementation(async (_constraints, video, callback) => {
      Object.defineProperty(video, "videoWidth", { configurable: true, value: 640 });
      Object.defineProperty(video, "videoHeight", { configurable: true, value: 480 });
      callback({
        getText: () => "89043051202500726225007991441943",
      });
      return { stop: zxingMocks.stop };
    });
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => ({ drawImage: drawImageMock })),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      value: vi.fn(() => "data:image/png;base64,iVBORw0KGgo="),
    });
    Object.defineProperty(window, "BarcodeDetector", {
      configurable: true,
      value: class BarcodeDetectorMock {
        async detect() {
          barcodeDetectMock();
          return [];
        }
      },
    });
    Object.defineProperty(window, "TextDetector", {
      configurable: true,
      value: class TextDetectorMock {
        async detect() {
          return [{ rawValue: "IMEI1: 490154203237518" }, { rawValue: "IMEI2: 356938035643809" }];
        }
      },
    });

    try {
      render(<ImeiScannerField value="" onChange={onChange} />);

      await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "已识别 2 个有效 IMEI，请选择要填入的 IMEI。",
      );
      expect(screen.getByAltText("已锁定的扫码画面")).toBeInTheDocument();
      expect(screen.getByText("画面已锁定")).toBeInTheDocument();
      expect(drawImageMock).toHaveBeenCalled();
      expect(barcodeDetectMock).toHaveBeenCalled();
      const candidateButtons = screen.getAllByRole("button", {
        name: /•••• 7518|•••• 3809/,
      });
      expect(candidateButtons[0]).toHaveTextContent("•••• 7518");
      expect(candidateButtons[1]).toHaveTextContent("•••• 3809");
      expect(screen.queryByText("89043051202500726225007991441943")).not.toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
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
      if (textDetectorDescriptor) {
        Object.defineProperty(window, "TextDetector", textDetectorDescriptor);
      } else {
        delete (window as Partial<Window & { TextDetector?: unknown }>).TextDetector;
      }
    }
  });

  it("does not attach barcode boxes to OCR-only IMEI candidates", async () => {
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
    const textDetectorDescriptor = Object.getOwnPropertyDescriptor(window, "TextDetector");

    zxingMocks.decodeFromConstraints.mockImplementation(async (_constraints, video, callback) => {
      Object.defineProperty(video, "videoWidth", { configurable: true, value: 640 });
      Object.defineProperty(video, "videoHeight", { configurable: true, value: 480 });
      callback({
        getText: () => "SN:AUNWE02SB05002790",
      });
      return { stop: zxingMocks.stop };
    });
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
            {
              rawValue: "SN:AUNWE02SB05002790",
              boundingBox: { x: 0.25, y: 0.64, width: 0.5, height: 0.08 },
            },
          ];
        }
      },
    });
    Object.defineProperty(window, "TextDetector", {
      configurable: true,
      value: class TextDetectorMock {
        async detect() {
          return [{ rawValue: "IMEI1: 490154203237518" }, { rawValue: "IMEI2: 356938035643809" }];
        }
      },
    });

    try {
      render(<ImeiScannerField value="" onChange={onChange} />);

      await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "已识别 2 个有效 IMEI，请选择要填入的 IMEI。",
      );
      expect(screen.queryByRole("button", { name: "选择画面候选 1" })).not.toBeInTheDocument();
      expect(screen.queryByText(/AUNWE02SB05002790/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /•••• 7518/ })).not.toHaveTextContent("画面");
      expect(screen.getByRole("button", { name: /•••• 3809/ })).not.toHaveTextContent("画面");
      expect(onChange).not.toHaveBeenCalled();
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
      if (textDetectorDescriptor) {
        Object.defineProperty(window, "TextDetector", textDetectorDescriptor);
      } else {
        delete (window as Partial<Window & { TextDetector?: unknown }>).TextDetector;
      }
    }
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

  it("does not autofocus the manual input when the scanner opens", async () => {
    const user = userEvent.setup();
    zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: zxingMocks.stop });

    render(<ImeiScannerField value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "摄像头扫码录入 IMEI" }));

    const manualInput = await screen.findByPlaceholderText("无法识别时可手动输入");
    expect(manualInput).not.toHaveFocus();
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
      "已识别 2 个有效 IMEI，请选择要填入的 IMEI。",
    );
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /•••• 3809/ }));
    await user.click(screen.getByRole("button", { name: "使用选择的编号" }));

    expect(onChange).toHaveBeenLastCalledWith("356938035643809");
    expect(toastMocks.success).toHaveBeenCalledWith("已录入 IMEI");
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
    const getBoundingClientRectDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "getBoundingClientRect",
    );
    const barcodeDetectorDescriptor = Object.getOwnPropertyDescriptor(window, "BarcodeDetector");
    const drawImageMock = vi.fn();

    zxingMocks.decodeFromConstraints.mockResolvedValue({ stop: zxingMocks.stop });
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserverMock {
        private readonly callback: ResizeObserverCallback;

        constructor(callback: ResizeObserverCallback) {
          this.callback = callback;
        }

        observe() {
          this.callback([], this);
        }

        unobserve() {}

        disconnect() {}
      },
    );
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value(this: HTMLElement) {
        if (this.querySelector('img[alt="当前摄像头画面 OCR 截图"]')) {
          return {
            width: 320,
            height: 160,
            top: 0,
            right: 320,
            bottom: 160,
            left: 0,
            x: 0,
            y: 0,
            toJSON: () => undefined,
          };
        }
        return {
          width: 0,
          height: 0,
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          x: 0,
          y: 0,
          toJSON: () => undefined,
        };
      },
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => ({ drawImage: drawImageMock })),
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
            {
              rawValue: "IMEI2: 356938035643809",
              boundingBox: { x: 0.2, y: 0.42, width: 0.6, height: 0.08 },
            },
            {
              rawValue: "IMEI1: 490154203237518",
              boundingBox: { x: 0.12, y: 0.22, width: 0.68, height: 0.08 },
            },
            {
              rawValue: "SN:AUNWE02SB05002790",
              boundingBox: { x: 0.24, y: 0.62, width: 0.52, height: 0.08 },
            },
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

      const captureFrameButton = await screen.findByRole("button", { name: "拍照 OCR" });
      await waitFor(() => expect(captureFrameButton).toBeEnabled());
      await user.click(captureFrameButton);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "已识别 2 个有效 IMEI，请选择要填入的 IMEI。",
      );
      expect(drawImageMock).toHaveBeenCalledWith(video, 142, 107, 356, 267, 0, 0, 640, 480);
      expect(screen.getByRole("button", { name: /•••• 7518/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /•••• 3809/ })).toBeInTheDocument();
      expect(screen.queryByText(/AUNWE02SB05002790/)).not.toBeInTheDocument();
      expect(screen.getByAltText("当前摄像头画面 OCR 截图")).toBeInTheDocument();
      const secondOverlayCandidate = screen.getByRole("button", { name: "选择画面候选 2" });
      expect(secondOverlayCandidate).toBeInTheDocument();
      await waitFor(() =>
        expect(parseFloat(secondOverlayCandidate.style.left)).toBeGreaterThan(25),
      );
      const candidateButtons = screen.getAllByRole("button", { name: /•••• (7518|3809)/ });
      expect(candidateButtons[0]).toHaveTextContent("•••• 7518");
      expect(candidateButtons[1]).toHaveTextContent("•••• 3809");
      expect(onChange).not.toHaveBeenCalled();

      await user.click(secondOverlayCandidate);
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
      if (getBoundingClientRectDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          "getBoundingClientRect",
          getBoundingClientRectDescriptor,
        );
      } else {
        delete (HTMLElement.prototype as Partial<HTMLElement>).getBoundingClientRect;
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

    expect(await screen.findByText("仅支持 JPG、PNG 或 WebP 图片。")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("无法识别时可手动输入")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rejects HEIC gallery files before browser decoding", async () => {
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

      expect(await screen.findByText("仅支持 JPG、PNG 或 WebP 图片。")).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
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
            "已识别 2 个有效 IMEI，请选择要填入的 IMEI。",
          ),
        { timeout: 4000 },
      );
      await waitFor(() => expect(screen.queryByText("正在识别图片...")).not.toBeInTheDocument());
      expect(screen.getByAltText("上传图片预览")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /•••• 3809/ }));
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
            "已识别 2 个有效 IMEI，请选择要填入的 IMEI。",
          ),
        { timeout: 4000 },
      );
      expect(screen.getByRole("button", { name: /•••• 7518/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /•••• 3809/ })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /•••• 3809/ }));
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

  it("uses the bounded same-origin OCR helper when browser-native OCR is unavailable", async () => {
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
    localOcrMocks.recognizeTextWithLocalOcr.mockResolvedValue(
      "IMEI1 490154203237518\nIMEI2 356938035643809",
    );
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:imei-photo-tesseract"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    delete (window as Partial<Window & { TextDetector?: unknown }>).TextDetector;

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
            "已识别 2 个有效 IMEI，请选择要填入的 IMEI。",
          ),
        { timeout: 4000 },
      );
      expect(localOcrMocks.recognizeTextWithLocalOcr).toHaveBeenCalledWith(
        "blob:imei-photo-tesseract",
        { timeoutMs: 32_000 },
      );
      expect(screen.getByRole("button", { name: /•••• 7518/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /•••• 3809/ })).toBeInTheDocument();
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
            "已识别 2 个有效 IMEI，请选择要填入的 IMEI。",
          ),
        { timeout: 4000 },
      );
      expect(screen.getByRole("button", { name: /•••• 7518/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /•••• 3809/ })).toBeInTheDocument();
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
    await screen.findByText("扫描 IMEI");
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
    await screen.findByText("扫描 IMEI");
    await waitFor(() => expect(zxingMocks.decodeFromConstraints).toHaveBeenCalled());

    await user.keyboard("{Escape}");

    await waitFor(() => expect(zxingMocks.stop).toHaveBeenCalled());
  });
});
