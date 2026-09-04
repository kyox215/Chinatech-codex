import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

const apiMocks = vi.hoisted(() => ({
  getPartsProcurement: vi.fn(),
  allocateOrderPart: vi.fn(),
  releaseOrderPart: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  getPartsProcurement: apiMocks.getPartsProcurement,
  allocateOrderPart: apiMocks.allocateOrderPart,
  releaseOrderPart: apiMocks.releaseOrderPart,
}));
vi.mock("sonner", () => ({
  toast: { error: apiMocks.toastError, success: apiMocks.toastSuccess },
}));

import { OrderPartsAllocationPanel } from "./order-parts-allocation-panel";

const locales = ["zh-CN", "it-IT", "en"] as const;
const orderId = "11111111-1111-4111-8111-111111111111";
const storeId = "22222222-2222-4222-8222-222222222222";
const lineId = "33333333-3333-4333-8333-333333333333";
const allocationId = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.getPartsProcurement.mockResolvedValue({
    items: [],
    lots: [],
    suppliers: [],
    allocations: [
      {
        id: allocationId,
        order_id: orderId,
        line_id: lineId,
        lot_id: "lot-1",
        part_item_id: "part-1",
        supplier_id: "supplier-1",
        quantity: 1,
        part_sku: "SKU-DYNAMIC",
        part_name: "动态中文配件",
        supplier_name: "动态中文供应商",
        unit_cost_eur: 20,
        total_cost_eur: 20,
        state: "allocated",
        allocated_at: "2026-09-02T10:00:00.000Z",
      },
    ],
  });
  apiMocks.releaseOrderPart.mockResolvedValue({});
  apiMocks.allocateOrderPart.mockResolvedValue({});
});

afterEach(cleanup);

