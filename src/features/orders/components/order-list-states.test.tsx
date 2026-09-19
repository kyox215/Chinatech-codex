import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";
import { EmptyOrdersState } from "./order-list-states";

afterEach(cleanup);

const cases = {
  "zh-CN": {
    empty: ["暂无工单", "新建第一张维修工单后会显示在这里。"],
    filtered: ["暂无符合条件的工单", "当前有筛选条件生效，可以清除后再查看。", "清除全部筛选"],
    search: [
      "未找到“R”",
      "可以检查订单号、姓名、电话号码或 IMEI，也可以清除条件后重试。",
      "清除搜索和筛选",
    ],
  },
  "it-IT": {
    empty: ["Nessun ordine", "Il primo ordine di riparazione apparirà qui."],
    filtered: [
      "Nessun ordine corrisponde ai filtri",
      "Sono attivi alcuni filtri; cancellali per vedere altri ordini.",
      "Cancella tutti i filtri",
    ],
    search: [
      "Nessun risultato per “R”",
      "Controlla numero ordine, nome, telefono o IMEI, oppure cancella i criteri.",
      "Cancella ricerca e filtri",
    ],
  },
  en: {
    empty: ["No orders", "The first repair order will appear here."],
    filtered: [
      "No orders match the filters",
      "Filters are active; clear them to see more orders.",
      "Clear all filters",
    ],
    search: [
      "No results for “R”",
      "Check the order number, name, phone number, or IMEI, or clear the criteria.",
      "Clear search and filters",
    ],
  },
} as const;

describe("EmptyOrdersState", () => {
  it.each(["zh-CN", "it-IT", "en"] as const)(
    "explains the current queue and offers the authorized history action in %s",
    async (locale) => {
      const onSearchArchive = vi.fn();
      const onClearFilters = vi.fn();
      render(
        <LocaleProvider initialLocale={locale}>
          <EmptyOrdersState
            hasActiveFilters
            currentQueue
            searchQuery="R2027071"
            onClearFilters={onClearFilters}
            onSearchArchive={onSearchArchive}
          />
        </LocaleProvider>,
      );
      await waitFor(() =>
        expect(
          screen.getByText(translateMessage(locale, "orders.currentSearchHelp")),
        ).toBeVisible(),
      );
      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "orders.searchArchive") }),
      );
      expect(onSearchArchive).toHaveBeenCalledOnce();
      expect(onClearFilters).not.toHaveBeenCalled();
    },
  );

  it("offers creation when the current queue is empty without implying history is empty", () => {
    const onCreateOrder = vi.fn();
    render(
      <LocaleProvider initialLocale="en">
        <EmptyOrdersState
          hasActiveFilters={false}
          currentQueue
          onClearFilters={vi.fn()}
          onCreateOrder={onCreateOrder}
        />
      </LocaleProvider>,
    );
    expect(screen.getByRole("heading")).toHaveTextContent("No orders in the current queue");
    expect(screen.queryByRole("button", { name: "Search history" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: translateMessage("en", "orders.new") }));
    expect(onCreateOrder).toHaveBeenCalledOnce();
  });

  it.each(Object.keys(cases) as Array<keyof typeof cases>)(
    "covers empty states in %s",
    (locale) => {
      const expected = cases[locale];
      const onClearFilters = () => undefined;
      const renderState = (props: { hasActiveFilters: boolean; searchQuery?: string }) =>
        render(
          <LocaleProvider initialLocale={locale}>
            <EmptyOrdersState {...props} onClearFilters={onClearFilters} />
          </LocaleProvider>,
        );

      renderState({ hasActiveFilters: false });
      expect(screen.getByRole("heading", { name: expected.empty[0] })).toBeInTheDocument();
      expect(screen.getByText(expected.empty[1])).toBeInTheDocument();
      cleanup();

      renderState({ hasActiveFilters: true });
      expect(screen.getByRole("heading", { name: expected.filtered[0] })).toBeInTheDocument();
      expect(screen.getByText(expected.filtered[1])).toBeInTheDocument();
      expect(screen.getByRole("button", { name: expected.filtered[2] })).toBeInTheDocument();
      cleanup();

      renderState({ hasActiveFilters: true, searchQuery: "R" });
      expect(screen.getByRole("heading", { name: expected.search[0] })).toBeInTheDocument();
      expect(screen.getByText(expected.search[1])).toBeInTheDocument();
      expect(screen.getByRole("button", { name: expected.search[2] })).toBeInTheDocument();
    },
  );
});
