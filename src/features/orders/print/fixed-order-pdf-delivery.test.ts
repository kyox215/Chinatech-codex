import { afterEach, describe, expect, it, vi } from "vitest";

import type { FixedOrderPdfMetrics } from "./fixed-order-pdf";
import {
  createPreparedFixedPdf,
  releasePreparedFixedPdf,
  sharePreparedFixedPdf,
  shouldUseExplicitMobilePdfDelivery,
} from "./fixed-order-pdf-delivery";

const metrics: FixedOrderPdfMetrics = {
  paperMode: "a5-landscape",
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

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
  Reflect.deleteProperty(navigator, "maxTouchPoints");
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: originalCreateObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: originalRevokeObjectURL,
  });
});

describe("fixed PDF mobile delivery", () => {
  it("routes iPhone and iPad desktop-mode browsers away from iframe printing", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false }) as MediaQueryList),
    });
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone)");
    expect(shouldUseExplicitMobilePdfDelivery()).toBe(true);

    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Macintosh)");
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 5 });
    expect(shouldUseExplicitMobilePdfDelivery()).toBe(true);
  });

  it("keeps ordinary desktop browsers on the direct print path", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Macintosh)");
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 0 });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false }) as MediaQueryList),
    });
    expect(shouldUseExplicitMobilePdfDelivery()).toBe(false);
  });

  it("keeps a touch-enabled Windows desktop on the direct desktop print path", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    );
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 10 });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true }) as MediaQueryList),
    });
    expect(shouldUseExplicitMobilePdfDelivery()).toBe(false);
  });

  it("prepares a shareable PDF and treats closing the system sheet as cancellation", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:mobile-order"),
    });
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const abort = new DOMException("cancel", "AbortError");
    const share = vi.fn().mockRejectedValue(abort);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: vi.fn(() => true),
    });

    const prepared = createPreparedFixedPdf(
      new Uint8Array([1, 2, 3]),
      "R2026047.pdf",
      "a5-landscape",
      metrics,
    );

    expect(prepared.canShare).toBe(true);
    await expect(sharePreparedFixedPdf(prepared)).resolves.toBe("cancelled");
    expect(share).toHaveBeenCalledWith({ files: [prepared.file], title: "R2026047.pdf" });
    releasePreparedFixedPdf(prepared);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mobile-order");
  });

  it("reports unsupported sharing so the visible PDF and download fallbacks remain available", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:fallback-order"),
    });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });

    const prepared = createPreparedFixedPdf(
      new Uint8Array([1, 2, 3]),
      "R2026047.pdf",
      "a5-landscape",
      metrics,
    );

    expect(prepared.canShare).toBe(false);
    await expect(sharePreparedFixedPdf(prepared)).resolves.toBe("unsupported");
  });
});
