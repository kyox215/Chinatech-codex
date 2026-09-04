import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getInventoryProduct: vi.fn(),
  searchCustomers: vi.fn(),
  readInventoryLifecycleAfterSalesQueue: vi.fn(),
  readInventoryLifecycleAfterSalesCase: vi.fn(),
  readInventoryLifecycleSale: vi.fn(),
  readInventoryLifecycleSummary: vi.fn(),
  runInventoryLifecycleCommand: vi.fn(),
}));
const shellMocks = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const routerMocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  getInventoryProduct: apiMocks.getInventoryProduct,
  searchCustomers: apiMocks.searchCustomers,
  readInventoryLifecycleAfterSalesQueue: apiMocks.readInventoryLifecycleAfterSalesQueue,
  readInventoryLifecycleAfterSalesCase: apiMocks.readInventoryLifecycleAfterSalesCase,
  readInventoryLifecycleSale: apiMocks.readInventoryLifecycleSale,
  readInventoryLifecycleSummary: apiMocks.readInventoryLifecycleSummary,
  runInventoryLifecycleCommand: apiMocks.runInventoryLifecycleCommand,
}));
vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: () => shellMocks.value,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => routerMocks,
}));

import { InventoryLifecycleReservationScreen } from "./inventory-lifecycle-reservation-screen";
import { InventoryLifecycleSaleScreen } from "./inventory-lifecycle-sale-screen";
import { InventoryLifecycleReadonlyScreen } from "./inventory-lifecycle-readonly-screen";
import {
  InventoryLifecycleAfterSalesCaseScreen,
  InventoryLifecycleAfterSalesQueueScreen,
} from "./inventory-lifecycle-after-sales-screen";
import { InventoryDeviceHealthCard } from "../components/inventory-lifecycle-status";
import { InventoryInspectionEditor } from "../forms/inventory-inspection-editor";
import {
  formatInventoryReservationDateTimeLocal,
  InventoryReservationForm,
  parseInventoryReservationDateTimeLocal,
} from "../forms/inventory-reservation-form";
import { inventoryLifecycleKeys } from "../api/query-keys";
import { formatInventoryLifecycleMoney } from "../model/inventory-lifecycle-i18n";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";

