import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

import { PhoneContactMenu } from "./order-contact-menu";

const mocks = vi.hoisted(() => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

afterEach(cleanup);

describe("PhoneContactMenu i18n", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("CLIPBOARD_SECRET_SENTINEL")) },
    });
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "keeps the dynamic phone intact and safely localizes a %s clipboard rejection",
    async (locale) => {
      render(
        <LocaleProvider initialLocale={locale}>
          <PhoneContactMenu phone="+39 333 571 9865" />
        </LocaleProvider>,
      );

      fireEvent.click(screen.getByTitle(translateMessage(locale, "orders2b2.contact.title")));
      const copy = await screen.findByRole("button", {
        name: translateMessage(locale, "orders2b2.contact.copy"),
      });
      fireEvent.click(copy);

      await waitFor(() =>
        expect(mocks.toastError).toHaveBeenCalledWith(
          translateMessage(locale, "orders2b2.contact.copyFailed"),
        ),
      );
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("+39 333 571 9865");
      expect(JSON.stringify(mocks.toastError.mock.calls)).not.toContain(
        "CLIPBOARD_SECRET_SENTINEL",
      );
    },
  );
});
