import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatOrderDateTime } from "@/features/orders/model/order-date";
import { fallbackOrderWorkflow } from "@/features/orders/model/order-workflow";
import { orders } from "@/lib/mock/fixtures";
import type { OrderDetail } from "@/lib/repairdesk/api";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

import { OrderOverviewTab } from "./order-overview-tab";

vi.mock("@/features/orders/components/device-unlock-fields", () => ({
  DeviceUnlockEditor: () => null,
  DeviceUnlockViewer: () => null,
}));

afterEach(cleanup);

const locales = ["zh-CN", "it-IT", "en"] as const;
const eventSentinel = "HISTORY_REASON_动态哨兵";
const customerSentinel = "CUSTOMER_动态中文";
const deviceSentinel = "DEVICE_动态中文";

function makeOrder(): OrderDetail["order"] {
  return {
    ...orders[0]!,
    status: "repairing",
    workflow_status: "repair",
    customer_name: customerSentinel,
    customer_phone: "+393335719865",
    contact_phones: ["+393335719865"],
    device_label: deviceSentinel,
    device_imei: "490154203237518",
    device_snapshot: {
      brand: "BRAND_动态",
      model: deviceSentinel,
      serial_or_imei: "490154203237518",
      device_notes: "DEVICE_NOTE_动态",
    },
    issue_description: "ISSUE_动态中文",
    diagnosis_result: "DIAGNOSIS_动态中文",
    accessory_notes: "ACCESSORY_动态中文",
    created_at: "2026-09-02T08:15:00.000Z",
    updated_at: "2026-09-02T10:01:00.000Z",
    finance_redacted: false,
    approval_overdue: false,
    pickup_overdue: false,
  };
}

describe("OrderOverviewTab localized runtime", () => {
  it("keeps the existing diagnosis action when finance is redacted", () => {
    const { container } = render(
      <LocaleProvider initialLocale="zh-CN">
        <OrderOverviewTab
          order={{ ...makeOrder(), finance_redacted: true }}
          deviceBrand="Samsung"
          deviceModel="Galaxy A54"
          deviceImei="490154203237518"
          canEditRepair
          quoteAction={<button type="button">Open diagnosis record</button>}
          surface="dialog"
        />
      </LocaleProvider>,
    );
    expect(screen.getByRole("button", { name: "Open diagnosis record" })).toBeVisible();
    expect(container.querySelector("[data-order-workbench-money-summary]")).toBeNull();
    expect(container.querySelector("[data-order-workbench-repairs]")).toBeNull();
  });

  it.each(locales)(
    "renders real overview fixed chrome while preserving dynamic payload in %s",
    (locale) => {
      const order = makeOrder();
      const events: OrderDetail["events"] = [
        {
          id: "event-1",
          order_id: order.id,
          event_type: "status_changed",
          payload: { from: "created", to: "repairing", reason: eventSentinel },
          operator_name: "OPERATOR_动态中文",
          created_at: "2026-09-02T09:15:00.000Z",
        },
      ];

      render(
        <LocaleProvider initialLocale={locale}>
          <OrderOverviewTab
            order={order}
            deviceBrand="BRAND_动态"
            deviceModel={deviceSentinel}
            deviceImei="490154203237518"
            deviceNotes="DEVICE_NOTE_动态"
            accessoryNotes="ACCESSORY_动态中文"
            events={events}
            workflow={fallbackOrderWorkflow}
            surface="dialog"
          />
        </LocaleProvider>,
      );

      expect(
        screen.getByText(translateMessage(locale, "orders2b2.overview.customerInfo")),
      ).toBeVisible();
      expect(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b2.overview.deviceIssue"),
        }),
      ).toBeVisible();
      expect(screen.getByText(translateMessage(locale, "orders2b2.finance.total"))).toBeVisible();
      expect(screen.getByText(customerSentinel)).toBeVisible();
      expect(screen.getByText(deviceSentinel)).toBeVisible();
      const recordsSummary = screen.getByText(
        translateMessage(locale, "orders2b2.overview.recordsSummary"),
        { selector: "summary" },
      );
      fireEvent.click(recordsSummary);
      const records = within(recordsSummary.closest("details")!);
      expect(records.getByText(eventSentinel, { exact: false })).toBeVisible();
      expect(records.getByText("OPERATOR_动态中文", { exact: false })).toBeVisible();
      expect(
        records.getByText(formatOrderDateTime(events[0]!.created_at, locale), { exact: false }),
      ).toBeVisible();
    },
  );
});
