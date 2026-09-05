import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { orders } from "@/lib/mock/fixtures";
import type { OrderDetail } from "@/lib/repairdesk/api";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

import { OrderHero } from "./order-hero";

const toastMocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("sonner", () => ({ toast: toastMocks }));

beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => undefined;
  }
});

beforeEach(() => {
  toastMocks.error.mockReset();
  toastMocks.success.mockReset();
});

afterEach(cleanup);

const locales = ["zh-CN", "it-IT", "en"] as const;

const order = {
  ...orders[0]!,
  customer_name: "CUSTOMER_动态",
  customer_phone: "+393335719865",
  device_label: "DEVICE_动态",
  device_imei: "490154203237518",
  finance_redacted: false,
  approval_overdue: false,
  pickup_overdue: false,
} as OrderDetail["order"];

describe("OrderHero", () => {
  it("maps completed legacy status to the final mini segment without danger styling", () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <OrderHero
          order={{ ...order, status: "completed", workflow_status: undefined }}
          onPrint={vi.fn()}
          onCancel={vi.fn()}
          onSaveEdit={vi.fn()}
          onCancelEdit={vi.fn()}
        />
      </LocaleProvider>,
    );

    const progress = container.querySelector('[data-order-mini-progress="true"]');
    expect(progress).toBeTruthy();
    expect(progress?.querySelectorAll("[data-order-mini-progress-segment]")).toHaveLength(5);
    expect(progress?.querySelector('[data-order-mini-progress-segment="4"]')).toHaveClass(
      "bg-primary",
    );
    expect(progress?.querySelector('[data-order-mini-progress-segment="4"]')).not.toHaveClass(
      "bg-status-danger-foreground",
    );
  });

  it("maps cancelled orders to a terminal mini segment with danger styling", () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <OrderHero
          order={{ ...order, status: "cancelled", workflow_status: undefined }}
          onPrint={vi.fn()}
          onCancel={vi.fn()}
          onSaveEdit={vi.fn()}
          onCancelEdit={vi.fn()}
        />
      </LocaleProvider>,
    );

    const progress = container.querySelector('[data-order-mini-progress="true"]');
    expect(progress?.querySelector('[data-order-mini-progress-segment="4"]')).toHaveClass(
      "bg-status-danger-foreground",
    );
  });

  it.each(locales)(
    "consumes clipboard rejection and shows a safe localized error in %s",
    async (locale) => {
      const user = userEvent.setup();
      const providerSentinel = "CLIPBOARD_PROVIDER_SECRET";
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: vi.fn().mockRejectedValue(new Error(providerSentinel)) },
      });

      render(
        <LocaleProvider initialLocale={locale}>
          <OrderHero
            order={order}
            onPrint={vi.fn()}
            onCancel={vi.fn()}
            onSaveEdit={vi.fn()}
            onCancelEdit={vi.fn()}
            surface="dialog"
          />
        </LocaleProvider>,
      );

      await user.click(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b2.hero.more") }),
      );
      await user.click(
        await screen.findByRole("menuitem", {
          name: translateMessage(locale, "orders2b2.hero.copyLink"),
        }),
      );

      await waitFor(() =>
        expect(toastMocks.error).toHaveBeenCalledWith(
          translateMessage(locale, "orders2b2.hero.copyFailed"),
        ),
      );
      expect(JSON.stringify(toastMocks.error.mock.calls)).not.toContain(providerSentinel);
    },
  );
});