beforeEach(() => {
  vi.clearAllMocks();
  shellMocks.value = shellContext();
  apiMocks.getInventoryProduct.mockResolvedValue(productFixture);
  apiMocks.readInventoryLifecycleSummary.mockResolvedValue(summaryFixture);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("inventory lifecycle UI safety gates", () => {
  it("parses reservation wall times in Europe/Rome independently from the host time zone", () => {
    expect(parseInventoryReservationDateTimeLocal("2026-03-29T02:30")).toBeUndefined();
    expect(parseInventoryReservationDateTimeLocal("2026-10-25T02:30")).toBeUndefined();
    expect(parseInventoryReservationDateTimeLocal("2099-08-20T12:00")?.toISOString()).toBe(
      "2099-08-20T10:00:00.000Z",
    );
    expect(parseInventoryReservationDateTimeLocal("2026-02-30T12:00")).toBeUndefined();
    expect(formatInventoryReservationDateTimeLocal(new Date("2026-10-25T01:30:00.000Z"))).toBe(
      "2026-10-25T02:30",
    );
    expect(formatInventoryReservationDateTimeLocal(new Date("invalid"))).toBe("");
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "rejects an ambiguous Europe/Rome reservation time without writing in %s",
    async (locale) => {
      apiMocks.searchCustomers.mockResolvedValue([
        { id: "customer-canonical", name: "Dynamic Customer", phone_e164: "+390000000000" },
      ]);
      renderWithQuery(
        <LocaleProvider initialLocale={locale}>
          <InventoryReservationForm
            summary={{
              ...summaryFixture,
              allowed_actions: ["reservation.create"],
              unit_version: 2,
            }}
            storeId="store-1"
            defaultPrice={799}
            onSuccess={vi.fn()}
          />
        </LocaleProvider>,
      );

      const user = userEvent.setup();
      await user.type(
        screen.getByRole("combobox", {
          name: new RegExp(translateMessage(locale, "inventory2b4.reservation.customer")),
        }),
        "Dynamic",
      );
      await user.click(await screen.findByRole("option", { name: /Dynamic Customer/ }));
      await user.type(
        screen.getByRole("textbox", {
          name: new RegExp(translateMessage(locale, "inventory2b4.reservation.noDepositReason")),
        }),
        "CANONICAL NO DEPOSIT",
      );
      const expiry = document.getElementById("reservation-expires")!;
      const pickup = document.getElementById("reservation-pickup")!;
      fireEvent.change(expiry, { target: { value: "2026-10-25T02:30" } });
      fireEvent.change(pickup, { target: { value: "2026-10-24T12:00" } });
      await user.type(
        screen.getByRole("textbox", {
          name: new RegExp(translateMessage(locale, "inventory2b4.reservation.noDepositReason")),
        }),
        " EXTRA",
      );
      expect(expiry).toHaveValue("2026-10-25T02:30");
      expect(pickup).toHaveValue("2026-10-24T12:00");
      const submit = screen.getByRole("button", {
        name: translateMessage(locale, "inventory2b4.reservation.submit"),
      });
      expect(submit).toBeEnabled();
      await act(async () => {
        fireEvent.submit(submit.closest("form")!);
      });

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        translateMessage(locale, "inventory2b4.reservation.validation.expiry"),
      );
      expect(alert).toHaveFocus();
      await user.click(
        screen.getByRole("button", {
          name: new RegExp(translateMessage(locale, "inventory2b4.reservation.expiresAt")),
        }),
      );
      expect(document.getElementById("reservation-expires")).toHaveFocus();
      expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    },
  );

  it("keeps reservation.create canonical while localizing the real form in all employee locales", async () => {
    const payloads: unknown[] = [];
    const labels: Record<AppLocale, string> = {
      "zh-CN": "确认预订",
      "it-IT": "Conferma prenotazione",
      en: "Confirm reservation",
    };

    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      apiMocks.searchCustomers.mockResolvedValue([
        { id: "customer-canonical", name: "Dynamic Customer", phone_e164: "+390000000000" },
      ]);
      apiMocks.runInventoryLifecycleCommand.mockResolvedValue({ ok: true, code: "created" });
      renderWithQuery(
        <LocaleProvider initialLocale={locale}>
          <InventoryReservationForm
            summary={{
              ...summaryFixture,
              allowed_actions: ["reservation.create"],
              unit_version: 2,
            }}
            storeId="store-1"
            defaultPrice={799}
            onSuccess={vi.fn()}
          />
        </LocaleProvider>,
      );

      const customerSearch = screen.getByRole("combobox", {
        name: new RegExp(translateMessage(locale, "inventory2b4.reservation.customer")),
      });
      const user = userEvent.setup();
      await user.type(customerSearch, "Dynamic");
      const customerOption = await screen.findByRole("option", { name: /Dynamic Customer/ });
      await user.keyboard("{ArrowDown}");
      expect(customerOption).toHaveFocus();
      await user.keyboard("{Enter}");
      await user.type(
        screen.getByRole("textbox", {
          name: new RegExp(translateMessage(locale, "inventory2b4.reservation.noDepositReason")),
        }),
        "CANONICAL NO DEPOSIT",
      );
      fireEvent.change(document.getElementById("reservation-expires")!, {
        target: { value: "2099-08-20T12:00" },
      });
      fireEvent.change(document.getElementById("reservation-pickup")!, {
        target: { value: "2099-08-15T12:00" },
      });
      await user.click(screen.getByRole("button", { name: labels[locale] }));
      await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
      const input = apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0];
      payloads.push({ ...input, idempotency_key: "<uuid>" });
      expect(input.idempotency_key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(screen.getByText("Dynamic Customer")).toBeVisible();
      cleanup();
      apiMocks.runInventoryLifecycleCommand.mockReset();
      apiMocks.searchCustomers.mockReset();
    }

    expect(payloads[1]).toEqual(payloads[0]);
    expect(payloads[2]).toEqual(payloads[0]);
    expect(payloads[0]).toEqual({
      command: "reservation.create",
      idempotency_key: "<uuid>",
      payload: {
        stock_unit_id: "unit-1",
        expected_unit_version: 2,
        agreed_price: 799,
        customer_id: "customer-canonical",
        no_deposit_reason: "CANONICAL NO DEPOSIT",
        expires_at: "2099-08-20T10:00:00.000Z",
        expected_pickup_at: "2099-08-15T10:00:00.000Z",
      },
    });
  });

  it("keeps payment.append canonical across localized real sale screens", async () => {
    const inputs: unknown[] = [];
    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      apiMocks.readInventoryLifecycleSale.mockResolvedValue({
        ...saleFixture,
        allowed_actions: ["payment.append"],
      });
      apiMocks.runInventoryLifecycleCommand.mockImplementation(() => new Promise(() => undefined));
      renderWithQuery(
        <LocaleProvider initialLocale={locale}>
          <InventoryLifecycleSaleScreen saleOrderId="sale-1" />
        </LocaleProvider>,
      );
      const amount = await screen.findByRole("textbox", {
        name: translateMessage(locale, "inventory2b4.sale.payment.amount"),
      });
      const user = userEvent.setup();
      await user.clear(amount);
      await user.type(amount, "50");
      await user.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.sale.payment.confirm", {
            amount: formatInventoryLifecycleMoney(50, locale, (key, params) =>
              translateMessage(locale, key, params),
            ),
          }),
        }),
      );
      await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
      const input = apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0];
      inputs.push({ ...input, idempotency_key: "<uuid>" });
      expect(input.idempotency_key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(screen.getByText(/STORY-SALE-001/)).toBeVisible();
      cleanup();
      apiMocks.readInventoryLifecycleSale.mockReset();
      apiMocks.runInventoryLifecycleCommand.mockReset();
    }
    expect(inputs[1]).toEqual(inputs[0]);
    expect(inputs[2]).toEqual(inputs[0]);
    expect(inputs[0]).toEqual({
      command: "payment.append",
      idempotency_key: "<uuid>",
      payload: {
        sale_order_id: "sale-1",
        expected_order_version: 7,
        kind: "payment",
        amount: 50,
        method: "cash",
      },
    });
  });

  it("keeps after_sales.update canonical across localized real case screens", async () => {
    const inputs: unknown[] = [];
    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue(afterSalesFixture);
      apiMocks.runInventoryLifecycleCommand.mockImplementation(() => new Promise(() => undefined));
      renderWithQuery(
        <LocaleProvider initialLocale={locale}>
          <InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />
        </LocaleProvider>,
      );
      const save = await screen.findByRole("button", {
        name: translateMessage(locale, "inventory2b4.afterSales.save"),
      });
      expect(screen.getByText("合成售后案件")).toBeVisible();
      await userEvent.setup().click(save);
      await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
      const input = apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0];
      inputs.push({ ...input, idempotency_key: "<uuid>" });
      expect(input.idempotency_key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      cleanup();
      apiMocks.readInventoryLifecycleAfterSalesCase.mockReset();
      apiMocks.runInventoryLifecycleCommand.mockReset();
    }
    expect(inputs[1]).toEqual(inputs[0]);
    expect(inputs[2]).toEqual(inputs[0]);
    expect(inputs[0]).toEqual({
      command: "after_sales.update",
      idempotency_key: "<uuid>",
      payload: {
        case_id: "case-1",
        expected_case_version: 3,
        status: "waiting_customer",
        diagnosis: "合成检测说明",
        coverage_decision: "pending",
      },
    });
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "preserves future after-sales status and coverage codes through the real %s case mutation",
    async (locale) => {
      apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue({
        ...afterSalesFixture,
        status: "future_case_status",
        coverage_decision: "future_coverage_code",
        allowed_actions: ["after_sales.update"],
        allowed_next_statuses: ["future_next_status"],
      } as never);
      apiMocks.runInventoryLifecycleCommand.mockImplementation(() => new Promise(() => undefined));
      renderWithQuery(
        <LocaleProvider initialLocale={locale}>
          <InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />
        </LocaleProvider>,
      );

      expect((await screen.findAllByText("future_case_status")).length).toBeGreaterThan(0);
      expect(screen.getByRole("option", { name: "future_next_status" })).toHaveValue(
        "future_next_status",
      );
      expect(screen.getByRole("option", { name: "future_coverage_code" })).toHaveValue(
        "future_coverage_code",
      );
      await userEvent.setup().click(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.afterSales.save"),
        }),
      );
      await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
      const input = apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0];
      expect(input).toEqual({
        command: "after_sales.update",
        idempotency_key: expect.any(String),
        payload: {
          case_id: "case-1",
          expected_case_version: 3,
          status: "future_next_status",
          diagnosis: "合成检测说明",
          coverage_decision: "future_coverage_code",
        },
      });
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "keeps sale.complete canonical in the real %s sale screen",
    async (locale) => {
      apiMocks.readInventoryLifecycleSale.mockResolvedValue({
        ...saleFixture,
        signed_paid_amount: 799,
        balance: 0,
        allowed_actions: ["sale.complete"],
      });
      apiMocks.runInventoryLifecycleCommand.mockImplementation(() => new Promise(() => undefined));
      renderWithQuery(
        <LocaleProvider initialLocale={locale}>
          <InventoryLifecycleSaleScreen saleOrderId="sale-1" />
        </LocaleProvider>,
      );

      await userEvent.setup().click(
        await screen.findByRole("button", {
          name: translateMessage(locale, "inventory2b4.sale.complete.confirm"),
        }),
      );
      await expectCanonicalCommand({
        command: "sale.complete",
        idempotency_key: "<uuid>",
        payload: {
          sale_order_id: "sale-1",
          expected_order_version: 7,
          expected_unit_version: 4,
        },
      });
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "keeps pickup.confirm canonical in the real %s sale screen",
    async (locale) => {
      apiMocks.readInventoryLifecycleSale.mockResolvedValue({
        ...saleFixture,
        signed_paid_amount: 799,
        balance: 0,
        allowed_actions: ["pickup.confirm"],
      });
      apiMocks.runInventoryLifecycleCommand.mockImplementation(() => new Promise(() => undefined));
      renderWithQuery(
        <LocaleProvider initialLocale={locale}>
          <InventoryLifecycleSaleScreen saleOrderId="sale-1" />
        </LocaleProvider>,
      );
      const user = userEvent.setup();
      await user.type(
        await screen.findByRole("textbox", {
          name: translateMessage(locale, "inventory2b4.sale.warrantyMonths"),
        }),
        "18",
      );
      await user.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.sale.pickup.confirm"),
        }),
      );
      await expectCanonicalCommand({
        command: "pickup.confirm",
        idempotency_key: "<uuid>",
        payload: {
          sale_order_id: "sale-1",
          expected_order_version: 7,
          warranty_months: 18,
        },
      });
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "keeps warranty.adjust canonical in the real %s sale screen",
    async (locale) => {
      apiMocks.readInventoryLifecycleSale.mockResolvedValue({
        ...saleFixture,
        warranty_version: 5,
        allowed_actions: ["warranty.adjust"],
      });
      apiMocks.runInventoryLifecycleCommand.mockImplementation(() => new Promise(() => undefined));
      renderWithQuery(
        <LocaleProvider initialLocale={locale}>
          <InventoryLifecycleSaleScreen saleOrderId="sale-1" />
        </LocaleProvider>,
      );
      const user = userEvent.setup();
      const months = await screen.findByRole("textbox", {
        name: translateMessage(locale, "inventory2b4.sale.warranty.newMonths"),
      });
      await user.clear(months);
      await user.type(months, "18");
      await user.type(
        screen.getByRole("textbox", {
          name: translateMessage(locale, "inventory2b4.sale.warranty.reason"),
        }),
        "DYNAMIC WARRANTY REASON",
      );
      await user.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.sale.warranty.confirm"),
        }),
      );
      await expectCanonicalCommand({
        command: "warranty.adjust",
        idempotency_key: "<uuid>",
        payload: {
          sale_order_id: "sale-1",
          expected_order_version: 7,
          expected_warranty_version: 5,
          months: 18,
          reason: "DYNAMIC WARRANTY REASON",
        },
      });
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "keeps after_sales.create canonical in the real %s sale screen",
    async (locale) => {
      apiMocks.readInventoryLifecycleSale.mockResolvedValue({
        ...saleFixture,
        allowed_actions: ["after_sales.create"],
      });
      apiMocks.runInventoryLifecycleCommand.mockImplementation(() => new Promise(() => undefined));
      renderWithQuery(
        <LocaleProvider initialLocale={locale}>
          <InventoryLifecycleSaleScreen saleOrderId="sale-1" />
        </LocaleProvider>,
      );
      const user = userEvent.setup();
      await user.type(
        await screen.findByRole("textbox", {
          name: translateMessage(locale, "inventory2b4.sale.afterSales.issue"),
        }),
        "DYNAMIC CUSTOMER ISSUE",
      );
      await user.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.sale.afterSales.confirm"),
        }),
      );
      await expectCanonicalCommand({
        command: "after_sales.create",
        idempotency_key: "<uuid>",
        payload: {
          sale_order_id: "sale-1",
          expected_order_version: 7,
          issue_summary: "DYNAMIC CUSTOMER ISSUE",
          coverage_decision: "pending",
        },
      });
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "keeps reservation.cancel canonical in the real %s sale screen",
    async (locale) => {
      apiMocks.readInventoryLifecycleSale.mockResolvedValue(saleFixture);
      apiMocks.runInventoryLifecycleCommand.mockImplementation(() => new Promise(() => undefined));
      renderWithQuery(
        <LocaleProvider initialLocale={locale}>
          <InventoryLifecycleSaleScreen saleOrderId="sale-1" />
        </LocaleProvider>,
      );
      const user = userEvent.setup();
      await user.click(
        await screen.findByText(translateMessage(locale, "inventory2b4.sale.moreActions")),
      );
      await user.type(
        screen.getByRole("textbox", {
          name: translateMessage(locale, "inventory2b4.sale.cancel.reason"),
        }),
        "DYNAMIC CANCEL REASON",
      );
      await user.selectOptions(
        screen.getByRole("combobox", {
          name: translateMessage(locale, "inventory2b4.sale.cancel.disposition"),
        }),
        "refund_pending",
      );
      const confirmName = translateMessage(locale, "inventory2b4.sale.cancel.confirm");
      await user.click(screen.getByRole("button", { name: confirmName }));
      await user.click(await screen.findByRole("button", { name: confirmName }));
      await expectCanonicalCommand({
        command: "reservation.cancel",
        idempotency_key: "<uuid>",
        payload: {
          sale_order_id: "sale-1",
          expected_order_version: 7,
          expected_unit_version: 4,
          disposition: "refund_pending",
          reason: "DYNAMIC CANCEL REASON",
        },
      });
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "keeps after_sales.close canonical in the real %s case screen",
    async (locale) => {
      apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue({
        ...afterSalesFixture,
        status: "returned",
        allowed_actions: ["after_sales.close"],
        allowed_next_statuses: ["closed"],
      });
      apiMocks.runInventoryLifecycleCommand.mockImplementation(() => new Promise(() => undefined));
      renderWithQuery(
        <LocaleProvider initialLocale={locale}>
          <InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />
        </LocaleProvider>,
      );
      const user = userEvent.setup();
      const closeName = translateMessage(locale, "inventory2b4.afterSales.close");
      await user.click(await screen.findByRole("button", { name: closeName }));
      await user.click(await screen.findByRole("button", { name: closeName }));
      await expectCanonicalCommand({
        command: "after_sales.close",
        idempotency_key: "<uuid>",
        payload: {
          case_id: "case-1",
          expected_case_version: 3,
          status: "closed",
          diagnosis: "合成检测说明",
          coverage_decision: "pending",
        },
      });
    },
  );
  it("shows an unavailable state and does not request product data without permission", () => {
    shellMocks.value = shellContext({ canReadInventory: false });
    renderWithQuery(<InventoryLifecycleReservationScreen itemId="item-1" />);

    expect(screen.getByRole("heading", { name: "当前账号没有访问权限" })).toBeVisible();
    expect(apiMocks.getInventoryProduct).not.toHaveBeenCalled();
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "keeps the real /sell staged flow on reservation.create in %s",
    async (locale) => {
      apiMocks.readInventoryLifecycleSummary.mockResolvedValue({
        ...summaryFixture,
        allowed_actions: ["reservation.create"],
      });
      apiMocks.searchCustomers.mockResolvedValue([
        { id: "sell-customer", name: "DYNAMIC SELL CUSTOMER", phone_e164: "+390212345678" },
      ]);
      apiMocks.runInventoryLifecycleCommand.mockImplementation(() => new Promise(() => undefined));
      renderWithQuery(
        <LocaleProvider initialLocale={locale}>
          <InventoryLifecycleReservationScreen itemId="item-1" mode="sale" />
        </LocaleProvider>,
      );
      expect(
        await screen.findByText(
          translateMessage(locale, "inventory2b4.reservation.saleDescription"),
        ),
      ).toBeVisible();
      const user = userEvent.setup();
      await user.type(
        screen.getByRole("combobox", {
          name: new RegExp(translateMessage(locale, "inventory2b4.reservation.customer")),
        }),
        "DYNAMIC",
      );
      await user.click(await screen.findByRole("option", { name: /DYNAMIC SELL CUSTOMER/ }));
      await user.type(
        screen.getByRole("textbox", {
          name: new RegExp(translateMessage(locale, "inventory2b4.reservation.noDepositReason")),
        }),
        "DYNAMIC NO DEPOSIT",
      );
      await user.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.reservation.submit"),
        }),
      );
      await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
      expect(apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0]).toMatchObject({
        command: "reservation.create",
        payload: {
          stock_unit_id: "unit-1",
          expected_unit_version: 2,
          customer_id: "sell-customer",
          no_deposit_reason: "DYNAMIC NO DEPOSIT",
        },
      });
      expect(
        apiMocks.runInventoryLifecycleCommand.mock.calls.some(
          ([input]) => input.command === "sale.complete",
        ),
      ).toBe(false);
    },
  );

  it("keeps reservation submission disabled until server actions are projected", async () => {
    renderWithQuery(<InventoryLifecycleReservationScreen itemId="item-1" />);

    expect(await screen.findByText(/服务端尚未返回可用动作/)).toBeVisible();
    expect(screen.getByRole("button", { name: "确认预订" })).toBeDisabled();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
  });

  it("feeds local reservation validation into the summary and field focus", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <InventoryReservationForm
        summary={{
          ...summaryFixture,
          allowed_actions: ["reservation.create"],
          unit_version: 2,
        }}
        storeId="store-1"
        defaultPrice={799}
        onSuccess={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "确认预订" }));
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    const summary = screen.getByRole("alert");
    expect(summary).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /客户：请先选择同店客户/ }));
    expect(screen.getByRole("combobox", { name: /客户/ })).toHaveFocus();
  });

  it("exposes localized customer-search empty and safe error states", async () => {
    const user = userEvent.setup();
    apiMocks.searchCustomers.mockResolvedValue([]);
    renderWithQuery(
      <LocaleProvider initialLocale="it-IT">
        <InventoryReservationForm
          summary={{ ...summaryFixture, allowed_actions: ["reservation.create"] }}
          storeId="store-1"
          onSuccess={vi.fn()}
        />
      </LocaleProvider>,
    );
    await user.type(screen.getByRole("combobox", { name: /Cliente/ }), "Nobody");
    expect(await screen.findByText("Nessun cliente corrispondente.")).toBeVisible();
    cleanup();

    apiMocks.searchCustomers.mockReset();
    apiMocks.searchCustomers.mockRejectedValue(new Error("PRIVATE-CUSTOMER-LOOKUP"));
    renderWithQuery(
      <LocaleProvider initialLocale="en">
        <InventoryReservationForm
          summary={{ ...summaryFixture, allowed_actions: ["reservation.create"] }}
          storeId="store-1"
          onSuccess={vi.fn()}
        />
      </LocaleProvider>,
    );
    await userEvent.setup().type(screen.getByRole("combobox", { name: /Customer/ }), "Failure");
    expect(await screen.findByText("Customer search failed. Try again.")).toBeVisible();
    expect(screen.queryByText("PRIVATE-CUSTOMER-LOOKUP")).not.toBeInTheDocument();
  });

  it("closes the customer listbox with Escape from both input and option without selecting", async () => {
    const fullPhone = "+390212345678";
    apiMocks.searchCustomers.mockResolvedValue([
      { id: "customer-safe", name: "DYNAMIC CUSTOMER", phone_e164: fullPhone },
    ]);
    renderWithQuery(
      <InventoryReservationForm
        summary={{ ...summaryFixture, allowed_actions: ["reservation.create"] }}
        storeId="store-1"
        onSuccess={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    const input = screen.getByRole("combobox", { name: /客户/ });
    await user.type(input, "Dynamic");
    const option = await screen.findByRole("option", { name: /DYNAMIC CUSTOMER/ });
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-controls", "reservation-customer-results");
    expect(screen.queryByText(fullPhone)).not.toBeInTheDocument();
    expect(screen.getByText("•••• 5678")).toBeVisible();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).not.toHaveAttribute("aria-controls");
    expect(input).toHaveFocus();

    await user.type(input, " customer");
    const reopenedOption = await screen.findByRole("option", { name: /DYNAMIC CUSTOMER/ });
    await user.keyboard("{ArrowDown}");
    expect(reopenedOption).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).not.toHaveAttribute("aria-controls");
    expect(input).toHaveFocus();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
  });

  it("blocks offline reservation writes and synchronously locks same-tick duplicate submits", async () => {
    apiMocks.searchCustomers.mockResolvedValue([
      { id: "customer-1", name: "合成客户", phone_e164: "+390000000000" },
    ]);
    const renderAndFill = async () => {
      renderWithQuery(
        <InventoryReservationForm
          summary={{
            ...summaryFixture,
            allowed_actions: ["reservation.create"],
            unit_version: 2,
          }}
          storeId="store-1"
          defaultPrice={799}
          onSuccess={vi.fn()}
        />,
      );
      const user = userEvent.setup();
      await user.type(screen.getByRole("combobox", { name: /客户/ }), "合成");
      await user.click(await screen.findByRole("option", { name: /合成客户/ }));
      await user.type(screen.getByRole("textbox", { name: /免定金原因/ }), "CANONICAL REASON");
      fireEvent.change(document.getElementById("reservation-expires")!, {
        target: { value: "2099-08-20T12:00" },
      });
      fireEvent.change(document.getElementById("reservation-pickup")!, {
        target: { value: "2099-08-15T12:00" },
      });
      return screen.getByRole("button", { name: "确认预订" });
    };

    const offline = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    const offlineSubmit = await renderAndFill();
    await userEvent.setup().click(offlineSubmit);
    expect(await screen.findByText("当前离线，预订尚未提交。")).toBeVisible();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    cleanup();
    offline.mockRestore();

    const online = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
    apiMocks.runInventoryLifecycleCommand.mockImplementation(() => new Promise(() => undefined));
    const pendingSubmit = await renderAndFill();
    fireEvent.click(pendingSubmit);
    fireEvent.click(pendingSubmit);
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    expect(pendingSubmit).toBeDisabled();
    online.mockRestore();
  });

  it("blocks offline sale writes and synchronously locks same-tick duplicate submits", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue({
      ...saleFixture,
      signed_paid_amount: 799,
      balance: 0,
      allowed_actions: ["sale.complete"],
    });
    const online = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    renderWithQuery(
      <LocaleProvider initialLocale="en">
        <InventoryLifecycleSaleScreen saleOrderId="sale-1" />
      </LocaleProvider>,
    );
    await user.click(
      await screen.findByRole("button", { name: "Complete sale and remove from inventory" }),
    );
    expect(
      await screen.findByText("You are offline; the operation was not submitted."),
    ).toBeVisible();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    cleanup();
    online.mockRestore();

    const restoredOnline = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
    apiMocks.runInventoryLifecycleCommand.mockImplementation(() => new Promise(() => undefined));
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);
    const submit = await screen.findByRole("button", {
      name: "完成销售并写入库存出库",
    });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    restoredOnline.mockRestore();
  });

  it("blocks offline after-sales writes and synchronously locks same-tick duplicate submits", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue(afterSalesFixture);
    const online = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    renderWithQuery(
      <LocaleProvider initialLocale="it-IT">
        <InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />
      </LocaleProvider>,
    );
    await user.click(
      await screen.findByRole("button", {
        name: translateMessage("it-IT", "inventory2b4.afterSales.save"),
      }),
    );
    expect(
      await screen.findByText(translateMessage("it-IT", "inventory2b4.afterSales.offline")),
    ).toBeVisible();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    cleanup();
    online.mockRestore();

    const restoredOnline = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
    apiMocks.runInventoryLifecycleCommand.mockImplementation(() => new Promise(() => undefined));
    renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);
    const submit = await screen.findByRole("button", { name: "保存并追加历史" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    restoredOnline.mockRestore();
  });

  it("reuses a sale key only for the exact unchanged failed command body", async () => {
    apiMocks.readInventoryLifecycleSale.mockResolvedValue({
      ...saleFixture,
      allowed_actions: ["payment.append"],
    });
    apiMocks.runInventoryLifecycleCommand.mockRejectedValue(
      Object.assign(new Error("PRIVATE PAYMENT SENTINEL"), {
        status: 422,
        code: "validation_failed",
      }),
    );
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);
    const user = userEvent.setup();
    const amount = await screen.findByRole("textbox", { name: /本次收款/ });
    await user.clear(amount);
    await user.type(amount, "50");
    const submit = screen.getByRole("button", { name: /确认追加/ });
    await user.click(submit);
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("操作未被接受")).toBeVisible();
    expect(screen.queryByText("PRIVATE PAYMENT SENTINEL")).not.toBeInTheDocument();
    const first = apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0];

    await user.click(submit);
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(2));
    const unchangedRetry = apiMocks.runInventoryLifecycleCommand.mock.calls[1]?.[0];
    expect(unchangedRetry).toEqual(first);

    await user.clear(amount);
    await user.type(amount, "60");
    await user.click(submit);
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(3));
    const changedRetry = apiMocks.runInventoryLifecycleCommand.mock.calls[2]?.[0];
    expect(changedRetry.payload).toEqual({ ...first.payload, amount: 60 });
    expect(changedRetry.idempotency_key).not.toBe(first.idempotency_key);
  });

  it("reuses an after-sales key and generated time only for the unchanged failed body", async () => {
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue({
      ...afterSalesFixture,
      allowed_actions: ["after_sales.update"],
      allowed_next_statuses: ["returned"],
    });
    apiMocks.runInventoryLifecycleCommand.mockRejectedValue(
      Object.assign(new Error("PRIVATE CASE SENTINEL"), {
        status: 422,
        code: "validation_failed",
      }),
    );
    renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);
    const user = userEvent.setup();
    const submit = await screen.findByRole("button", { name: "保存并追加历史" });
    await user.click(submit);
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("操作未被接受")).toBeVisible();
    expect(screen.queryByText("PRIVATE CASE SENTINEL")).not.toBeInTheDocument();
    const first = apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0];
    expect(first.payload.returned_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await user.click(submit);
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(2));
    const unchangedRetry = apiMocks.runInventoryLifecycleCommand.mock.calls[1]?.[0];
    expect(unchangedRetry).toEqual(first);

    const diagnosis = screen.getByRole("textbox", { name: /检测与处理说明/ });
    await user.type(diagnosis, " CHANGED");
    await user.click(submit);
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(3));
    const changedRetry = apiMocks.runInventoryLifecycleCommand.mock.calls[2]?.[0];
    expect(changedRetry.payload.diagnosis).toBe("合成检测说明 CHANGED");
    expect(changedRetry.idempotency_key).not.toBe(first.idempotency_key);
    expect(changedRetry.payload.returned_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("retires the sale key after an outcome readback before the next explicit attempt", async () => {
    apiMocks.readInventoryLifecycleSale.mockResolvedValue({
      ...saleFixture,
      allowed_actions: ["payment.append"],
    });
    apiMocks.runInventoryLifecycleCommand
      .mockRejectedValueOnce(Object.assign(new Error("PRIVATE ABORT"), { name: "AbortError" }))
      .mockImplementationOnce(() => new Promise(() => undefined));
    renderWithQuery(
      <LocaleProvider initialLocale="en">
        <InventoryLifecycleSaleScreen saleOrderId="sale-1" />
      </LocaleProvider>,
    );
    const user = userEvent.setup();
    const amount = await screen.findByRole("textbox", { name: "Amount received" });
    await user.clear(amount);
    await user.type(amount, "50");
    await user.click(screen.getByRole("button", { name: /Add €50/ }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    const first = apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0];
    expect(
      await screen.findByText(translateMessage("en", "inventory2b4.operationError.unknown.title")),
    ).toBeVisible();
    expect(screen.queryByText("PRIVATE ABORT")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Read latest state/ }));
    await user.click(await screen.findByRole("button", { name: "I reviewed the latest state" }));
    await user.click(screen.getByRole("button", { name: /Add €50/ }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(2));
    const nextAttempt = apiMocks.runInventoryLifecycleCommand.mock.calls[1]?.[0];
    expect(nextAttempt.payload).toEqual(first.payload);
    expect(nextAttempt.idempotency_key).not.toBe(first.idempotency_key);
  });

  it("retires the after-sales key after an outcome readback before the next explicit attempt", async () => {
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue(afterSalesFixture);
    apiMocks.runInventoryLifecycleCommand
      .mockRejectedValueOnce(Object.assign(new Error("PRIVATE ABORT"), { name: "AbortError" }))
      .mockImplementationOnce(() => new Promise(() => undefined));
    renderWithQuery(
      <LocaleProvider initialLocale="it-IT">
        <InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />
      </LocaleProvider>,
    );
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: translateMessage("it-IT", "inventory2b4.afterSales.save"),
      }),
    );
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    const first = apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0];
    expect(
      await screen.findByText(
        translateMessage("it-IT", "inventory2b4.operationError.unknown.title"),
      ),
    ).toBeVisible();
    expect(screen.queryByText("PRIVATE ABORT")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: translateMessage("it-IT", "inventory2b4.operationError.verify"),
      }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: translateMessage("it-IT", "inventory2b4.operationError.acknowledge"),
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: translateMessage("it-IT", "inventory2b4.afterSales.save"),
      }),
    );
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(2));
    const nextAttempt = apiMocks.runInventoryLifecycleCommand.mock.calls[1]?.[0];
    expect(nextAttempt.payload).toEqual(first.payload);
    expect(nextAttempt.idempotency_key).not.toBe(first.idempotency_key);
  });

  it("preserves the sale draft, focus and failed-attempt key across an in-place locale switch", async () => {
    apiMocks.readInventoryLifecycleSale.mockResolvedValue({
      ...saleFixture,
      allowed_actions: ["payment.append"],
    });
    apiMocks.runInventoryLifecycleCommand.mockRejectedValue(
      Object.assign(new Error("PRIVATE PAYMENT SENTINEL"), {
        status: 422,
        code: "validation_failed",
      }),
    );
    renderWithQuery(
      <LocaleProvider initialLocale="en">
        <TestLocaleToggle target="it-IT" />
        <InventoryLifecycleSaleScreen saleOrderId="sale-1" />
      </LocaleProvider>,
    );
    const user = userEvent.setup();
    const amount = await screen.findByRole("textbox", { name: "Amount received" });
    await user.clear(amount);
    await user.type(amount, "50");
    await user.click(screen.getByRole("button", { name: /Add €50/ }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    const first = apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0];
    const readsBeforeSwitch = apiMocks.readInventoryLifecycleSale.mock.calls.length;

    const localeToggle = screen.getByRole("button", { name: "switch-to-it-IT" });
    await user.click(localeToggle);
    expect(localeToggle).toHaveFocus();
    expect(document.documentElement.lang).toBe("it-IT");
    expect(screen.getByRole("textbox", { name: "Importo ricevuto" })).toHaveValue("50");
    expect(apiMocks.readInventoryLifecycleSale).toHaveBeenCalledTimes(readsBeforeSwitch);
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
    expect(routerMocks.push).not.toHaveBeenCalled();
    expect(routerMocks.replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Aggiungi €50/ }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(2));
    expect(apiMocks.runInventoryLifecycleCommand.mock.calls[1]?.[0]).toEqual(first);
  });

  it("preserves the real reservation route, reads, draft, CAS and failed key across a locale switch", async () => {
    apiMocks.readInventoryLifecycleSummary.mockResolvedValue({
      ...summaryFixture,
      unit_version: 6,
      allowed_actions: ["reservation.create"],
    });
    apiMocks.searchCustomers.mockResolvedValue([
      { id: "customer-locale", name: "DYNAMIC CUSTOMER", phone_e164: "+390212345678" },
    ]);
    apiMocks.runInventoryLifecycleCommand.mockRejectedValue(
      Object.assign(new Error("PRIVATE RESERVATION SENTINEL"), {
        status: 422,
        code: "validation_failed",
      }),
    );
    renderWithQuery(
      <LocaleProvider initialLocale="en">
        <TestLocaleToggle target="it-IT" />
        <InventoryLifecycleReservationScreen itemId="item-1" />
      </LocaleProvider>,
    );

    const user = userEvent.setup();
    await user.type(await screen.findByRole("combobox", { name: /Customer/ }), "Dynamic");
    await user.click(await screen.findByRole("option", { name: /DYNAMIC CUSTOMER/ }));
    const reason = screen.getByRole("textbox", { name: /No-deposit reason/ });
    await user.type(reason, "DYNAMIC RESERVATION DRAFT");
    fireEvent.change(document.getElementById("reservation-expires")!, {
      target: { value: "2099-08-20T12:00" },
    });
    fireEvent.change(document.getElementById("reservation-pickup")!, {
      target: { value: "2099-08-15T12:00" },
    });
    await user.click(screen.getByRole("button", { name: "Confirm reservation" }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    const first = apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0];
    expect(first.payload.expected_unit_version).toBe(6);
    const productReads = apiMocks.getInventoryProduct.mock.calls.length;
    const summaryReads = apiMocks.readInventoryLifecycleSummary.mock.calls.length;
    const customerReads = apiMocks.searchCustomers.mock.calls.length;

    const localeToggle = screen.getByRole("button", { name: "switch-to-it-IT" });
    await user.click(localeToggle);
    expect(localeToggle).toHaveFocus();
    expect(document.documentElement.lang).toBe("it-IT");
    expect(screen.getByText("DYNAMIC CUSTOMER")).toBeVisible();
    expect(screen.getByRole("textbox", { name: /Motivo senza acconto/ })).toHaveValue(
      "DYNAMIC RESERVATION DRAFT",
    );
    expect(document.getElementById("reservation-expires")).toHaveValue("2099-08-20T12:00");
    expect(document.getElementById("reservation-pickup")).toHaveValue("2099-08-15T12:00");
    expect(apiMocks.getInventoryProduct).toHaveBeenCalledTimes(productReads);
    expect(apiMocks.readInventoryLifecycleSummary).toHaveBeenCalledTimes(summaryReads);
    expect(apiMocks.searchCustomers).toHaveBeenCalledTimes(customerReads);
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
    expect(routerMocks.push).not.toHaveBeenCalled();
    expect(routerMocks.replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Conferma prenotazione" }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(2));
    expect(apiMocks.runInventoryLifecycleCommand.mock.calls[1]?.[0]).toEqual(first);
  });

  it("preserves the after-sales draft, focus and failed-attempt key across an in-place locale switch", async () => {
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue(afterSalesFixture);
    apiMocks.runInventoryLifecycleCommand.mockRejectedValue(
      Object.assign(new Error("PRIVATE CASE SENTINEL"), {
        status: 422,
        code: "validation_failed",
      }),
    );
    renderWithQuery(
      <LocaleProvider initialLocale="en">
        <TestLocaleToggle target="it-IT" />
        <InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />
      </LocaleProvider>,
    );
    const user = userEvent.setup();
    const diagnosis = await screen.findByRole("textbox", { name: "Diagnosis and handling notes" });
    await user.type(diagnosis, " DYNAMIC DRAFT");
    await user.click(screen.getByRole("button", { name: "Save and append to history" }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    const first = apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0];
    const readsBeforeSwitch = apiMocks.readInventoryLifecycleAfterSalesCase.mock.calls.length;

    const localeToggle = screen.getByRole("button", { name: "switch-to-it-IT" });
    await user.click(localeToggle);
    expect(localeToggle).toHaveFocus();
    expect(document.documentElement.lang).toBe("it-IT");
    expect(
      screen.getByRole("textbox", {
        name: translateMessage("it-IT", "inventory2b4.afterSales.diagnosis"),
      }),
    ).toHaveValue("合成检测说明 DYNAMIC DRAFT");
    expect(apiMocks.readInventoryLifecycleAfterSalesCase).toHaveBeenCalledTimes(readsBeforeSwitch);
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
    expect(routerMocks.push).not.toHaveBeenCalled();
    expect(routerMocks.replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Salva e aggiungi allo storico" }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(2));
    expect(apiMocks.runInventoryLifecycleCommand.mock.calls[1]?.[0]).toEqual(first);
  });

  it("uses a new key when a real after-sales update changes to the close command", async () => {
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue({
      ...afterSalesFixture,
      allowed_actions: ["after_sales.update", "after_sales.close"],
      allowed_next_statuses: ["waiting_customer", "closed"],
    });
    apiMocks.runInventoryLifecycleCommand.mockRejectedValue(
      Object.assign(new Error("PRIVATE AFTER SALES SENTINEL"), {
        status: 422,
        code: "validation_failed",
      }),
    );
    renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "保存并追加历史" }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    const updateInput = apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0];
    expect(updateInput.command).toBe("after_sales.update");
    expect(updateInput.payload.status).toBe("waiting_customer");

    await user.selectOptions(screen.getByRole("combobox", { name: "下一状态" }), "closed");
    await user.click(screen.getByRole("button", { name: "确认关闭案件" }));
    await user.click(await screen.findByRole("button", { name: "确认关闭案件" }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(2));
    const closeInput = apiMocks.runInventoryLifecycleCommand.mock.calls[1]?.[0];
    expect(closeInput).toEqual({
      command: "after_sales.close",
      idempotency_key: expect.any(String),
      payload: {
        ...updateInput.payload,
        status: "closed",
      },
    });
    expect(closeInput.idempotency_key).not.toBe(updateInput.idempotency_key);
    expect(screen.queryByText("PRIVATE AFTER SALES SENTINEL")).not.toBeInTheDocument();
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "renders the real after-sales queue permission/loading/error/retry/empty/ready states in %s",
    async (locale) => {
      shellMocks.value = shellContext({ canReadInventory: false });
      renderWithQuery(
        <LocaleProvider initialLocale={locale}>
          <InventoryLifecycleAfterSalesQueueScreen />
        </LocaleProvider>,
      );
      expect(
        screen.getByRole("heading", {
          name: translateMessage(locale, "inventory2b4.afterSales.queueTitle"),
        }),
      ).toBeVisible();
      expect(
        screen.getByText(
          translateMessage(locale, "inventory2b4.availabilityCard.noPermission.title"),
        ),
      ).toBeVisible();
      expect(apiMocks.readInventoryLifecycleAfterSalesQueue).not.toHaveBeenCalled();
      cleanup();

      shellMocks.value = shellContext();
      apiMocks.readInventoryLifecycleAfterSalesQueue.mockReset();
      apiMocks.readInventoryLifecycleAfterSalesQueue.mockImplementation(
        () => new Promise(() => undefined),
      );
      renderWithQuery(
        <LocaleProvider initialLocale={locale}>
          <InventoryLifecycleAfterSalesQueueScreen />
        </LocaleProvider>,
      );
      expect(
        await screen.findByText(translateMessage(locale, "inventory2b4.afterSales.queueLoading")),
      ).toBeVisible();
      cleanup();

      apiMocks.readInventoryLifecycleAfterSalesQueue.mockReset();
      apiMocks.readInventoryLifecycleAfterSalesQueue
        .mockRejectedValueOnce(new Error("PRIVATE QUEUE SENTINEL"))
        .mockResolvedValueOnce([]);
      renderWithQuery(
        <LocaleProvider initialLocale={locale}>
          <InventoryLifecycleAfterSalesQueueScreen />
        </LocaleProvider>,
      );
      expect(
        await screen.findByText(
          translateMessage(locale, "inventory2b4.availabilityCard.unavailable.title"),
        ),
      ).toBeVisible();
      expect(screen.queryByText("PRIVATE QUEUE SENTINEL")).not.toBeInTheDocument();
      await userEvent.setup().click(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.availabilityCard.retry"),
        }),
      );
      expect(
        await screen.findByText(translateMessage(locale, "inventory2b4.afterSales.emptyTitle")),
      ).toBeVisible();
      expect(apiMocks.readInventoryLifecycleAfterSalesQueue).toHaveBeenCalledTimes(2);
      cleanup();

      apiMocks.readInventoryLifecycleAfterSalesQueue.mockReset();
      apiMocks.readInventoryLifecycleAfterSalesQueue.mockResolvedValue([
        { ...afterSalesQueueFixture, status: "future_queue_status" },
      ]);
      renderWithQuery(
        <LocaleProvider initialLocale={locale}>
          <InventoryLifecycleAfterSalesQueueScreen />
        </LocaleProvider>,
      );
      expect(await screen.findByText("DYNAMIC QUEUE ISSUE")).toBeVisible();
      expect(screen.getByText("future_queue_status")).toBeVisible();
      expect(apiMocks.readInventoryLifecycleAfterSalesQueue).toHaveBeenCalledTimes(1);
    },
  );

  it("validates payment amount before calling payment.append", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue({
      ...saleFixture,
      allowed_actions: ["payment.append"],
    });
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.clear(await screen.findByRole("textbox", { name: /本次收款/ }));
    await user.click(await screen.findByRole("button", { name: /确认追加/ }));
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByRole("textbox", { name: /本次收款/ })).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    const amount = screen.getByRole("textbox", { name: /本次收款/ });
    amount.focus();
    expect(amount).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /确认追加/ }));
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("validates pickup exception reason and clears the summary after correction", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue({
      ...saleFixture,
      allowed_actions: ["pickup.confirm"],
    });
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.click(await screen.findByRole("button", { name: "确认已取走并开始保修" }));
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveFocus();

    await user.type(screen.getByRole("textbox", { name: /余额未清例外原因/ }), "客户确认延期");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("validates warranty months and reason before warranty.adjust", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue({
      ...saleFixture,
      allowed_actions: ["warranty.adjust"],
    });
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.click(await screen.findByRole("button", { name: "保存新的商业保修版本" }));
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByRole("textbox", { name: /新商业保修/ })).toBeRequired();
    expect(screen.getByRole("textbox", { name: /调整原因/ })).toBeRequired();
  });

  it("validates after-sales intake issue before after_sales.create", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue({
      ...saleFixture,
      allowed_actions: ["after_sales.create"],
    });
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.click(await screen.findByRole("button", { name: "建立售后案件" }));
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("does not open cancel confirmation when the required reason is missing", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue(saleFixture);
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.click(await screen.findByText("更多管理操作"));
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
  });

  it("focuses the after-sales diagnosis summary instead of mutating an empty diagnosis", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue({
      ...afterSalesFixture,
      diagnosis: "",
    });
    renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);

    await user.click(await screen.findByRole("button", { name: "保存并追加历史" }));
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByRole("textbox", { name: /检测与处理说明/ })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("explains missing after-sales transition facts without changing allowed actions", async () => {
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue({
      ...afterSalesFixture,
      allowed_actions: ["after_sales.update"],
      allowed_next_statuses: [],
    });
    renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);

    expect(await screen.findByRole("heading", { name: "资料需要人工核对" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "保存并追加历史" })).not.toBeInTheDocument();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
  });

  it("focuses inspection validation and does not save an invalid battery value", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <InventoryInspectionEditor
        summary={{
          ...summaryFixture,
          allowed_actions: ["inspection.save"],
          unit_version: 2,
          inspection: {
            battery_health: null,
            face_id_status: "not_tested",
            touch_id_status: "not_tested",
            true_tone_status: "not_tested",
            activation_lock_status: "not_tested",
            data_wipe_status: "not_tested",
            imei_status: "not_tested",
            inspected_at: "2026-08-01T08:00:00.000Z",
          },
        }}
        brand="Apple"
        category="phone"
      />,
    );

    const battery = screen.getByRole("spinbutton");
    await user.type(battery, "101");
    await user.click(screen.getByRole("button", { name: "保存检测版本" }));
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(battery).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a structured inspection receipt without exposing result fields", async () => {
    const user = userEvent.setup();
    apiMocks.runInventoryLifecycleCommand.mockResolvedValueOnce({
      ok: true,
      code: "saved",
      stock_unit_id: "unit-private-id",
      version: 8,
    });
    renderWithQuery(
      <InventoryInspectionEditor
        summary={{
          ...summaryFixture,
          allowed_actions: ["inspection.save"],
          unit_version: 2,
          inspection: {
            battery_health: null,
            face_id_status: "not_tested",
            touch_id_status: "not_tested",
            true_tone_status: "not_tested",
            activation_lock_status: "not_tested",
            data_wipe_status: "not_tested",
            imei_status: "not_tested",
            inspected_at: "2026-08-01T08:00:00.000Z",
          },
        }}
        brand="Apple"
        category="phone"
      />,
    );

    await user.click(screen.getByRole("button", { name: "保存检测版本" }));
    expect(await screen.findByText("检测写入已确认")).toBeVisible();
    expect(screen.queryByText("unit-private-id")).not.toBeInTheDocument();
    expect(
      document.querySelector<HTMLElement>("[data-ui='inventory-operation-receipt-panel']"),
    ).toHaveTextContent("最新读回");
  });

  it.each([
    ["stale_version", "资料版本已变化"],
    ["future_conflict_code", "操作发生冲突"],
  ] as const)(
    "keeps inspection %s conflicts read-only until readback succeeds",
    async (code, title) => {
      const user = userEvent.setup();
      const verifyConflict = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      apiMocks.runInventoryLifecycleCommand
        .mockRejectedValueOnce(
          Object.assign(new Error("raw conflict details"), { status: 409, code }),
        )
        .mockResolvedValueOnce({ ok: true, code: "saved" });
      renderWithQuery(
        <InventoryInspectionEditor
          summary={{
            ...summaryFixture,
            allowed_actions: ["inspection.save"],
            unit_version: 2,
            inspection: {
              battery_health: null,
              face_id_status: "not_tested",
              touch_id_status: "not_tested",
              true_tone_status: "not_tested",
              activation_lock_status: "not_tested",
              data_wipe_status: "not_tested",
              imei_status: "not_tested",
              inspected_at: "2026-08-01T08:00:00.000Z",
            },
          }}
          brand="Apple"
          category="phone"
          onVerifyConflict={verifyConflict}
        />,
      );

      await user.click(screen.getByRole("button", { name: "保存检测版本" }));
      expect(await screen.findByText(title)).toBeVisible();
      expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "保存检测版本" })).toBeDisabled();
      expect(screen.queryByText("raw conflict details")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "刷新最新状态" }));
      expect(verifyConflict).toHaveBeenCalledTimes(1);
      expect(screen.getByText("刷新失败，当前内容没有自动提交；请稍后再次刷新。")).toBeVisible();
      expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "保存检测版本" })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "刷新最新状态" }));
      await waitFor(() => expect(screen.queryByText(title)).not.toBeInTheDocument());
      expect(verifyConflict).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("button", { name: "保存检测版本" })).toBeEnabled();

      await user.click(screen.getByRole("button", { name: "保存检测版本" }));
      await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(2));
      const calls = apiMocks.runInventoryLifecycleCommand.mock.calls;
      expect(calls[0]?.[0]?.idempotency_key).toEqual(expect.any(String));
      expect(calls[1]?.[0]?.idempotency_key).toEqual(expect.any(String));
      expect(calls[1]?.[0]?.idempotency_key).not.toBe(calls[0]?.[0]?.idempotency_key);
    },
  );

  it("separates inspection commit from readback and never unlocks after a failed sync", async () => {
    const user = userEvent.setup();
    const syncReadback = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    apiMocks.runInventoryLifecycleCommand.mockResolvedValueOnce({ ok: true, code: "saved" });
    renderWithQuery(
      <InventoryInspectionEditor
        summary={{
          ...summaryFixture,
          allowed_actions: ["inspection.save"],
          unit_version: 2,
          inspection: {
            battery_health: null,
            face_id_status: "not_tested",
            touch_id_status: "not_tested",
            true_tone_status: "not_tested",
            activation_lock_status: "not_tested",
            data_wipe_status: "not_tested",
            imei_status: "not_tested",
            inspected_at: "2026-08-01T08:00:00.000Z",
          },
        }}
        brand="Apple"
        category="phone"
        onSyncCommitted={syncReadback}
      />,
    );

    await user.click(screen.getByRole("button", { name: "保存检测版本" }));
    expect(await screen.findByText("检测写入已确认")).toBeVisible();
    expect(await screen.findByText("写入已完成，但同步最新状态失败")).toBeVisible();
    expect(screen.getByRole("button", { name: "保存检测版本" })).toBeDisabled();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "重试同步" }));
    await waitFor(() =>
      expect(document.querySelector("[data-ui='inventory-sync-status-panel']")).toHaveAttribute(
        "data-sync-status",
        "recovered",
      ),
    );
    expect(syncReadback).toHaveBeenCalledTimes(2);
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "保存检测版本" })).toBeEnabled();
  });

  it("redacts an inspection outcome-unknown error and blocks a duplicate write", async () => {
    const user = userEvent.setup();
    apiMocks.runInventoryLifecycleCommand.mockRejectedValueOnce(
      new Error("private inspection raw"),
    );
    renderWithQuery(
      <InventoryInspectionEditor
        summary={{
          ...summaryFixture,
          allowed_actions: ["inspection.save"],
          unit_version: 2,
          inspection: {
            battery_health: null,
            face_id_status: "not_tested",
            touch_id_status: "not_tested",
            true_tone_status: "not_tested",
            activation_lock_status: "not_tested",
            data_wipe_status: "not_tested",
            imei_status: "not_tested",
            inspected_at: "2026-08-01T08:00:00.000Z",
          },
        }}
        brand="Apple"
        category="phone"
      />,
    );

    await user.click(screen.getByRole("button", { name: "保存检测版本" }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("暂时无法确认写入结果")).toBeVisible();
    expect(screen.queryByText("private inspection raw")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存检测版本" })).toBeDisabled();
  });

  it("focuses the reservation feedback after a server save error", async () => {
    const user = userEvent.setup();
    apiMocks.searchCustomers.mockResolvedValue([
      { id: "customer-1", name: "合成客户", phone_e164: "+390000000000" },
    ]);
    apiMocks.runInventoryLifecycleCommand.mockRejectedValueOnce(new Error("写入失败"));
    renderWithQuery(
      <InventoryReservationForm
        summary={{
          ...summaryFixture,
          allowed_actions: ["reservation.create"],
          unit_version: 2,
        }}
        storeId="store-1"
        defaultPrice={799}
        onSuccess={vi.fn()}
      />,
    );

    const customerSearch = screen.getByRole("combobox", { name: /客户/ });
    await user.type(customerSearch, "合成");
    await user.click(await screen.findByRole("option", { name: /合成客户/ }));
    await user.type(screen.getByRole("textbox", { name: /免定金原因/ }), "现场确认无需定金");
    await user.click(screen.getByRole("button", { name: "确认预订" }));

    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("暂时无法确认写入结果");
    expect(screen.queryByText("写入失败")).not.toBeInTheDocument();
  });

  it("reuses a reservation key only for the exact failed canonical body", async () => {
    const user = userEvent.setup();
    apiMocks.searchCustomers.mockResolvedValue([
      { id: "customer-1", name: "第一合成客户", phone_e164: "+390000000001" },
      { id: "customer-2", name: "第二合成客户", phone_e164: "+390000000002" },
    ]);
    apiMocks.runInventoryLifecycleCommand.mockRejectedValue(
      Object.assign(new Error("PRIVATE RESERVATION SENTINEL"), {
        status: 422,
        code: "validation_failed",
      }),
    );
    renderWithQuery(
      <InventoryReservationForm
        summary={{
          ...summaryFixture,
          allowed_actions: ["reservation.create"],
          unit_version: 2,
        }}
        storeId="store-1"
        defaultPrice={799}
        onSuccess={vi.fn()}
      />,
    );

    await user.type(screen.getByRole("combobox", { name: /客户/ }), "第一");
    await user.click(await screen.findByRole("option", { name: /第一合成客户/ }));
    const reason = screen.getByRole("textbox", { name: /免定金原因/ });
    await user.type(reason, "CANONICAL REASON");
    fireEvent.change(document.getElementById("reservation-expires")!, {
      target: { value: "2099-08-20T12:00" },
    });
    fireEvent.change(document.getElementById("reservation-pickup")!, {
      target: { value: "2099-08-15T12:00" },
    });
    const submit = screen.getByRole("button", { name: "确认预订" });
    const submitAndWait = async (calls: number) => {
      await user.click(submit);
      await waitFor(() =>
        expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(calls),
      );
    };

    await submitAndWait(1);
    await submitAndWait(2);
    const first = apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0];
    const unchangedRetry = apiMocks.runInventoryLifecycleCommand.mock.calls[1]?.[0];
    expect(unchangedRetry).toEqual(first);

    const price = screen.getByRole("textbox", { name: /成交价/ });
    await user.clear(price);
    await user.type(price, "800");
    await submitAndWait(3);
    const changedPrice = apiMocks.runInventoryLifecycleCommand.mock.calls[2]?.[0];
    expect(changedPrice.payload).toEqual({ ...first.payload, agreed_price: 800 });
    expect(changedPrice.idempotency_key).not.toBe(first.idempotency_key);

    await user.type(reason, " UPDATED");
    await submitAndWait(4);
    const changedReason = apiMocks.runInventoryLifecycleCommand.mock.calls[3]?.[0];
    expect(changedReason.payload.no_deposit_reason).toBe("CANONICAL REASON UPDATED");
    expect(changedReason.idempotency_key).not.toBe(changedPrice.idempotency_key);

    fireEvent.change(document.getElementById("reservation-expires")!, {
      target: { value: "2099-08-21T12:00" },
    });
    await submitAndWait(5);
    const changedTime = apiMocks.runInventoryLifecycleCommand.mock.calls[4]?.[0];
    expect(changedTime.payload.expires_at).toBe("2099-08-21T10:00:00.000Z");
    expect(changedTime.idempotency_key).not.toBe(changedReason.idempotency_key);

    await user.click(screen.getByRole("button", { name: "清除已选客户" }));
    await user.type(screen.getByRole("combobox", { name: /客户/ }), "第二");
    await user.click(await screen.findByRole("option", { name: /第二合成客户/ }));
    await submitAndWait(6);
    const changedCustomer = apiMocks.runInventoryLifecycleCommand.mock.calls[5]?.[0];
    expect(changedCustomer.payload.customer_id).toBe("customer-2");
    expect(changedCustomer.idempotency_key).not.toBe(changedTime.idempotency_key);
    expect(screen.queryByText("PRIVATE RESERVATION SENTINEL")).not.toBeInTheDocument();
  });

  it("contains a rejected reservation outcome readback and keeps the write locked", async () => {
    const user = userEvent.setup();
    const rawSentinel = "PRIVATE-RESERVATION-READBACK";
    const verify = vi.fn().mockRejectedValue(new Error(rawSentinel));
    apiMocks.searchCustomers.mockResolvedValue([
      { id: "customer-1", name: "合成客户", phone_e164: "+390000000000" },
    ]);
    apiMocks.runInventoryLifecycleCommand.mockRejectedValueOnce(new TypeError("network failed"));
    renderWithQuery(
      <InventoryReservationForm
        summary={{
          ...summaryFixture,
          allowed_actions: ["reservation.create"],
          unit_version: 2,
        }}
        storeId="store-1"
        defaultPrice={799}
        onSuccess={vi.fn()}
        onVerify={verify}
      />,
    );

    await user.type(screen.getByRole("combobox", { name: /客户/ }), "合成");
    await user.click(await screen.findByRole("option", { name: /合成客户/ }));
    await user.type(screen.getByRole("textbox", { name: /免定金原因/ }), "现场确认无需定金");
    await user.click(screen.getByRole("button", { name: "确认预订" }));
    expect(await screen.findByText("暂时无法确认写入结果")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /读取最新状态/ }));
    await waitFor(() => expect(verify).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/读取最新状态失败/)).toBeVisible();
    expect(screen.queryByText(rawSentinel)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认预订" })).toBeDisabled();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
  });

  it("rotates the reservation idempotency key only after readback and never auto-replays", async () => {
    const user = userEvent.setup();
    const verify = vi.fn().mockResolvedValue(undefined);
    apiMocks.searchCustomers.mockResolvedValue([
      { id: "customer-1", name: "合成客户", phone_e164: "+390000000000" },
    ]);
    apiMocks.runInventoryLifecycleCommand
      .mockRejectedValueOnce(
        Object.assign(new Error("raw conflict detail"), {
          status: 409,
          code: "idempotency_conflict",
        }),
      )
      .mockResolvedValueOnce({ ok: true, code: "created" });
    renderWithQuery(
      <InventoryReservationForm
        summary={{
          ...summaryFixture,
          allowed_actions: ["reservation.create"],
          unit_version: 2,
        }}
        storeId="store-1"
        defaultPrice={799}
        onSuccess={vi.fn()}
        onVerify={verify}
      />,
    );

    await user.type(screen.getByRole("combobox", { name: /客户/ }), "合成");
    await user.click(await screen.findByRole("option", { name: /合成客户/ }));
    await user.type(screen.getByRole("textbox", { name: /免定金原因/ }), "现场确认无需定金");
    await user.click(screen.getByRole("button", { name: "确认预订" }));
    expect(await screen.findByText("保存标识需要更新")).toBeVisible();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("raw conflict detail")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "刷新最新状态" }));
    await waitFor(() => expect(screen.queryByText("保存标识需要更新")).not.toBeInTheDocument());
    expect(verify).toHaveBeenCalledTimes(1);
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "确认预订" }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(2));
    const calls = apiMocks.runInventoryLifecycleCommand.mock.calls;
    expect(calls[0]?.[0]?.idempotency_key).toEqual(expect.any(String));
    expect(calls[1]?.[0]?.idempotency_key).toEqual(expect.any(String));
    expect(calls[1]?.[0]?.idempotency_key).not.toBe(calls[0]?.[0]?.idempotency_key);
  });

  it("renders independent read-only sales and after-sales routes without inventing data", () => {
    render(<InventoryLifecycleReadonlyScreen kind="sale" recordId="sale-1" />);

    expect(screen.getByRole("heading", { name: "销售详情" })).toBeVisible();
    expect(screen.getByText(/尚未提供销售订单详情/)).toBeVisible();
    expect(screen.getByText("写入保护")).toBeVisible();
  });

  it("shows an explicit untested state instead of converting an absent battery value to zero", () => {
    render(
      <InventoryDeviceHealthCard
        category="phone"
        brand="Apple"
        specifications={{ face_id_status: "normal" }}
      />,
    );

    expect(screen.getByText("电池健康")).toBeVisible();
    expect(screen.getAllByText("尚未检测").length).toBeGreaterThan(0);
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("shows only the server-owned close transition after an item is returned", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue({
      case_id: "case-1",
      sale_order_id: "sale-1",
      inventory_item_id: "item-1",
      stock_unit_id: "unit-1",
      sku: "I000001",
      status: "returned",
      issue_summary: "屏幕检测完成，设备已返还",
      received_at: "2026-08-01T08:00:00.000Z",
      returned_at: "2026-08-02T08:00:00.000Z",
      version: 3,
      order_version: 2,
      allowed_actions: ["after_sales.close"],
      allowed_next_statuses: ["closed"],
      diagnosis: "已完成检测并返还设备",
      events: [],
    });
    apiMocks.runInventoryLifecycleCommand.mockResolvedValueOnce({ ok: true, code: "closed" });
    renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);

    expect(await screen.findByRole("button", { name: "确认关闭案件" })).toBeVisible();
    const statusSelect = screen.getAllByRole("combobox")[0];
    expect(statusSelect).toHaveValue("closed");
    expect(statusSelect.querySelectorAll("option")).toHaveLength(1);
    expect(screen.queryByText("处理中")).not.toBeInTheDocument();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();

    const closeButton = screen.getByRole("button", { name: "确认关闭案件" });
    await user.click(closeButton);
    expect(screen.getByRole("alertdialog")).toBeVisible();
    await waitFor(() => expect(screen.getByRole("button", { name: "继续编辑" })).toHaveFocus());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();

    await user.click(closeButton);
    await user.click(screen.getByRole("button", { name: "确认关闭案件" }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledWith(
      {
        command: "after_sales.close",
        idempotency_key: expect.any(String),
        payload: {
          case_id: "case-1",
          expected_case_version: 3,
          status: "closed",
          diagnosis: "已完成检测并返还设备",
          coverage_decision: "pending",
        },
      },
      expect.anything(),
    );
  });

  it("renders after-sales history as a server event ledger with neutral unknown labels", async () => {
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue({
      ...afterSalesFixture,
      events: [
        {
          event_type: "created",
          occurred_at: "2026-08-01T08:00:00.000Z",
        },
        {
          event_type: "private_internal_type",
          from_status: "open",
          to_status: "waiting_customer",
          occurred_at: "2026-08-02T08:00:00.000Z",
        },
      ],
    });
    renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);

    expect(await screen.findByRole("heading", { name: "案件历史（服务端事件账）" })).toBeVisible();
    expect(screen.getByText("业务事件")).toBeVisible();
    expect(screen.getByText("待检测 → 等客户")).toBeVisible();
  });

  it("requires a consequence confirmation before reservation.cancel", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue(saleFixture);
    apiMocks.runInventoryLifecycleCommand.mockResolvedValue({ ok: true, code: "cancelled" });
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.click(await screen.findByText("更多管理操作"));
    const reason = screen.getByRole("textbox");
    await user.type(reason, "客户改变取货安排");
    await user.selectOptions(screen.getByRole("combobox"), "refund_pending");

    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    expect(screen.getByRole("alertdialog")).toBeVisible();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "继续编辑" })).toHaveFocus());

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeVisible());
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledWith(
      {
        command: "reservation.cancel",
        idempotency_key: expect.any(String),
        payload: {
          sale_order_id: "sale-1",
          expected_order_version: 7,
          expected_unit_version: 4,
          disposition: "refund_pending",
          reason: "客户改变取货安排",
        },
      },
      expect.anything(),
    );
  });

  it("shows a structured sale conflict and reloads without replaying the command", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue(saleFixture);
    apiMocks.runInventoryLifecycleCommand.mockRejectedValueOnce(
      Object.assign(new Error("localized conflict text"), {
        status: 409,
        code: "stale_version",
      }),
    );
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.click(await screen.findByText("更多管理操作"));
    await user.type(screen.getByRole("textbox"), "客户改变取货安排");
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    expect(await screen.findByText("资料版本已变化")).toBeVisible();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
    const conflictedInput = apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0];

    const readCount = apiMocks.readInventoryLifecycleSale.mock.calls.length;
    apiMocks.readInventoryLifecycleSale.mockResolvedValue({
      ...saleFixture,
      order_version: 8,
    });
    await user.click(screen.getByRole("button", { name: "刷新最新状态" }));
    await waitFor(() =>
      expect(apiMocks.readInventoryLifecycleSale.mock.calls.length).toBeGreaterThan(readCount),
    );
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("没有自动重放");

    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(2));
    const recoveredInput = apiMocks.runInventoryLifecycleCommand.mock.calls[1]?.[0];
    expect(recoveredInput.payload).toEqual({
      ...conflictedInput.payload,
      expected_order_version: 8,
    });
    expect(recoveredInput.idempotency_key).not.toBe(conflictedInput.idempotency_key);
  });

  it("keeps an unknown sale outcome read-only until a latest-state check succeeds", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue(saleFixture);
    apiMocks.runInventoryLifecycleCommand.mockRejectedValueOnce(new Error("private raw failure"));
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.click(await screen.findByText("更多管理操作"));
    await user.type(screen.getByRole("textbox"), "客户改变取货安排");
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));

    expect(await screen.findByText("暂时无法确认写入结果")).toBeVisible();
    expect(screen.queryByText("private raw failure")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认取消预订" })).toBeDisabled();
    const readCount = apiMocks.readInventoryLifecycleSale.mock.calls.length;
    await user.click(screen.getByRole("button", { name: /读取最新状态（不会写入）/ }));
    await waitFor(() =>
      expect(apiMocks.readInventoryLifecycleSale.mock.calls.length).toBeGreaterThan(readCount),
    );
    expect(screen.getByText(/已读取最新状态；没有自动重放刚才的写入/)).toBeVisible();
    expect(screen.getByRole("button", { name: "确认取消预订" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "我已核对最新状态" }));
    expect(screen.getByRole("button", { name: "确认取消预订" })).toBeEnabled();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
  });

  it("re-locks sale writes after an acknowledged timeout is followed by a read error", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue(saleFixture);
    apiMocks.runInventoryLifecycleCommand.mockRejectedValueOnce(
      Object.assign(new Error("timeout sentinel"), { name: "RepairDeskRequestTimeoutError" }),
    );
    const view = renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.click(await screen.findByText("更多管理操作"));
    await user.type(screen.getByRole("textbox"), "客户改变取货安排");
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    expect(await screen.findByText("暂时无法确认写入结果")).toBeVisible();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /读取最新状态（不会写入）/ }));
    await waitFor(() =>
      expect(screen.getByText(/已读取最新状态；没有自动重放刚才的写入/)).toBeVisible(),
    );
    await user.click(screen.getByRole("button", { name: "我已核对最新状态" }));
    expect(screen.getByRole("button", { name: "确认取消预订" })).toBeEnabled();

    apiMocks.readInventoryLifecycleSale.mockRejectedValueOnce(new Error("readback timeout"));
    await view.queryClient.refetchQueries({
      queryKey: inventoryLifecycleKeys.sale("sale-1", "store-1"),
    });

    expect(await screen.findByText("资料需要只读刷新")).toBeVisible();
    expect(screen.getByRole("button", { name: "确认取消预订" })).toBeDisabled();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
  });

  it("reloads after an after-sales conflict and clearly warns that local notes are replaced", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue(afterSalesFixture);
    apiMocks.runInventoryLifecycleCommand.mockRejectedValueOnce(
      Object.assign(new Error("当前状态不能推进"), {
        status: 409,
        code: "invalid_state",
      }),
    );
    renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);

    const save = await screen.findByRole("button", { name: "保存并追加历史" });
    await user.click(save);
    expect(await screen.findByText("当前状态不允许此操作")).toBeVisible();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
    const conflictedInput = apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0];

    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue({
      ...afterSalesFixture,
      version: 4,
      diagnosis: "服务端最新说明",
    });
    await user.click(screen.getByRole("button", { name: "刷新最新状态" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("按服务端最新值重载"));
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "保存并追加历史" }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(2));
    const recoveredInput = apiMocks.runInventoryLifecycleCommand.mock.calls[1]?.[0];
    expect(recoveredInput.payload).toEqual({
      ...conflictedInput.payload,
      expected_case_version: 4,
      diagnosis: "服务端最新说明",
    });
    expect(recoveredInput.idempotency_key).not.toBe(conflictedInput.idempotency_key);
  });

  it("preserves a dirty after-sales diagnosis until an explicit latest-load recovery", async () => {
    const user = userEvent.setup();
    const serverChanged = {
      ...afterSalesFixture,
      version: 4,
      diagnosis: "服务端最新说明",
    };
    apiMocks.readInventoryLifecycleAfterSalesCase
      .mockResolvedValueOnce(afterSalesFixture)
      .mockResolvedValue(serverChanged);
    const view = renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);

    const diagnosis = await screen.findByRole("textbox", { name: /检测与处理说明/ });
    await user.clear(diagnosis);
    await user.type(diagnosis, "本地未保存说明");
    await view.queryClient.refetchQueries({
      queryKey: inventoryLifecycleKeys.afterSalesCase("case-1", "store-1"),
    });

    expect(await screen.findByText("服务端案件已变化")).toBeVisible();
    expect(diagnosis).toHaveValue("本地未保存说明");
    expect(screen.getByRole("button", { name: "当前不可写入" })).toBeDisabled();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "刷新最新状态" }));
    await waitFor(() => expect(screen.queryByText("服务端案件已变化")).not.toBeInTheDocument());
    expect(diagnosis).toHaveValue("服务端最新说明");
    expect(screen.getByRole("button", { name: "保存并追加历史" })).toBeEnabled();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue(afterSalesFixture);
  });

  it("re-locks after-sales writes after an acknowledged timeout is followed by a read error", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue(afterSalesFixture);
    apiMocks.runInventoryLifecycleCommand.mockRejectedValueOnce(
      Object.assign(new Error("timeout sentinel"), { name: "RepairDeskRequestTimeoutError" }),
    );
    const view = renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);

    const save = await screen.findByRole("button", { name: "保存并追加历史" });
    await user.click(save);
    expect(await screen.findByText("暂时无法确认写入结果")).toBeVisible();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /读取最新状态（不会写入）/ }));
    await waitFor(() =>
      expect(screen.getByText(/已读取最新状态；没有自动重放刚才的写入/)).toBeVisible(),
    );
    await user.click(screen.getByRole("button", { name: "我已核对最新状态" }));
    expect(screen.getByRole("button", { name: "保存并追加历史" })).toBeEnabled();

    apiMocks.readInventoryLifecycleAfterSalesCase.mockRejectedValueOnce(
      new Error("readback timeout"),
    );
    await view.queryClient.refetchQueries({
      queryKey: inventoryLifecycleKeys.afterSalesCase("case-1", "store-1"),
    });

    expect(await screen.findByText("资料需要只读刷新")).toBeVisible();
    expect(screen.getByRole("button", { name: "当前不可写入" })).toBeDisabled();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
  });

  it("keeps a committed sale safe when post-commit reads fail and retry never mutates", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale
      .mockResolvedValueOnce(saleFixture)
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(saleFixture);
    apiMocks.runInventoryLifecycleCommand.mockResolvedValue({ ok: true, code: "cancelled" });
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.click(await screen.findByText("更多管理操作"));
    await user.type(screen.getByRole("textbox"), "客户改变取货安排");
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));

    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("预订取消已确认")).toBeVisible();
    expect(await screen.findByText("写入已完成，但同步最新状态失败")).toBeVisible();
    expect(screen.queryByText("操作失败，请刷新后重试。")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认取消预订" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "重试同步" }));
    await waitFor(() => expect(screen.getByText(/当前页面已恢复可用/)).toBeVisible());
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
  });

  it("keeps a committed after-sales update out of the mutation error path", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleAfterSalesCase
      .mockResolvedValueOnce(afterSalesFixture)
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(afterSalesFixture);
    apiMocks.runInventoryLifecycleCommand.mockResolvedValue({ ok: true, code: "updated" });
    renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);

    const save = await screen.findByRole("button", { name: "保存并追加历史" });
    await user.click(save);
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("售后更新已确认")).toBeVisible();
    expect(await screen.findByText("写入已完成，但同步最新状态失败")).toBeVisible();
    expect(screen.queryByText("保存失败，请刷新后重试。")).not.toBeInTheDocument();
    expect(save).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "重试同步" }));
    await waitFor(() => expect(screen.getByText(/当前页面已恢复可用/)).toBeVisible());
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
  });

  it("treats the committed after-sales v3 to v4 readback as self-commit, not a dirty conflict", async () => {
    const user = userEvent.setup();
    const committedReadback = {
      ...afterSalesFixture,
      version: 4,
      diagnosis: "服务端确认的新说明",
    };
    apiMocks.readInventoryLifecycleAfterSalesCase
      .mockResolvedValueOnce(afterSalesFixture)
      .mockResolvedValueOnce(committedReadback)
      .mockResolvedValueOnce(committedReadback);
    apiMocks.runInventoryLifecycleCommand.mockResolvedValueOnce({
      ok: true,
      code: "updated",
      case_version: 4,
    });
    renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);

    const save = await screen.findByRole("button", { name: "保存并追加历史" });
    await user.click(save);
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("售后更新已确认")).toBeVisible();
    await waitFor(() =>
      expect(document.querySelector("[data-ui='inventory-sync-status-panel']")).toHaveAttribute(
        "data-sync-status",
        "recovered",
      ),
    );
    expect(screen.queryByText("服务端案件已变化")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /检测与处理说明/ })).toHaveValue(
      "服务端确认的新说明",
    );
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
  });

  it("does not render a previous sale snapshot after the store key changes", async () => {
    apiMocks.readInventoryLifecycleSale
      .mockResolvedValueOnce(saleFixture)
      .mockRejectedValue(new Error("store read unavailable"));
    const view = renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);
    expect(await screen.findByText(/STORY-SALE-001/)).toBeVisible();

    shellMocks.value = {
      ...shellContext(),
      activeStore: { id: "store-2" },
      authorityFingerprint: "store-2:owner",
    };
    view.rerender(
      <QueryClientProvider client={view.queryClient}>
        <InventoryLifecycleSaleScreen saleOrderId="sale-1" />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "暂时无法读取生命周期资料" })).toBeVisible(),
    );
    expect(screen.queryByText("STORY-SALE-001")).not.toBeInTheDocument();
  });

  it("keeps cached sale data read-only when a background read fails, then unlocks after readback", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValueOnce(saleFixture);
    const view = renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);
    expect(await screen.findByText(/STORY-SALE-001/)).toBeVisible();

    apiMocks.readInventoryLifecycleSale.mockRejectedValueOnce(new Error("synthetic read failure"));
    await view.queryClient.refetchQueries({
      queryKey: ["inventory-lifecycle", "sale"],
    });

    expect(await screen.findByText("资料需要只读刷新")).toBeVisible();
    expect(screen.getByRole("button", { name: "确认取消预订" })).toBeDisabled();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();

    apiMocks.readInventoryLifecycleSale.mockResolvedValueOnce(saleFixture);
    await user.click(screen.getByRole("button", { name: /只读刷新最新状态/ }));
    await waitFor(() => expect(screen.getByText("最新状态已读取")).toBeVisible());
    expect(screen.getByRole("button", { name: "确认取消预订" })).toBeEnabled();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
  });

  it("locks a cached reservation summary after a read error without mutating", async () => {
    apiMocks.readInventoryLifecycleSummary.mockResolvedValueOnce({
      ...summaryFixture,
      allowed_actions: ["reservation.create"],
    });
    const view = renderWithQuery(<InventoryLifecycleReservationScreen itemId="item-1" />);
    expect(await screen.findByRole("button", { name: "确认预订" })).toBeVisible();

    apiMocks.readInventoryLifecycleSummary.mockRejectedValueOnce(
      new Error("synthetic read failure"),
    );
    await view.queryClient.refetchQueries({
      queryKey: ["inventory-lifecycle", "summary"],
    });
    expect(await screen.findByText("资料需要只读刷新")).toBeVisible();
    expect(screen.getByRole("button", { name: "确认预订" })).toBeDisabled();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
  });

  it("keeps a cached after-sales case visible but read-only after a failed refresh", async () => {
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValueOnce(afterSalesFixture);
    const view = renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);
    expect(await screen.findByRole("button", { name: "保存并追加历史" })).toBeVisible();

    apiMocks.readInventoryLifecycleAfterSalesCase.mockRejectedValueOnce(
      new Error("synthetic read failure"),
    );
    await view.queryClient.refetchQueries({
      queryKey: ["inventory-lifecycle", "after-sales-case"],
    });
    expect(await screen.findByText("资料需要只读刷新")).toBeVisible();
    expect(screen.getByRole("button", { name: "当前不可写入" })).toBeDisabled();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
  });
});

