import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DiagnosisQuoteDialog } from "@/components/orders/diagnosis-quote-dialog";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

describe("DiagnosisQuoteDialog i18n", () => {
  it.each(["zh-CN", "it-IT", "en"] as const)(
    "shows safe localized diagnosis error, then closes after canonical success in %s",
    async (locale) => {
      const rawError = "SERVER_SECRET_DIAGNOSIS_FAILURE";
      const onSaveDiagnosis = vi
        .fn()
        .mockRejectedValueOnce(new Error(rawError))
        .mockResolvedValueOnce({ ok: true });
      const onOpenChange = vi.fn();
      render(
        <LocaleProvider initialLocale={locale}>
          <DiagnosisQuoteDialog
            open
            order={
              {
                diagnosis_result: "  动态中文诊断  ",
                issue_description: "动态故障",
                deposit_amount: 0,
                fault_prices: [],
              } as never
            }
            capabilities={{ canEditRepair: true } as never}
            onOpenChange={onOpenChange}
            onSaveDiagnosis={onSaveDiagnosis}
            onPublish={vi.fn()}
          />
        </LocaleProvider>,
      );

      const save = screen.getByRole("button", {
        name: translateMessage(locale, "orders2b1.quote.saveDiagnosis"),
      });
      fireEvent.click(save);
      await waitFor(() => expect(onSaveDiagnosis).toHaveBeenCalledTimes(1));
      expect(onSaveDiagnosis).toHaveBeenLastCalledWith("动态中文诊断");
      expect(
        await screen.findByText(translateMessage(locale, "orders2b1.quote.saveFailed")),
      ).toBeVisible();
      expect(screen.queryByText(rawError)).not.toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: translateMessage(locale, "orders2b1.quote.title") }),
      ).toBeVisible();

      fireEvent.click(save);
      await waitFor(() => expect(onSaveDiagnosis).toHaveBeenCalledTimes(2));
      expect(onSaveDiagnosis.mock.calls[1]?.[0]).toBe(onSaveDiagnosis.mock.calls[0]?.[0]);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "locks the real localized diagnosis dialog while pending in %s",
    (locale) => {
      render(
        <LocaleProvider initialLocale={locale}>
          <DiagnosisQuoteDialog
            open
            isPending
            order={
              {
                diagnosis_result: "动态中文诊断",
                issue_description: "动态故障",
                deposit_amount: 0,
                fault_prices: [],
              } as never
            }
            capabilities={{ canEditRepair: true } as never}
            onOpenChange={vi.fn()}
            onSaveDiagnosis={vi.fn()}
            onPublish={vi.fn()}
          />
        </LocaleProvider>,
      );
      expect(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b1.quote.saving") }),
      ).toBeDisabled();
      expect(
        screen.getByRole("textbox", {
          name: translateMessage(locale, "orders2b1.quote.diagnosis"),
        }),
      ).toBeDisabled();
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "locks the real localized quote dialog while pending in %s",
    (locale) => {
      render(
        <LocaleProvider initialLocale={locale}>
          <DiagnosisQuoteDialog
            open
            isPending
            order={
              {
                diagnosis_result: "动态中文诊断",
                issue_description: "动态故障",
                deposit_amount: 20,
                fault_prices: [
                  {
                    line_id: "00000000-0000-4000-8000-000000000311",
                    catalog_key: "display:original",
                    name: "原装屏幕",
                    price: 120,
                    currency_code: "EUR",
                    note: "自定义报价备注",
                  },
                ],
              } as never
            }
            capabilities={{ canEditRepair: true, canPrepareQuote: true } as never}
            onOpenChange={vi.fn()}
            onSaveDiagnosis={vi.fn()}
            onPublish={vi.fn()}
          />
        </LocaleProvider>,
      );
      expect(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b1.quote.saving") }),
      ).toBeDisabled();
      expect(
        screen.getByRole("textbox", {
          name: translateMessage(locale, "orders2b1.quote.itemName", { index: 1 }),
        }),
      ).toBeDisabled();
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "reuses one caller-owned publish idempotency key and canonical draft after failure in %s",
    async (locale) => {
      const onPublish = vi
        .fn()
        .mockRejectedValueOnce(new Error("SERVER_SECRET_QUOTE_FAILURE"))
        .mockResolvedValueOnce({ ok: true });
      const onOpenChange = vi.fn();
      render(
        <LocaleProvider initialLocale={locale}>
          <DiagnosisQuoteDialog
            open
            order={
              {
                diagnosis_result: "  动态中文诊断  ",
                issue_description: "动态故障",
                deposit_amount: 20,
                fault_prices: [
                  {
                    line_id: "00000000-0000-4000-8000-000000000311",
                    catalog_key: "display:original",
                    name: "原装屏幕",
                    price: 120,
                    currency_code: "EUR",
                    note: "自定义报价备注",
                  },
                ],
              } as never
            }
            capabilities={{ canEditRepair: true, canPrepareQuote: true } as never}
            onOpenChange={onOpenChange}
            onSaveDiagnosis={vi.fn()}
            onPublish={onPublish}
          />
        </LocaleProvider>,
      );

      const publish = screen.getByRole("button", {
        name: translateMessage(locale, "orders2b1.quote.publish"),
      });
      fireEvent.click(publish);
      await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1));
      expect(
        screen.getByText(translateMessage(locale, "orders2b1.quote.saveFailed")),
      ).toBeVisible();
      expect(screen.queryByText("SERVER_SECRET_QUOTE_FAILURE")).not.toBeInTheDocument();

      fireEvent.click(publish);
      await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(2));
      expect(onPublish.mock.calls[1]?.[0]).toEqual(onPublish.mock.calls[0]?.[0]);
      expect(onPublish.mock.calls[0]?.[0]).toMatchObject({
        idempotencyKey: expect.any(String),
        diagnosisResult: "动态中文诊断",
        faultPrices: [
          {
            line_id: "00000000-0000-4000-8000-000000000311",
            catalog_key: "display:original",
            name: "原装屏幕",
            price: 120,
            currency_code: "EUR",
            note: "自定义报价备注",
          },
        ],
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    },
  );
});