describe("OrderPartsAllocationPanel i18n", () => {
  it("localizes all locales while preserving dynamic values and the canonical release request", async () => {
    const calls: Array<Record<string, unknown>> = [];
    for (const locale of locales) {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const view = render(
        <QueryClientProvider client={client}>
          <LocaleProvider initialLocale={locale}>
            <OrderPartsAllocationPanel
              orderId={orderId}
              storeId={storeId}
              faultPrices={[{ line_id: lineId, name: "动态中文报价项", price: 60 }]}
            />
          </LocaleProvider>
        </QueryClientProvider>,
      );

      expect(
        await screen.findByText(translateMessage(locale, "orders2b2.parts.title")),
      ).toBeVisible();
      expect(await screen.findByText("动态中文报价项")).toBeVisible();
      expect(screen.getByText(/动态中文配件/)).toBeVisible();
      expect(screen.getByText(/动态中文供应商/)).toBeVisible();
      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b2.parts.release") }),
      );
      await waitFor(() => expect(apiMocks.releaseOrderPart).toHaveBeenCalledOnce());
      const input = structuredClone(apiMocks.releaseOrderPart.mock.calls[0]?.[0]) as Record<
        string,
        unknown
      >;
      expect(input).toMatchObject({
        expected_store_id: storeId,
        allocation_id: allocationId,
        reason: "工单配件分配纠正",
        idempotency_key: expect.any(String),
      });
      input.idempotency_key = "<uuid>";
      calls.push(input);
      view.unmount();
      apiMocks.releaseOrderPart.mockClear();
    }

    expect(calls[1]).toEqual(calls[0]);
    expect(calls[2]).toEqual(calls[0]);
  });

  it("submits locale-neutral allocation IDs and quantity in all locales", async () => {
    const calls: Array<Record<string, unknown>> = [];
    for (const locale of locales) {
      apiMocks.getPartsProcurement.mockResolvedValueOnce({
        items: [],
        suppliers: [],
        allocations: [],
        lots: [availableLot()],
      });
      const view = renderPanel(locale);
      expect(await screen.findByText("动态中文报价项")).toBeVisible();
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b2.parts.allocateOne"),
        }),
      );
      await waitFor(() => expect(apiMocks.allocateOrderPart).toHaveBeenCalledOnce());
      const [capturedOrderId, capturedInput] = structuredClone(
        apiMocks.allocateOrderPart.mock.calls[0]!,
      ) as [string, Record<string, unknown>];
      expect(capturedOrderId).toBe(orderId);
      expect(capturedInput).toMatchObject({
        expected_store_id: storeId,
        line_id: lineId,
        lot_id: "lot-dynamic",
        quantity: 1,
        idempotency_key: expect.any(String),
      });
      capturedInput.idempotency_key = "<uuid>";
      calls.push(capturedInput);
      view.unmount();
      apiMocks.allocateOrderPart.mockClear();
    }
    expect(calls[1]).toEqual(calls[0]);
    expect(calls[2]).toEqual(calls[0]);
  });

  it.each(locales)(
    "shows a safe localized %s allocation error without losing selection",
    async (locale) => {
      const sentinel = "PARTS_SECRET_SENTINEL";
      apiMocks.getPartsProcurement.mockResolvedValueOnce({
        items: [],
        suppliers: [],
        allocations: [],
        lots: [availableLot()],
      });
      apiMocks.allocateOrderPart.mockRejectedValueOnce(new Error(sentinel));
      renderPanel(locale);
      await screen.findByText("动态中文报价项");
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b2.parts.allocateOne"),
        }),
      );
      await waitFor(() =>
        expect(apiMocks.toastError).toHaveBeenCalledWith(
          translateMessage(locale, "orders2b2.error.generic", {
            operation: translateMessage(locale, "orders2b2.operation.save"),
          }),
        ),
      );
      expect(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b2.parts.allocateOne"),
        }),
      ).toBeEnabled();
      expect(JSON.stringify(apiMocks.toastError.mock.calls)).not.toContain(sentinel);
    },
  );

  it.each(locales)(
    "shows a safe localized %s release error with the exact canonical request",
    async (locale) => {
      const sentinel = "PART_RELEASE_SECRET_SENTINEL";
      apiMocks.releaseOrderPart.mockRejectedValueOnce(new Error(sentinel));
      renderPanel(locale);
      await screen.findByText(/动态中文配件/);

      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b2.parts.release") }),
      );

      await waitFor(() => expect(apiMocks.releaseOrderPart).toHaveBeenCalledOnce());
      expect(apiMocks.releaseOrderPart).toHaveBeenCalledWith({
        expected_store_id: storeId,
        allocation_id: allocationId,
        reason: "工单配件分配纠正",
        idempotency_key: expect.any(String),
      });
      await waitFor(() =>
        expect(apiMocks.toastError).toHaveBeenCalledWith(
          translateMessage(locale, "orders2b2.error.generic", {
            operation: translateMessage(locale, "orders2b2.operation.save"),
          }),
        ),
      );
      expect(apiMocks.releaseOrderPart).toHaveBeenCalledTimes(1);
      expect(apiMocks.toastError).toHaveBeenCalledTimes(1);
      expect(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b2.parts.release") }),
      ).toBeEnabled();
      expect(JSON.stringify(apiMocks.toastError.mock.calls)).not.toContain(sentinel);
    },
  );
});

function renderPanel(locale: (typeof locales)[number]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LocaleProvider initialLocale={locale}>
        <OrderPartsAllocationPanel
          orderId={orderId}
          storeId={storeId}
          faultPrices={[
            { line_id: lineId, catalog_key: "display:dynamic", name: "动态中文报价项", price: 60 },
          ]}
        />
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

function availableLot() {
  return {
    id: "lot-dynamic",
    part_item_id: "part-dynamic",
    part_sku: "SKU-DYNAMIC",
    part_name: "动态中文配件",
    catalog_key: "display:dynamic",
    supplier_id: "supplier-dynamic",
    supplier_name: "动态中文供应商",
    lot_code: "LOT-DYNAMIC",
    received_quantity: 3,
    available_quantity: 2,
    original_unit_cost: 20,
    original_currency_code: "EUR",
    fx_rate_to_eur: 1,
    fx_rate_at: "2026-09-02T10:00:00.000Z",
    fx_rate_source: "store_base",
    unit_cost_eur: 20,
    evidence_status: "confirmed",
    received_at: "2026-09-02T10:00:00.000Z",
  };
}
