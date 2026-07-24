import { afterEach, describe, expect, it, vi } from "vitest";

import { canCacheFixedOrderPdf, printPdfFromCurrentPage } from "./fixed-order-pdf";

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: originalCreateObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: originalRevokeObjectURL,
  });
  document.querySelectorAll('[data-repairdesk-pdf-print="true"]').forEach((node) => node.remove());
});

describe("printPdfFromCurrentPage", () => {
  it("prints through a hidden iframe without opening a new tab", async () => {
    const createObjectURL = vi.fn(() => "blob:repairdesk-print");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const open = vi.spyOn(window, "open");
    const originalAppendChild = document.body.appendChild.bind(document.body);
    let print = vi.fn();
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      const result = originalAppendChild(node);
      if (node instanceof HTMLIFrameElement && node.dataset.repairdeskPdfPrint === "true") {
        const printWindow = node.contentWindow;
        if (!printWindow) throw new Error("Missing iframe window");
        print = vi.fn(() => printWindow.dispatchEvent(new Event("afterprint")));
        Object.defineProperty(printWindow, "print", { configurable: true, value: print });
        Object.defineProperty(printWindow, "focus", { configurable: true, value: vi.fn() });
        queueMicrotask(() => node.dispatchEvent(new Event("load")));
      }
      return result;
    });

    await printPdfFromCurrentPage(new Uint8Array([1, 2, 3]), "R2026047.pdf");

    expect(open).not.toHaveBeenCalled();
    expect(print).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:repairdesk-print");
    expect(document.querySelector('[data-repairdesk-pdf-print="true"]')).toBeNull();
  });

  it("cleans the iframe and object URL when the PDF cannot load", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:failed-print"),
    });
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const originalAppendChild = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      const result = originalAppendChild(node);
      if (node instanceof HTMLIFrameElement && node.dataset.repairdeskPdfPrint === "true") {
        queueMicrotask(() => node.dispatchEvent(new Event("error")));
      }
      return result;
    });

    await expect(
      printPdfFromCurrentPage(new Uint8Array([1, 2, 3]), "R2026047.pdf"),
    ).rejects.toThrow("无法加载打印文件，请重试");

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:failed-print");
    expect(document.querySelector('[data-repairdesk-pdf-print="true"]')).toBeNull();
  });

  it("cancels a pending desktop iframe before it can open an old-scope print dialog", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:cancelled-print"),
    });
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const controller = new AbortController();
    const print = vi.fn();
    const pending = printPdfFromCurrentPage(new Uint8Array([1, 2, 3]), "R2026047.pdf", {
      signal: controller.signal,
    });
    const frame = document.querySelector<HTMLIFrameElement>('[data-repairdesk-pdf-print="true"]');
    if (!frame?.contentWindow) throw new Error("Missing iframe window");
    Object.defineProperty(frame.contentWindow, "print", { configurable: true, value: print });

    controller.abort();
    frame.dispatchEvent(new Event("load"));

    await expect(pending).rejects.toThrow("打印已取消");
    expect(print).not.toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:cancelled-print");
  });
});

describe("fixed PDF cache policy", () => {
  it("caches only a single order and never retains a batch of customer documents", () => {
    expect(canCacheFixedOrderPdf(1)).toBe(true);
    expect(canCacheFixedOrderPdf(2)).toBe(false);
    expect(canCacheFixedOrderPdf(50)).toBe(false);
  });
});
