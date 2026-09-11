import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { OrderResultGroupHeader } from "./order-result-group-header";

afterEach(cleanup);
describe("OrderResultGroupHeader", () => {
  it.each([
    ["zh-CN", "本页 3 / 共 45"],
    ["it-IT", "Qui 3 / Tot. 45"],
    ["en", "Page 3 / Total 45"],
  ] as const)("keeps page and total counts explicit in compact %s groups", (locale, count) => {
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
    expect(
      container.querySelector('[data-order-result-group="processing"]')?.getAttribute("aria-label"),
    ).toContain("45");
  });
});
