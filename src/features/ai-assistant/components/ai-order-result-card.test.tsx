import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AiOrderCard } from "@/features/ai-assistant/model/contracts";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";
import { AiOrderResultCard } from "./ai-order-result-card";

const card: AiOrderCard = {
  id: "order-dynamic-42",
  public_no: "RD-DYNAMIC-42",
  customer_hint: "M*** 客户",
  device_label: "iPhone Dynamic 蓝",
  status: "intake",
  status_label: "动态接待状态",
  updated_at: "2026-07-18T12:00:00.000Z",
  completed_at: null,
  parts_status: "needed",
  matched_reasons: ["动态原因-42"],
  allowed_actions: [],
  href: "/orders/order-dynamic-42",
};

afterEach(cleanup);

describe("AiOrderResultCard i18n", () => {
  it.each([
    ["zh-CN", "查看当前页内详情", "打开订单 RD-DYNAMIC-42"],
    ["it-IT", "Mostra dettagli in questa pagina", "Apri ordine RD-DYNAMIC-42"],
    ["en", "View details on this page", "Open order RD-DYNAMIC-42"],
  ] as const)(
    "localizes fixed chrome for %s and preserves server card bytes",
    (locale, details, openAria) => {
      renderCard(locale);

      expect(screen.getByText("RD-DYNAMIC-42")).toBeInTheDocument();
      expect(screen.getByText("iPhone Dynamic 蓝")).toBeInTheDocument();
      expect(screen.getByText("动态接待状态")).toBeInTheDocument();
      expect(screen.getByText(/动态原因-42/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: details }));
      expect(screen.getByRole("link", { name: openAria })).toHaveAttribute(
        "href",
        "/orders/order-dynamic-42",
      );
    },
  );
});

function renderCard(locale: AppLocale) {
  return render(
    <LocaleProvider initialLocale={locale}>
      <AiOrderResultCard card={card} isOnline onOpenOrder={vi.fn()} onCardUpdated={vi.fn()} />
    </LocaleProvider>,
  );
}
