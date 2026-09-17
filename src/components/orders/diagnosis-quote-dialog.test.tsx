import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DiagnosisQuoteDialog } from "@/components/orders/diagnosis-quote-dialog";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

describe("DiagnosisQuoteDialog i18n", () => {
  it.each(["zh-CN", "it-IT", "en"] as const)(
    "deducts all opening receipts, blocks underpayment and retains receipt/CAS state on retry in %s",
    async (locale) => {
      const order = {
        id: "receipts-order",
        updated_at: "2026-09-17T10:00:00.000Z",
        issue_description: "Synthetic receipt check",
        diagnosis_result: "Repair confirmed",
        quotation_amount: 100,
        deposit_amount: 20,
        balance_amount: 30,
        fault_prices: [
          { line_id: "00000000-0000-4000-8000-000000000311", name: "Repair", price: 100 },
        ],
      } as never;
      const onPublish = vi
        .fn()
        .mockRejectedValueOnce(new Error("Synthetic response lost"))
        .mockResolvedValueOnce({});
      const props = {
        open: true,
        capabilities: { canEditRepair: true, canPrepareQuote: true } as never,
        onOpenChange: vi.fn(),
        onSaveDiagnosis: vi.fn(),
        onPublish,
      };
      const renderEditor = (current: typeof order) => (
        <LocaleProvider initialLocale={locale}>
          <DiagnosisQuoteDialog {...props} order={current} />
        </LocaleProvider>
      );
      const view = render(renderEditor(order));
      const amount = screen.getByRole("textbox", {
        name: translateMessage(locale, "orders2b1.quote.itemAmount", { index: 1 }),
      });
      const balance = () =>
        screen.getByText(translateMessage(locale, "orders2b1.quote.balance"), { exact: true })
          .parentElement;
      const received = () =>
        screen.getByText(translateMessage(locale, "orders2b1.quote.received"), { exact: true })
          .parentElement;
      const publish = screen.getByRole("button", {
        name: translateMessage(locale, "orders2b1.quote.publish"),
      });
      expect(balance()).toHaveTextContent("€30.00");
      expect(received()).toHaveTextContent("€70.00");
      expect(
        screen.getByText(
          translateMessage(locale, "orders2b1.quote.receivedDeposit", { amount: "€20.00" }),
        ),
      ).toBeVisible();
      fireEvent.change(amount, { target: { value: "120" } });
      expect(balance()).toHaveTextContent("€50.00");
      expect(publish).toBeEnabled();
      fireEvent.change(amount, { target: { value: "69.99" } });
      expect(
        screen.getByText(translateMessage(locale, "orders2b1.quote.missing.received")),
      ).toBeVisible();
      expect(publish).toBeDisabled();
      fireEvent.click(publish);
      expect(onPublish).not.toHaveBeenCalled();
      fireEvent.change(amount, { target: { value: "70" } });
      expect(balance()).toHaveTextContent("€0.00");
      expect(publish).toBeEnabled();
      fireEvent.change(amount, { target: { value: "120" } });
      fireEvent.click(publish);
      await screen.findByText(translateMessage(locale, "orders2b1.quote.saveFailed"));
      const original = onPublish.mock.calls[0][0];
      expect(original).toMatchObject({
        expectedUpdatedAt: "2026-09-17T10:00:00.000Z",
        faultPrices: [{ line_id: "00000000-0000-4000-8000-000000000311", price: 120 }],
      });
      expect(Object.keys(original).sort()).toEqual(
        [
          "diagnosisResult",
          "expectedUpdatedAt",
          "faultPrices",
          "idempotencyKey",
          "priceException",
        ].sort(),
      );
      view.rerender(
        renderEditor({
          ...(order as object),
          updated_at: "2026-09-17T10:01:00.000Z",
          balance_amount: 10,
          deposit_amount: 30,
        } as never),
      );
      expect(received()).toHaveTextContent("€70.00");
      expect(balance()).toHaveTextContent("€50.00");
      expect(amount).toBeDisabled();
      fireEvent.click(publish);
      await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(2));
      expect(onPublish.mock.calls[1][0]).toEqual(original);
    },
  );

  it.each([
    { quotation: 100, deposit: 0, balance: 100, newQuote: 120, received: "€0.00", due: "€120.00" },
    { quotation: 100, deposit: 20, balance: 80, newQuote: 120, received: "€20.00", due: "€100.00" },
    { quotation: 100, deposit: 20, balance: 0, newQuote: 120, received: "€100.00", due: "€20.00" },
    {
      quotation: 100.3,
      deposit: 20.1,
      balance: 30,
      newQuote: 120.3,
      received: "€70.30",
      due: "€50.00",
    },
  ])(
    "previews receipts for zero, deposit-only, fully paid and decimal states: $received",
    ({ quotation, deposit, balance, newQuote, received, due }) => {
      render(
        <LocaleProvider initialLocale="en">
          <DiagnosisQuoteDialog
            open
            order={
              {
                id: "receipt-sample",
                updated_at: "2026-09-17T10:00:00.000Z",
                diagnosis_result: "Confirmed",
                quotation_amount: quotation,
                deposit_amount: deposit,
                balance_amount: balance,
                fault_prices: [{ name: "Repair", price: newQuote }],
              } as never
            }
            capabilities={{ canPrepareQuote: true } as never}
            onOpenChange={vi.fn()}
            onPublish={vi.fn()}
            onSaveDiagnosis={vi.fn()}
          />
        </LocaleProvider>,
      );
      expect(
        screen.getByText(translateMessage("en", "orders2b1.quote.received"), { exact: true })
          .parentElement,
      ).toHaveTextContent(received);
      expect(
        screen.getByText(translateMessage("en", "orders2b1.quote.balance"), { exact: true })
          .parentElement,
      ).toHaveTextContent(due);
    },
  );

  it("keeps the opening draft and version across query refreshes and protects dirty dismissal", async () => {
    const order = {
      id: "order-stable",
      updated_at: "2026-09-17T08:00:00.000Z",
      diagnosis_result: "Saved diagnosis",
      issue_description: "Synthetic issue",
      deposit_amount: 0,
      fault_prices: [
        { line_id: "00000000-0000-4000-8000-000000000311", name: "Screen", price: 120 },
      ],
    } as never;
    const onPublish = vi.fn();
    const onSaveDiagnosis = vi.fn();
    const onOpenChange = vi.fn();
    const renderEditor = (current: typeof order) => (
      <LocaleProvider initialLocale="en">
        <DiagnosisQuoteDialog
          open
          order={current}
          capabilities={{ canEditRepair: true, canPrepareQuote: true } as never}
          onOpenChange={onOpenChange}
          onSaveDiagnosis={onSaveDiagnosis}
          onPublish={onPublish}
        />
      </LocaleProvider>
    );
    const view = render(renderEditor(order));
    const diagnosis = screen.getByRole("textbox", {
      name: translateMessage("en", "orders2b1.quote.diagnosis"),
    });
    fireEvent.change(diagnosis, { target: { value: "Unsaved local diagnosis" } });
    view.rerender(renderEditor({ ...(order as object) } as never));
    expect(diagnosis).toHaveValue("Unsaved local diagnosis");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(document.querySelector("[data-editor-discard]")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: translateMessage("en", "orders.faultEditor.keep") }),
    );
    expect(diagnosis).toHaveValue("Unsaved local diagnosis");
    view.rerender(
      renderEditor({
        ...(order as object),
        updated_at: "2026-09-17T08:01:00.000Z",
        diagnosis_result: "Remote diagnosis",
      } as never),
    );
    expect(diagnosis).toHaveValue("Unsaved local diagnosis");
    expect(screen.getByRole("alert")).toHaveTextContent(
      translateMessage("en", "orders2b2.conflict.description"),
    );
    const publish = screen.getByRole("button", {
      name: translateMessage("en", "orders2b1.quote.publish"),
    });
    expect(publish).toBeDisabled();
    fireEvent.click(publish);
    expect(onPublish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: translateMessage("en", "orders.faultEditor.confirmDiscard"),
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sends one frozen version and keeps the same publish intent after a failed request and refresh", async () => {
    const order = {
      id: "order-retry",
      updated_at: "2026-09-17T08:00:00.000Z",
      diagnosis_result: "Diagnosis",
      issue_description: "Issue",
      deposit_amount: 0,
      fault_prices: [{ name: "Screen", price: 120 }],
    } as never;
    const onPublish = vi
      .fn()
      .mockRejectedValueOnce(new Error("synthetic failure"))
      .mockResolvedValueOnce({});
    const props = {
      open: true,
      order,
      capabilities: { canEditRepair: true, canPrepareQuote: true } as never,
      onOpenChange: vi.fn(),
      onSaveDiagnosis: vi.fn(),
      onPublish,
    };
    const view = render(
      <LocaleProvider initialLocale="en">
        <DiagnosisQuoteDialog {...props} />
      </LocaleProvider>,
    );
    const publish = screen.getByRole("button", {
      name: translateMessage("en", "orders2b1.quote.publish"),
    });
    fireEvent.click(publish);
    fireEvent.click(publish);
    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1));
    await screen.findByText(translateMessage("en", "orders2b1.quote.saveFailed"));
    const first = onPublish.mock.calls[0][0];
    expect(first.expectedUpdatedAt).toBe("2026-09-17T08:00:00.000Z");
    view.rerender(
      <LocaleProvider initialLocale="en">
        <DiagnosisQuoteDialog
          {...props}
          order={
            {
              ...(order as object),
              updated_at: "2026-09-17T08:01:00.000Z",
              diagnosis_result: "Remote diagnosis",
              fault_prices: [{ name: "Remote row", price: 240 }],
            } as never
          }
        />
      </LocaleProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: translateMessage("en", "orders2b1.quote.publish") }),
    );
    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(2));
    expect(onPublish.mock.calls[1][0]).toEqual(first);
    expect(props.onOpenChange).toHaveBeenCalledTimes(1);
  });

  it("retains correctable input after a definite business rejection and starts a new intent", async () => {
    const onPublish = vi
      .fn()
      .mockRejectedValueOnce(new RepairDeskApiError("synthetic validation", 422))
      .mockResolvedValueOnce({});
    render(
      <LocaleProvider initialLocale="en">
        <DiagnosisQuoteDialog
          open
          order={
            {
              id: "rejected-order",
              updated_at: "2026-09-17T08:00:00.000Z",
              diagnosis_result: "Diagnosis",
              deposit_amount: 0,
              fault_prices: [{ name: "Screen", price: 120 }],
            } as never
          }
          capabilities={{ canEditRepair: true, canPrepareQuote: true } as never}
          onOpenChange={vi.fn()}
          onSaveDiagnosis={vi.fn()}
          onPublish={onPublish}
        />
      </LocaleProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: translateMessage("en", "orders2b1.quote.publish") }),
    );
    await screen.findByText(translateMessage("en", "orders2b1.quote.rejectedHint"));
    const diagnosis = screen.getByRole("textbox", {
      name: translateMessage("en", "orders2b1.quote.diagnosis"),
    });
    expect(diagnosis).toBeEnabled();
    expect(diagnosis).toHaveValue("Diagnosis");
    fireEvent.change(diagnosis, { target: { value: "Corrected diagnosis" } });
    fireEvent.click(
      screen.getByRole("button", { name: translateMessage("en", "orders2b1.quote.publish") }),
    );
    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(2));
    expect(onPublish.mock.calls[1][0].idempotencyKey).not.toEqual(
      onPublish.mock.calls[0][0].idempotencyKey,
    );
    expect(onPublish.mock.calls[1][0].diagnosisResult).toBe("Corrected diagnosis");
    expect(onPublish.mock.calls[1][0].faultPrices).toEqual(onPublish.mock.calls[0][0].faultPrices);
  });

  it("preserves an unresolved intent and blocks replay when the target order changes", async () => {
    const onPublish = vi.fn().mockRejectedValue(new Error("Response lost"));
    const order = {
      id: "original-order",
      updated_at: "2026-09-17T08:00:00.000Z",
      diagnosis_result: "Original diagnosis",
      deposit_amount: 0,
      fault_prices: [{ name: "Screen", price: 120 }],
    } as never;
    const renderEditor = (current: typeof order) => (
      <LocaleProvider initialLocale="en">
        <DiagnosisQuoteDialog
          open
          order={current}
          capabilities={{ canEditRepair: true, canPrepareQuote: true } as never}
          onOpenChange={vi.fn()}
          onSaveDiagnosis={vi.fn()}
          onPublish={onPublish}
        />
      </LocaleProvider>
    );
    const view = render(renderEditor(order));
    fireEvent.click(
      screen.getByRole("button", { name: translateMessage("en", "orders2b1.quote.publish") }),
    );
    await screen.findByText(translateMessage("en", "orders2b1.quote.saveFailed"));
    view.rerender(
      renderEditor({
        ...(order as object),
        id: "different-order",
        diagnosis_result: "Different diagnosis",
      } as never),
    );
    expect(
      screen.getByRole("textbox", { name: translateMessage("en", "orders2b1.quote.diagnosis") }),
    ).toHaveValue("Original diagnosis");
    const publish = screen.getByRole("button", {
      name: translateMessage("en", "orders2b1.quote.publish"),
    });
    expect(publish).toBeDisabled();
    fireEvent.click(publish);
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

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
                id: "synthetic-order",
                updated_at: "2026-09-17T08:00:00.000Z",
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
      expect(onSaveDiagnosis).toHaveBeenLastCalledWith("动态中文诊断", "2026-09-17T08:00:00.000Z");
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
                id: "synthetic-order",
                updated_at: "2026-09-17T08:00:00.000Z",
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
                id: "synthetic-order",
                updated_at: "2026-09-17T08:00:00.000Z",
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
                id: "synthetic-order",
                updated_at: "2026-09-17T08:00:00.000Z",
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
