import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CustomerDeviceCard,
  CustomerOrderRow,
  CustomerWorkbenchOrderRow,
} from "@/features/customers/components/customer-profile-blocks";
import { CustomerDeviceSheet } from "@/features/customers/components/customer-device-sheet";
import type {
  CustomerDeviceWorkbenchItem,
  CustomerOrderWorkbenchItem,
} from "@/features/customers/model/customer-workbench";
import type { OrderListItem } from "@/lib/repairdesk/api";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

const item: CustomerDeviceWorkbenchItem = {
  device: {
    id: "device-dynamic",
    customer_id: "customer-dynamic",
    brand: "动态品牌 Ω",
    model: "动态型号 Ω",
    serial_or_imei: "359999999999991",
    device_notes: "动态设备备注 Ω",
  },
  orderItems: [],
  historyPreviewItems: [],
  repairCount: 0,
  activeOrderCount: 0,
  totalQuoted: 0,
  unpaidAmount: 0,
  financeRedacted: false,
  warranty: { kind: "none" },
  warrantyLabel: "暂无售后记录",
  canDelete: true,
};

describe("CustomerDeviceCard keyboard boundaries", () => {
  it.each([
    ["zh-CN", "completed", false, "orders.workflowClosed"],
    ["it-IT", "completed", false, "orders.workflowClosed"],
    ["en", "completed", false, "orders.workflowClosed"],
    ["zh-CN", "repairing", true, "orders.cancelled"],
    ["it-IT", "repairing", true, "orders.cancelled"],
    ["en", "repairing", true, "orders.cancelled"],
    ["zh-CN", "repairing", false, "orders.workflowRepair"],
    ["it-IT", "repairing", false, "orders.workflowRepair"],
    ["en", "repairing", false, "orders.workflowRepair"],
  ] as const)(
    "renders stable customer order status %s/%s/cancelled=%s without raw status chrome",
    (locale, status, cancelled, expectedKey) => {
      const order = buildOrder(status, cancelled);
      const item: CustomerOrderWorkbenchItem = {
        order,
        deviceLabel: "Dynamic Device",
        deviceImei: "490154203237518",
        state: status === "completed" || cancelled ? "closed" : "active",
        financeRedacted: true,
      };
      render(
        <LocaleProvider initialLocale={locale}>
          <CustomerOrderRow order={order} onFollowup={vi.fn()} />
          <CustomerWorkbenchOrderRow item={item} />
        </LocaleProvider>,
      );

      expect(screen.getAllByText(translateMessage(locale, expectedKey))).toHaveLength(2);
      if (locale !== "zh-CN") {
        expect(screen.queryByText("已完成")).not.toBeInTheDocument();
        expect(screen.queryByText("已取消")).not.toBeInTheDocument();
        expect(screen.queryByText(status)).not.toBeInTheDocument();
      }
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "keeps child Link and Button keyboard activation from opening the device sheet in %s",
    (locale) => {
      const onOpen = vi.fn();
      const onEdit = vi.fn();
      render(
        <LocaleProvider initialLocale={locale}>
          <CustomerDeviceCard
            item={item}
            customerId="customer-dynamic"
            deleting={false}
            onOpen={onOpen}
            onEdit={onEdit}
            onDelete={vi.fn()}
          />
        </LocaleProvider>,
      );

      const newOrder = screen.getByRole("link", {
        name: translateMessage(locale, "customers.detail.newOrder"),
      });
      const edit = screen.getByRole("button", {
        name: translateMessage(locale, "customers.detail.editShort"),
      });
      fireEvent.keyDown(newOrder, { key: "Enter" });
      fireEvent.keyDown(newOrder, { key: " " });
      fireEvent.keyDown(edit, { key: "Enter" });
      fireEvent.keyDown(edit, { key: " " });
      expect(onOpen).not.toHaveBeenCalled();

      fireEvent.click(edit);
      expect(onEdit).toHaveBeenCalledOnce();
      expect(onEdit).toHaveBeenCalledWith(edit);
      expect(onOpen).not.toHaveBeenCalled();

      fireEvent.keyDown(
        screen.getByRole("button", {
          name: translateMessage(locale, "customers.detail.viewDevice", {
            brand: "动态品牌 Ω",
            model: "动态型号 Ω",
          }),
        }),
        { key: "Enter" },
      );
      expect(onOpen).toHaveBeenCalledOnce();
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "localizes device sheet chrome while preserving device data in %s",
    (locale) => {
      const onEdit = vi.fn();
      render(
        <LocaleProvider initialLocale={locale}>
          <CustomerDeviceSheet
            item={item}
            customerId="customer-dynamic"
            open
            deleting={false}
            onOpenChange={vi.fn()}
            onEdit={onEdit}
            onDelete={vi.fn()}
          />
        </LocaleProvider>,
      );

      expect(screen.getByRole("dialog", { name: "动态品牌 Ω 动态型号 Ω" })).toBeVisible();
      expect(screen.getByText("动态设备备注 Ω")).toBeVisible();
      expect(
        screen.getByText(translateMessage(locale, "customers.detail.noLinkedOrdersAction")),
      ).toBeVisible();
      expect(
        screen.getByRole("button", { name: translateMessage(locale, "customers.detail.close") }),
      ).toBeVisible();
      const edit = screen.getByRole("button", {
        name: translateMessage(locale, "customers.detail.editShort"),
      });
      fireEvent.click(edit);
      expect(onEdit).toHaveBeenCalledWith(item.device, edit);
    },
  );

  it.each([
    ["zh-CN", "completed", false, "orders.workflowClosed"],
    ["it-IT", "completed", false, "orders.workflowClosed"],
    ["en", "completed", false, "orders.workflowClosed"],
    ["zh-CN", "repairing", true, "orders.cancelled"],
    ["it-IT", "repairing", true, "orders.cancelled"],
    ["en", "repairing", true, "orders.cancelled"],
    ["zh-CN", "repairing", false, "orders.workflowRepair"],
    ["it-IT", "repairing", false, "orders.workflowRepair"],
    ["en", "repairing", false, "orders.workflowRepair"],
  ] as const)(
    "localizes device history status %s/%s/cancelled=%s",
    (locale, status, cancelled, expectedKey) => {
      renderDeviceSheet(locale, buildDeviceSheetItem(status, cancelled));
      expect(screen.getByText(translateMessage(locale, expectedKey))).toBeVisible();
      if (locale !== "zh-CN") {
        expect(screen.queryByText("已结案")).not.toBeInTheDocument();
        expect(screen.queryByText("作废")).not.toBeInTheDocument();
        expect(screen.queryByText(status)).not.toBeInTheDocument();
      }
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "preserves an unknown custom device history status in %s",
    (locale) => {
      renderDeviceSheet(locale, buildDeviceSheetItem("custom_status_omega", false));
      expect(screen.getByText("custom_status_omega")).toBeVisible();
    },
  );
});

function renderDeviceSheet(
  locale: "zh-CN" | "it-IT" | "en",
  sheetItem: CustomerDeviceWorkbenchItem,
) {
  return render(
    <LocaleProvider initialLocale={locale}>
      <CustomerDeviceSheet
        item={sheetItem}
        customerId="customer-dynamic"
        open
        deleting={false}
        onOpenChange={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    </LocaleProvider>,
  );
}

function buildDeviceSheetItem(status: string, cancelled: boolean): CustomerDeviceWorkbenchItem {
  const order = buildOrder(status, cancelled);
  const orderItem: CustomerOrderWorkbenchItem = {
    order,
    device: item.device,
    deviceLabel: `${item.device.brand} ${item.device.model}`,
    deviceImei: item.device.serial_or_imei ?? "",
    state: status === "completed" || cancelled ? "closed" : "active",
    financeRedacted: true,
  };
  return {
    ...item,
    orderItems: [orderItem],
    historyPreviewItems: [orderItem],
    latestOrder: orderItem,
    repairCount: 1,
    activeOrderCount: orderItem.state === "active" ? 1 : 0,
    financeRedacted: true,
    canDelete: false,
    deleteBlockedReasonKind: "has_order_history",
    deleteBlockedReason: "Dynamic preserved reason",
  };
}

function buildOrder(status: string, cancelled: boolean): OrderListItem {
  return {
    id: `order-${status}-${cancelled}`,
    public_no: "R-STATUS",
    order_type: "dropoff_repair",
    status,
    record_state: cancelled ? "voided" : "active",
    customer_id: "customer-dynamic",
    customer_name_snapshot: "Dynamic Customer",
    customer_phone_snapshot: "+393330001122",
    device_id: "device-dynamic",
    issue_description: "Dynamic issue",
    quotation_amount: 10,
    deposit_amount: 0,
    balance_amount: 10,
    currency_code: "EUR",
    is_paid: false,
    approval_status: "approved",
    technician_name: "Dynamic operator",
    contact_phones: [],
    fault_prices: [],
    device_custody_status: "with_shop",
    created_at: "2026-09-01T08:00:00.000Z",
    updated_at: "2026-09-02T08:00:00.000Z",
    customer_name: "Dynamic Customer",
    customer_phone: "+393330001122",
    device_label: "Dynamic Device",
    device_imei: "490154203237518",
    approval_overdue: false,
    pickup_overdue: false,
  };
}
