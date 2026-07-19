import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tesseractMocks = vi.hoisted(() => ({
  createWorker: vi.fn(),
  setParameters: vi.fn(),
  recognize: vi.fn(),
  terminate: vi.fn(),
}));

vi.mock("tesseract.js", () => ({
  OEM: { LSTM_ONLY: 1 },
  createWorker: tesseractMocks.createWorker,
}));

import { localOcrAssetPaths, recognizeTextWithLocalOcr } from "./local-ocr";

describe("same-origin local OCR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tesseractMocks.setParameters.mockResolvedValue(undefined);
    tesseractMocks.recognize.mockResolvedValue({ data: { text: "IMEI1 490154203237518" } });
    tesseractMocks.terminate.mockResolvedValue(undefined);
    tesseractMocks.createWorker.mockResolvedValue({
      setParameters: tesseractMocks.setParameters,
      recognize: tesseractMocks.recognize,
      terminate: tesseractMocks.terminate,
    });
  });

  afterEach(() => vi.useRealTimers());

  it("pins worker, core and language files to same-origin versioned paths", async () => {
    await expect(recognizeTextWithLocalOcr("blob:local-only-label")).resolves.toBe(
      "IMEI1 490154203237518",
    );

    expect(tesseractMocks.createWorker).toHaveBeenCalledWith(
      "eng",
      1,
      expect.objectContaining({
        ...localOcrAssetPaths,
        workerBlobURL: false,
        gzip: true,
      }),
    );
    expect(tesseractMocks.recognize).toHaveBeenCalledWith("blob:local-only-label");
    expect(tesseractMocks.terminate).toHaveBeenCalledOnce();
  });

  it("terminates the OCR worker when the caller cancels", async () => {
    tesseractMocks.recognize.mockReturnValue(new Promise(() => {}));
    const controller = new AbortController();
    const operation = recognizeTextWithLocalOcr("blob:local-only-label", {
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(tesseractMocks.recognize).toHaveBeenCalledOnce());
    controller.abort();

    await expect(operation).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(tesseractMocks.terminate).toHaveBeenCalledOnce());
  });
});