function renderWithQuery(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    ...render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>),
    queryClient,
  };
}

function TestLocaleToggle({ target }: { target: AppLocale }) {
  const { setLocale } = useLocale();
  return (
    <button type="button" aria-label={`switch-to-${target}`} onClick={() => setLocale(target)}>
      switch
    </button>
  );
}

async function expectCanonicalCommand(expected: Record<string, unknown>) {
  await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
  const input = apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0];
  expect(input.idempotency_key).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect({ ...input, idempotency_key: "<uuid>" }).toEqual(expected);
}

function shellContext(overrides: Record<string, boolean> = {}) {
  return {
    isLoading: false,
    activeStore: { id: "store-1" },
    authorityFingerprint: "store-1:owner",
    permissions: {
      canReadInventory: true,
      inventoryProductsUiEnabled: true,
      inventoryLifecycleUiEnabled: true,
      ...overrides,
    },
  };
}

const productFixture = {
  id: "item-1",
  sku: "I000001",
  category: "phone" as const,
  brand: "Apple",
  model: "iPhone 15 Pro",
  status: "in_stock" as const,
  currency_code: "EUR" as const,
  updated_at: "2026-08-01T08:00:00.000Z",
  list_price: 899,
  version: 2,
  identifiers: [],
  specifications: {},
};

