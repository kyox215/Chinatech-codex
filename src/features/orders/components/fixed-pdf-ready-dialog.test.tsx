import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PreparedFixedPdf } from "@/features/orders/print/fixed-order-pdf-delivery";
import { FixedPdfReadyDialog } from "./fixed-pdf-ready-dialog";

const prepared: PreparedFixedPdf = {
  filename: "R2026047.pdf",
  paperMode: "a5-landscape",
  file: null,
  url: "blob:order",
  canShare: false,
  metrics: {
    paperMode: "a5-landscape",
    pageCount: 1,
    cacheHit: false,
    sourceCacheHit: false,
    fingerprintMs: 1,
    captureMs: 10,
    encodeMs: 2,
    composeMs: 3,
    totalPdfReadyMs: 16,
    prepareMs: 0,
    layoutReadyMs: 0,
    pdfMs: 16,
    endToEndReadyMs: 16,
  },
};

describe("FixedPdfReadyDialog", () => {
  it("keeps visible open and download fallbacks when native file sharing is unavailable", () => {
    const onOpenPdf = vi.fn();
    const onDownload = vi.fn();
    render(
      <FixedPdfReadyDialog
        prepared={prepared}
        pending={false}
        onClose={vi.fn()}
        onShare={vi.fn()}
        onOpenPdf={onOpenPdf}
        onDownload={onDownload}
      />,
    );

    expect(screen.getByRole("heading", { name: "PDF 已准备好" })).toBeInTheDocument();
    expect(screen.getByText(/A5 横向/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "打开 PDF" }));
    fireEvent.click(screen.getByRole("button", { name: "下载 PDF" }));
    expect(onOpenPdf).toHaveBeenCalledOnce();
    expect(onDownload).toHaveBeenCalledOnce();
  });
});
