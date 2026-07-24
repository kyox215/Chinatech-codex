import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearCache: vi.fn(),
  createPdf: vi.fn(),
  printPdf: vi.fn(),
  createPrepared: vi.fn(),
  openPrepared: vi.fn(),
  releasePrepared: vi.fn(),
  sharePrepared: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("./fixed-order-pdf", () => ({
  clearFixedOrderPdfMemoryCache: mocks.clearCache,
  createFixedOrderPdfWithMetrics: mocks.createPdf,
  printPdfFromCurrentPage: mocks.printPdf,
}));

vi.mock("./fixed-order-pdf-delivery", () => ({
  createPreparedFixedPdf: mocks.createPrepared,
  downloadPreparedFixedPdf: vi.fn(),
  openPreparedFixedPdf: mocks.openPrepared,
  releasePreparedFixedPdf: mocks.releasePrepared,
  sharePreparedFixedPdf: mocks.sharePrepared,
  shouldUseExplicitMobilePdfDelivery: () => true,
}));

import { useFixedOrderPdfPrint } from "./use-fixed-order-pdf-print";

const metrics = {
  paperMode: "a5-landscape" as const,
  pageCount: 1,
  cacheHit: false,
  sourceCacheHit: false,
  fingerprintMs: 1,
  captureMs: 5,
  encodeMs: 2,
  composeMs: 3,
  totalPdfReadyMs: 11,
  prepareMs: 0,
  layoutReadyMs: 0,
  pdfMs: 11,
  endToEndReadyMs: 11,
};

const prepared = {
  filename: "R2026047.pdf",
  paperMode: "a5-landscape" as const,
  file: null,
  url: "blob:order",
  metrics,
  canShare: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(performance.now());
    return 1;
  });
  mocks.createPdf.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), metrics });
  mocks.createPrepared.mockReturnValue(prepared);
  mocks.sharePrepared.mockResolvedValue("shared");
});

describe("useFixedOrderPdfPrint", () => {
  it("remains usable under React StrictMode effect replay", async () => {
    const { result } = renderHook(() => useFixedOrderPdfPrint(undefined, undefined), {
      wrapper: StrictMode,
    });

    await act(async () => {
      await expect(result.current.requestPrint("a5-landscape", "R2026047.pdf")).resolves.toBe(
        "ready",
      );
    });

    expect(mocks.createPrepared).toHaveBeenCalledOnce();
    expect(result.current.preparedPdf).toEqual(prepared);
  });

  it("does not create a Blob artifact after the owning screen unmounts", async () => {
    let resolvePdf!: (value: { bytes: Uint8Array; metrics: typeof metrics }) => void;
    mocks.createPdf.mockReturnValue(
      new Promise((resolve) => {
        resolvePdf = resolve;
      }),
    );
    const { result, unmount } = renderHook(() => useFixedOrderPdfPrint());
    const request = result.current.requestPrint("a5-landscape", "R2026047.pdf");
    await vi.waitFor(() => expect(mocks.createPdf).toHaveBeenCalledOnce());

    unmount();
    resolvePdf({ bytes: new Uint8Array([1, 2, 3]), metrics });
    await expect(request).resolves.toBe("failed");
    expect(mocks.createPrepared).not.toHaveBeenCalled();
  });

  it("exposes PDF generation as pending until the ready artifact exists", async () => {
    let resolvePdf!: (value: { bytes: Uint8Array; metrics: typeof metrics }) => void;
    mocks.createPdf.mockReturnValue(
      new Promise((resolve) => {
        resolvePdf = resolve;
      }),
    );
    const { result } = renderHook(() => useFixedOrderPdfPrint());

    let request!: Promise<"started" | "ready" | "busy" | "failed">;
    act(() => {
      request = result.current.requestPrint("a5-landscape", "R2026047.pdf");
    });
    expect(result.current.generationPending).toBe(true);

    await act(async () => {
      resolvePdf({ bytes: new Uint8Array([1, 2, 3]), metrics });
      await request;
    });
    expect(result.current.generationPending).toBe(false);
    expect(result.current.preparedPdf).toEqual(prepared);
  });

  it("uses a synchronous lock so rapid taps open native sharing only once", async () => {
    let resolveShare!: (value: "shared") => void;
    mocks.sharePrepared.mockReturnValue(
      new Promise((resolve) => {
        resolveShare = resolve;
      }),
    );
    const { result } = renderHook(() => useFixedOrderPdfPrint());
    await act(async () => {
      await result.current.requestPrint("a5-landscape", "R2026047.pdf");
    });

    let first!: Promise<void>;
    await act(async () => {
      first = result.current.sharePreparedPdf();
      void result.current.sharePreparedPdf();
      resolveShare("shared");
      await first;
    });

    expect(mocks.sharePrepared).toHaveBeenCalledOnce();
  });

  it("invalidates the old scope without letting its late finally unlock the new request", async () => {
    let resolveOld!: (value: { bytes: Uint8Array; metrics: typeof metrics }) => void;
    let resolveNew!: (value: { bytes: Uint8Array; metrics: typeof metrics }) => void;
    mocks.createPdf
      .mockReturnValueOnce(new Promise((resolve) => (resolveOld = resolve)))
      .mockReturnValueOnce(new Promise((resolve) => (resolveNew = resolve)));
    const onInvalidate = vi.fn();
    const { result, rerender } = renderHook(
      ({ scopeKey }) => useFixedOrderPdfPrint(undefined, undefined, { scopeKey, onInvalidate }),
      { initialProps: { scopeKey: "store-a:order-1" } },
    );

    const oldRequest = result.current.requestPrint("a5-landscape", "old.pdf");
    await vi.waitFor(() => expect(mocks.createPdf).toHaveBeenCalledTimes(1));
    rerender({ scopeKey: "store-b:order-2" });
    expect(onInvalidate).toHaveBeenCalledOnce();
    const newRequest = result.current.requestPrint("a5-landscape", "new.pdf");
    await vi.waitFor(() => expect(mocks.createPdf).toHaveBeenCalledTimes(2));

    resolveOld({ bytes: new Uint8Array([1]), metrics });
    await expect(oldRequest).resolves.toBe("failed");
    await expect(result.current.requestPrint("a5-landscape", "third.pdf")).resolves.toBe("busy");

    resolveNew({ bytes: new Uint8Array([2]), metrics });
    await expect(newRequest).resolves.toBe("ready");
  });

  it("keeps the prepared PDF available when the browser rejects opening it", async () => {
    const onComplete = vi.fn();
    mocks.openPrepared.mockImplementation(() => {
      throw new Error("navigation rejected");
    });
    const { result } = renderHook(() => useFixedOrderPdfPrint(onComplete));
    await act(async () => {
      await result.current.requestPrint("a5-landscape", "R2026047.pdf");
    });

    act(() => result.current.openPreparedPdf());

    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.preparedPdf).toEqual(prepared);
    expect(result.current.deliveryError).toMatch(/没有打开 PDF/);
  });
});