const summaryFixture = {
  item_id: "item-1",
  stock_unit_id: "unit-1",
  sku: "I000001",
  business_status: "in_stock" as const,
  unit_version: 2,
  allowed_actions: [],
};

const saleFixture = {
  item_id: "item-1",
  stock_unit_id: "unit-1",
  sku: "STORY-SALE-001",
  business_status: "reserved" as const,
  unit_version: 4,
  order_version: 7,
  sale_order_id: "sale-1",
  inventory_item_id: "item-1",
  status: "reserved" as const,
  agreed_price: 799,
  signed_paid_amount: 100,
  balance: 699,
  payments: [],
  allowed_actions: ["reservation.cancel"] as const,
};

const afterSalesFixture = {
  case_id: "case-1",
  sale_order_id: "sale-1",
  inventory_item_id: "item-1",
  stock_unit_id: "unit-1",
  sku: "STORY-SALE-001",
  status: "in_progress" as const,
  issue_summary: "合成售后案件",
  received_at: "2026-08-01T08:00:00.000Z",
  version: 3,
  order_version: 7,
  allowed_actions: ["after_sales.update"] as const,
  allowed_next_statuses: ["waiting_customer"] as const,
  diagnosis: "合成检测说明",
  coverage_decision: "pending" as const,
  events: [],
};

const afterSalesQueueFixture = {
  case_id: "queue-case-1",
  sale_order_id: "queue-sale-1",
  inventory_item_id: "queue-item-1",
  stock_unit_id: "queue-unit-1",
  sku: "DYNAMIC-QUEUE-SKU",
  status: "open" as const,
  issue_summary: "DYNAMIC QUEUE ISSUE",
  received_at: "2026-08-01T08:00:00.000Z",
  version: 1,
  order_version: 1,
  allowed_actions: ["after_sales.update"] as const,
  allowed_next_statuses: ["in_progress"] as const,
};
