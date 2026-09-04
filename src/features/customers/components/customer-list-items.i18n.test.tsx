import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CustomerMobileCard,
  CustomerRow,
} from "@/features/customers/components/customer-list-items";
import { CustomerStatusBadges } from "@/features/customers/components/customer-status-badges";
import type { CustomerListItem } from "@/lib/repairdesk/types";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

const customer: CustomerListItem = {
  id: "customer/动态 Ω",
  name: "动态中文客户 Ω",
  phone_e164: "+393330001122",
  phone_raw: "3330001122",
  contact_phones: [],
  consent_marketing: true,
  consent_sms: true,
  email: "dynamic@example.invalid",
  tags: [{ id: "custom-tag", name: "动态标签 Ω", color: "#123456" }],
  device_count: 2,
  order_count: 4,
  valid_order_count: 4,
  active_order_count: 2,
  lifetime_quoted_amount: 180,
  outstanding_amount: 60,
  latest_device_label: "华为 Mate 自定义 Ω",
};

describe("customer list items i18n", () => {
  it.each(["zh-CN", "it-IT", "en"] as const)(
    "localizes row and card chrome while preserving dynamic values in %s",
    (locale) => {
      const { unmount } = render(
        <LocaleProvider initialLocale={locale}>
          <table>
            <tbody>
              <CustomerRow customer={customer} />
            </tbody>
          </table>
        </LocaleProvider>,
      );

      expect(screen.getByText(customer.name)).toBeVisible();
      expect(screen.getByText(customer.latest_device_label!)).toBeVisible();
      expect(screen.getByText("动态标签 Ω")).toBeVisible();
      expect(
        screen.getByRole("link", {
          name: translateMessage(locale, "customers.list.viewCustomer", { name: customer.name }),
        }),
      ).toHaveAttribute("href", "/customers/customer%2F%E5%8A%A8%E6%80%81%20%CE%A9");
      expect(
        screen.getByText(translateMessage(locale, "customers.summary.activeAction")),
      ).toBeVisible();
      unmount();

      render(
        <LocaleProvider initialLocale={locale}>
          <CustomerMobileCard customer={customer} />
        </LocaleProvider>,
      );
      const card = screen.getByRole("link", {
        name: translateMessage(locale, "customers.list.openCustomer", { name: customer.name }),
      });
      expect(card).toHaveClass("min-h-11");
      expect(within(card).getByText(customer.name)).toBeVisible();
      expect(within(card).getByText(customer.latest_device_label!)).toBeVisible();
      if (locale !== "zh-CN") {
        expect(within(card).queryByText("跟进维修进度")).not.toBeInTheDocument();
      }
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "localizes stable repair and redacted payment badges in %s",
    (locale) => {
      render(
        <LocaleProvider initialLocale={locale}>
          <CustomerStatusBadges
            customer={{
              active_order_count: 2,
              outstanding_amount: 60,
              unpaid_amount: 60,
              finance_redacted: true,
            }}
          />
        </LocaleProvider>,
      );
      expect(
        screen.getByText(translateMessage(locale, "customers.repair.active", { count: 2 })),
      ).toBeVisible();
      expect(
        screen.getByText(translateMessage(locale, "customers.payment.redacted")),
      ).toBeVisible();
    },
  );
});
