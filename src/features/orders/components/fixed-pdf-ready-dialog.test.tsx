import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PreparedFixedPdf } from "@/features/orders/print/fixed-order-pdf-delivery";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";
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
  it.each(["zh-CN", "it-IT", "en"] as const)(
    "keeps localized %s open and download fallbacks when native sharing is unavailable",
    (locale) => {
      const onOpenPdf = vi.fn();
      const onDownload = vi.fn();
      render(
        <LocaleProvider initialLocale={locale}>
          <FixedPdfReadyDialog
            prepared={prepared}
            pending={false}
            onClose={vi.fn()}
            onShare={vi.fn()}
            onOpenPdf={onOpenPdf}
            onDownload={onDownload}
          />
        </LocaleProvider>,
      );

      expect(
        screen.getByRole("heading", { name: translateMessage(locale, "orders2b2.pdf.title") }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(translateMessage(locale, "orders2b2.printPaper.a5"), { exact: false }),
      ).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b2.pdf.open") }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b2.pdf.download") }),
      );
      expect(onOpenPdf).toHaveBeenCalledOnce();
      expect(onDownload).toHaveBeenCalledOnce();
    },
  );
});
