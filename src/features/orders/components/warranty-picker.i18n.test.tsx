import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

import { WarrantyPicker } from "./warranty-picker";

const locales = ["zh-CN", "it-IT", "en"] as const;

afterEach(cleanup);

describe("WarrantyPicker i18n", () => {
  it.each(locales)(
    "localizes %s fixed chrome while preserving frozen warranty values and exact reasons",
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

      expect(screen.getByText("12个月")).toBeVisible();
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
});
