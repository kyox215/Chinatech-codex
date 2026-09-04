import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getDefaultOrderTransitionReason } from "@/features/orders/model/order-transition-reasons";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

import { CancelDialog } from "./cancel-dialog";

const locales = ["zh-CN", "it-IT", "en"] as const;

afterEach(cleanup);

describe("CancelDialog i18n", () => {
  it.each(locales)(
    "contains a rejected %s confirmation and preserves the open canonical draft",
    async (locale) => {
      const onOpenChange = vi.fn();
      const onConfirm = vi.fn().mockRejectedValue(new Error("CANCEL_SECRET_SENTINEL"));
      render(
        <LocaleProvider initialLocale={locale}>
          <CancelDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />
        </LocaleProvider>,
      );

      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b2.cancel.confirm") }),
      );

      await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
      expect(onConfirm).toHaveBeenCalledWith(getDefaultOrderTransitionReason("cancelled"));
      await waitFor(() =>
        expect(
          screen.getByRole("button", {
            name: translateMessage(locale, "orders2b2.cancel.confirm"),
          }),
        ).toBeEnabled(),
      );
      expect(
        screen.getByRole("heading", { name: translateMessage(locale, "orders2b2.cancel.title") }),
      ).toBeVisible();
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
      expect(screen.queryByText("CANCEL_SECRET_SENTINEL")).not.toBeInTheDocument();
    },
  );
});
