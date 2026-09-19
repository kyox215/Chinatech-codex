import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { OrderResultGroupHeader } from "./order-result-group-header";

afterEach(cleanup);
describe("OrderResultGroupHeader", () => {
  it.each([
    ["zh-CN", "已载入 3 / 本组 45", "已载入 3 条"],
    ["it-IT", "Caricati 3 / Gruppo 45", "3 caricati"],
    ["en", "Loaded 3 / Group 45", "3 loaded"],
  ] as const)(
    "keeps loaded and total counts explicit in compact %s groups",
    (locale, count, ariaCount) => {
      const { container } = render(
        <LocaleProvider initialLocale={locale}>
          <OrderResultGroupHeader
            compact
            headingId="processing-heading"
            group="processing"
            pageCount={3}
            totalCount={45}
            oldestCreatedAt="2026-09-01T10:00:00Z"
          />
        </LocaleProvider>,
      );
      expect(screen.getByText(count)).toBeVisible();
      expect(screen.getByRole("heading")).toHaveAttribute("id", "processing-heading");
      const ariaLabel = container
        .querySelector('[data-order-result-group="processing"]')
        ?.getAttribute("aria-label");
      expect(ariaLabel).toContain(ariaCount);
      expect(ariaLabel).toContain("45");
    },
  );
});
