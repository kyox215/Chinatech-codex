import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatCurrency } from "@/shared/i18n/format";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

import { PaymentDialog } from "./payment-dialog";

const locales = ["zh-CN", "it-IT", "en"] as const;

afterEach(cleanup);

describe("PaymentDialog i18n", () => {
  it("localizes presentation while keeping canonical payment values in every locale", async () => {
    const calls: unknown[][] = [];

    for (const locale of locales) {
      const onPay = vi.fn().mockResolvedValue(undefined);
      const view = renderPayment(locale, onPay);

      expect(
        screen.getByRole("heading", {
          name: translateMessage(locale, "orders2b2.payment.title"),
        }),
      ).toBeVisible();
      expect(screen.getAllByText(formatCurrency(123.45, locale)).length).toBeGreaterThan(0);

      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b2.payment.card"),
        }),
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b2.payment.confirm", {
            method: translateMessage(locale, "orders2b2.payment.card"),
          }),
        }),
      );

      await waitFor(() => expect(onPay).toHaveBeenCalledOnce());
      expect(onPay.mock.calls[0]?.[0]).toBe(123.45);
      expect(onPay.mock.calls[0]?.[1]).toBe("刷卡");
      expect(onPay.mock.calls[0]?.[2]).toEqual(expect.any(String));
      calls.push([onPay.mock.calls[0]?.[0], onPay.mock.calls[0]?.[1]]);
      view.unmount();
    }

    expect(calls[1]).toEqual(calls[0]);
    expect(calls[2]).toEqual(calls[0]);
  });

  it("reuses one idempotency key and shows only a safe localized error on retry", async () => {
    const onPay = vi
      .fn()
      .mockRejectedValueOnce(new Error("PAYMENT_SECRET_SENTINEL"))
      .mockResolvedValueOnce(undefined);
    renderPayment("it-IT", onPay);

    const confirm = screen.getByRole("button", {
      name: translateMessage("it-IT", "orders2b2.payment.confirm", {
        method: translateMessage("it-IT", "orders2b2.payment.cash"),
      }),
    });
    fireEvent.click(confirm);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      translateMessage("it-IT", "orders2b2.error.generic", {
        operation: translateMessage("it-IT", "orders2b2.operation.payment"),
      }),
    );
    expect(screen.queryByText("PAYMENT_SECRET_SENTINEL")).not.toBeInTheDocument();

    fireEvent.click(confirm);
    await waitFor(() => expect(onPay).toHaveBeenCalledTimes(2));
    expect(onPay.mock.calls[1]?.[2]).toBe(onPay.mock.calls[0]?.[2]);
    expect(onPay.mock.calls[1]?.slice(0, 2)).toEqual(onPay.mock.calls[0]?.slice(0, 2));
  });
});

function renderPayment(
  locale: (typeof locales)[number],
  onPay: (amount: number, method: string, idempotencyKey: string) => Promise<void>,
) {
  return render(
    <LocaleProvider initialLocale={locale}>
      <PaymentDialog open onOpenChange={vi.fn()} balance={123.45} onPay={onPay} />
    </LocaleProvider>,
  );
}
