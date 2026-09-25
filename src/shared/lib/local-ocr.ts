const localOcrAssetRoot = "/vendor/tesseract/v7.0.0";

export const localOcrAssetPaths = {
  workerPath: `${localOcrAssetRoot}/worker.min.js`,
  corePath: `${localOcrAssetRoot}/core`,
  langPath: `${localOcrAssetRoot}/lang`,
} as const;

const defaultTimeoutMs = 32_000;

type LocalOcrOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

/**
 * Runs OCR in Tesseract's own worker using only fixed-version same-origin assets.
 * The image stays inside the browser; progress and raw OCR text are never logged.
 */
export async function recognizeTextWithLocalOcr(
  imageSource: string,
  options: LocalOcrOptions = {},
) {
  throwIfAborted(options.signal);
  const timeoutMs = Math.max(1, Math.min(options.timeoutMs ?? defaultTimeoutMs, 60_000));
  const { createWorker, OEM } = await import("tesseract.js");
  throwIfAborted(options.signal);

  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  let stopped = false;
  let rejectStop: ((reason: unknown) => void) | null = null;
  const stopPromise = new Promise<never>((_resolve, reject) => {
    rejectStop = reject;
  });

  const terminate = async () => {
    if (stopped) return;
    stopped = true;
    const activeWorker = worker;
    worker = null;
    if (activeWorker) await activeWorker.terminate().catch(() => undefined);
  };
  const stop = (reason: unknown) => {
    rejectStop?.(reason);
    void terminate();
  };
  const handleAbort = () => stop(createAbortError());
  options.signal?.addEventListener("abort", handleAbort, { once: true });
  const timeoutId = setTimeout(() => stop(new Error("本地 OCR 识别超时")), timeoutMs);

  try {
    const createPromise = createWorker("eng", OEM.LSTM_ONLY, {
      workerPath: localOcrAssetPaths.workerPath,
      corePath: localOcrAssetPaths.corePath,
      langPath: localOcrAssetPaths.langPath,
      workerBlobURL: false,
      gzip: true,
      logger: () => undefined,
      errorHandler: () => undefined,
    }).then(async (createdWorker) => {
      worker = createdWorker;
      if (stopped || options.signal?.aborted) {
        await createdWorker.terminate().catch(() => undefined);
        throw createAbortError();
      }
      return createdWorker;
    });
    const activeWorker = await Promise.race([createPromise, stopPromise]);
    await Promise.race([
      activeWorker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_char_whitelist:
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz:/-_. ",
      }),
      stopPromise,
    ]);
    const result = await Promise.race([activeWorker.recognize(imageSource), stopPromise]);
    return result.data.text?.trim() ?? "";
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", handleAbort);
    await terminate();
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw createAbortError();
}

function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}
