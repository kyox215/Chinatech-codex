import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { recognizeAiInventoryImageLocally } from "./inventory-local-recognition";

const zxingMocks = vi.hoisted(() => ({
  decodeFromImageElement: vi.fn(),
}));

vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: vi.fn(function BrowserMultiFormatReaderMock() {
    return { decodeFromImageElement: zxingMocks.decodeFromImageElement };
  }),
}));
describe("local AI inventory recognition", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    zxingMocks.decodeFromImageElement.mockReset();
    delete (window as Window & { BarcodeDetector?: unknown }).BarcodeDetector;
    delete (window as Window & { TextDetector?: unknown }).TextDetector;
  });

  afterEach(() => {
    delete (window as Window & { BarcodeDetector?: unknown }).BarcodeDetector;
    delete (window as Window & { TextDetector?: unknown }).TextDetector;
  });

  it("returns structured candidates from native local detectors without provider calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const barcodeDetect = vi
      .fn()
      .mockResolvedValue([{ rawValue: "9900000000004" }, { rawValue: "990000000000002" }]);
    const textDetect = vi
      .fn()
      .mockResolvedValue([{ rawValue: "REDMI A7 Pro Black" }, { rawValue: "4GB RAM 64GB ROM" }]);
    Object.defineProperty(window, "BarcodeDetector", {
      configurable: true,
      value: vi.fn(function BarcodeDetectorMock() {
        return { detect: barcodeDetect };
      }),
    });
    Object.defineProperty(window, "TextDetector", {
      configurable: true,
      value: vi.fn(function TextDetectorMock() {
        return { detect: textDetect };
      }),
    });

    const result = await recognizeAiInventoryImageLocally({ previewUrl: "blob:local-safe" });

    expect(result.fields).toMatchObject({
      brand: { value: "Redmi", source: "ocr" },
      model: { value: "A7 Pro", source: "ocr" },
      ram_capacity: { value: "4 GB", source: "ocr" },
      storage_capacity: { value: "64 GB", source: "ocr" },
    });
    expect(result.identifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "ean", value: "9900000000004", validation: "valid" }),
        expect.objectContaining({ type: "imei1", validation: "valid" }),
      ]),
    );
    expect(result).not.toHaveProperty("ocrText");
    expect(result).not.toHaveProperty("barcodeValues");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses bundled ZXing and degrades OCR without loading a third-party worker", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    zxingMocks.decodeFromImageElement.mockResolvedValue({ getText: () => "9900000000004" });

    const result = await recognizeAiInventoryImageLocally({ previewUrl: "blob:local-safe" });

    expect(result.fields.model.value).toBeNull();
    expect(result.identifiers).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "ean", validation: "valid" })]),
    );
    expect(result.warnings).toContain("本地文字识别未完成，请人工核对型号与容量。");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("degrades to safe warnings when both local detectors fail", async () => {
    zxingMocks.decodeFromImageElement.mockRejectedValue(new Error("private decoder detail"));

    const result = await recognizeAiInventoryImageLocally({ previewUrl: "blob:local-safe" });

    expect(result.fields.model.value).toBeNull();
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "本地条码识别未完成，请人工核对设备标识符。",
        "本地文字识别未完成，请人工核对型号与容量。",
      ]),
    );
    expect(JSON.stringify(result)).not.toContain("private decoder detail");
  });

  it("honors cancellation before decoding", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      recognizeAiInventoryImageLocally(
        { previewUrl: "blob:local-safe" },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(zxingMocks.decodeFromImageElement).not.toHaveBeenCalled();
  });
});
