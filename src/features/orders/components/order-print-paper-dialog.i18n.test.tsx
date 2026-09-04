import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

import { OrderPrintPaperDialog } from "./order-print-paper-dialog";

const locales = ["zh-CN", "it-IT", "en"] as const;

afterEach(cleanup);

describe("OrderPrintPaperDialog i18n", () => {
  it.each(locales)(
    "localizes %s paper chrome without changing the selected print mode",
    (locale) => {
      const onSelect = vi.fn();
      render(
        <LocaleProvider initialLocale={locale}>
          <OrderPrintPaperDialog open onOpenChange={vi.fn()} onSelect={onSelect} />
        </LocaleProvider>,
      );

      expect(
        screen.getByRole("heading", {
          name: translateMessage(locale, "orders2b2.printPaper.title"),
        }),
      ).toBeVisible();
      fireEvent.click(
        screen.getByRole("button", {
          name: new RegExp(translateMessage(locale, "orders2b2.printPaper.a4Duplicate")),
        }),
      );
      expect(onSelect).toHaveBeenCalledWith("a4-portrait-duplicate");
    },
  );
});
