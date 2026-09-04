import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";

import { NewOrderDialog } from "./new-order-dialog";

vi.mock("@/features/orders/screens/new-order-screen", async () => {
  await new Promise((resolve) => setTimeout(resolve, 250));
  return {
    NewOrderScreen: ({
      onCancel,
      onCreated,
    }: {
      onCancel: () => void;
      onCreated: (id: string) => void;
    }) => (
      <div data-testid="new-order-screen-stub">
        <button type="button" onClick={onCancel}>
          stub cancel
        </button>
        <button type="button" onClick={() => onCreated("order-1")}>
          stub created
        </button>
      </div>
    ),
  };
});

function renderDialog(locale: AppLocale, onOpenChange = vi.fn(), onCreated = vi.fn()) {
  render(
    <LocaleProvider initialLocale={locale}>
      <NewOrderDialog open sessionKey={1} onOpenChange={onOpenChange} onCreated={onCreated} />
    </LocaleProvider>,
  );
  return { onOpenChange, onCreated };
}

describe("NewOrderDialog i18n", () => {
  it("localizes the Suspense loading status without changing lazy loading", () => {
    renderDialog("en");

    expect(screen.getByText(translateMessage("en", "orders2b1.new.dialogLoading"))).toHaveAttribute(
      "role",
      "status",
    );
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "provides localized accessible dialog metadata and preserves callbacks in %s",
    async (locale) => {
      const { onOpenChange, onCreated } = renderDialog(locale);
      const dialog = screen.getByRole("dialog", {
        name: translateMessage(locale, "orders2b1.new.title"),
      });

      expect(dialog).toHaveAccessibleDescription(
        translateMessage(locale, "orders2b1.new.dialogDescription"),
      );

      fireEvent.click(await screen.findByRole("button", { name: "stub cancel" }));
      expect(onOpenChange).toHaveBeenCalledWith(false);

      fireEvent.click(screen.getByRole("button", { name: "stub created" }));
      expect(onCreated).toHaveBeenCalledWith("order-1");
    },
  );
});
