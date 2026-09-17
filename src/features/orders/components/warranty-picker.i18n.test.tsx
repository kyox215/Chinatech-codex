import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

import { WarrantyPicker, WarrantyTag } from "./warranty-picker";

const locales = ["zh-CN", "it-IT", "en"] as const;

afterEach(cleanup);

describe("WarrantyPicker i18n", () => {
  it.each(locales)(
    "localizes %s warranty labels while preserving canonical values and exact reasons",
    (locale) => {
      const onChange = vi.fn();
      render(
        <LocaleProvider initialLocale={locale}>
          <WarrantyPicker
            valueMonths={12}
            valueText="12个月"
            reason="  动态质保原因  "
            defaultMonths={6}
            onChange={onChange}
          />
        </LocaleProvider>,
      );

      expect(
        screen.getByText(translateMessage(locale, "orders2b2.warranty.months", { months: 12 })),
      ).toBeVisible();
      expect(screen.getByText(translateMessage(locale, "orders2b2.warranty.help"))).toBeVisible();
      const reason = screen.getByPlaceholderText(
        translateMessage(locale, "orders2b2.warranty.reasonPlaceholder"),
      );
      fireEvent.change(reason, { target: { value: "  新原因  " } });
      expect(onChange).toHaveBeenCalledWith({
        warranty_months: 12,
        warranty_text: "12个月",
        warranty_change_reason: "  新原因  ",
      });
    },
  );

  it.each(locales)("localizes all %s options and detail tags", (locale) => {
    const labels = [
      translateMessage(locale, "orders2b2.warranty.none"),
      ...[3, 6, 12].map((months) =>
        translateMessage(locale, "orders2b2.warranty.months", { months }),
      ),
      translateMessage(locale, "orders2b2.warranty.twoYears"),
    ];
    const view = render(
      <LocaleProvider initialLocale={locale}>
        <WarrantyPicker valueMonths={6} onChange={vi.fn()} />
        <section aria-label="Detail warranties">
          {[0, 3, 6, 12, 24].map((months) => (
            <WarrantyTag key={months} months={months} />
          ))}
          <WarrantyTag text="90天质保" />
          <WarrantyTag />
        </section>
      </LocaleProvider>,
    );
    const tags = within(screen.getByRole("region", { name: "Detail warranties" }));
    labels.forEach((label) => expect(tags.getAllByText(label).length).toBeGreaterThan(0));
    expect(tags.getByText("—")).toBeVisible();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(5);
    labels.forEach((label, index) => expect(options[index]).toHaveTextContent(label));
    if (locale !== "zh-CN") {
      expect(view.container.textContent).not.toMatch(/个月|两年|无保修/);
      options.forEach((option) => expect(option.textContent).not.toMatch(/个月|两年|无保修/));
    }
  });
});
