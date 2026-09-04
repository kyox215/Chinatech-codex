import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CustomerFilters } from "@/features/customers/forms/customer-filters";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

describe("CustomerFilters i18n", () => {
  it.each(["zh-CN", "it-IT", "en"] as const)(
    "localizes fixed controls and preserves canonical filter values in %s",
    async (locale) => {
      const onChange = vi.fn();
      const onClose = vi.fn();
      const user = userEvent.setup();
      render(
        <LocaleProvider initialLocale={locale}>
          <CustomerFilters
            filters={{ work: "all", followup: "all", marketing: "all", tagIds: [] }}
            tags={[{ id: "tag-dynamic", name: "动态标签 Ω", color: "#123456" }]}
            onChange={onChange}
            onClose={onClose}
          />
        </LocaleProvider>,
      );

      expect(screen.getByText(translateMessage(locale, "customers.list.filters"))).toBeVisible();
      expect(screen.getByText("动态标签 Ω")).toBeVisible();
      const repeat = screen.getByRole("button", {
        name: translateMessage(locale, "customers.filters.repeat"),
      });
      expect(repeat).toHaveClass("min-h-11");
      await user.click(repeat);
      expect(onChange).toHaveBeenCalledWith({
        work: "repeat",
        followup: "all",
        marketing: "all",
        tagIds: [],
      });
      await user.click(screen.getByText("动态标签 Ω"));
      expect(onChange).toHaveBeenLastCalledWith({
        work: "all",
        followup: "all",
        marketing: "all",
        tagIds: ["tag-dynamic"],
      });
      await user.click(
        screen.getByRole("button", { name: translateMessage(locale, "customers.filters.apply") }),
      );
      expect(onClose).toHaveBeenCalledOnce();
    },
  );
});
