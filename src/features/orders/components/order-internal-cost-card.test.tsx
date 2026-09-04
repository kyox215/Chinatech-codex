import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ordersKeys } from "@/features/orders/api/query-keys";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import type { OrderLineCostsResult } from "@/lib/repairdesk/types";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

const apiMocks = vi.hoisted(() => ({
  getOrderLineCosts: vi.fn(),
  updateOrderLineCosts: vi.fn(),
  getPartsProcurement: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  getOrderLineCosts: apiMocks.getOrderLineCosts,
  updateOrderLineCosts: apiMocks.updateOrderLineCosts,
  getPartsProcurement: apiMocks.getPartsProcurement,
}));

vi.mock("@/components/unsaved-navigation-guard", () => ({
  UnsavedNavigationGuard: () => null,
}));
vi.mock("sonner", () => ({
  toast: { error: apiMocks.toastError, success: apiMocks.toastSuccess },
}));

import { OrderInternalCostCard } from "./order-internal-cost-card";

const orderId = "11111111-1111-4111-8111-111111111111";
const storeId = "22222222-2222-4222-8222-222222222222";
const lineId = "33333333-3333-4333-8333-333333333333";

afterEach(cleanup);

describe("OrderInternalCostCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    apiMocks.getOrderLineCosts.mockResolvedValue(costResult());
    apiMocks.updateOrderLineCosts.mockResolvedValue(costResult({ version: 2, amount: 20 }));
  });

  it("preserves a dirty draft when a newer remote version arrives until explicit reload", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderCard();
    const input = await screen.findByLabelText("屏幕 内部成本");

    await user.clear(input);
    await user.type(input, "20");
    expect(input).toHaveValue("20");

    const latest = costResult({ version: 2, amount: 25 });
    queryClient.setQueryData([...ordersKeys.detail(orderId, storeId), "internal-costs"], latest);

    expect(await screen.findByText(/当前未保存输入已保留/)).toBeVisible();
    expect(input).toHaveValue("20");
    expect(input).toBeDisabled();

    apiMocks.getOrderLineCosts.mockResolvedValueOnce(latest);
    await user.click(screen.getByRole("button", { name: "重新加载最新值" }));

    await waitFor(() => expect(input).toHaveValue("25"));
    expect(input).toBeEnabled();
  });

  it("uses the strict saved amount grammar for the quote warning", async () => {
    const user = userEvent.setup();
    renderCard();
    const input = await screen.findByLabelText("屏幕 内部成本");

    await user.clear(input);
    await user.type(input, "1e2");
    expect(screen.queryByText("成本高于客户报价，请确认")).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "100");
    expect(screen.getByText("成本高于客户报价，请确认")).toBeVisible();
  });

  it("does not request procurement data without the dedicated allocation capability", async () => {
    renderCard();
    await screen.findByLabelText("屏幕 内部成本");
    expect(apiMocks.getPartsProcurement).not.toHaveBeenCalled();
    expect(screen.queryByText("配件批次联动")).not.toBeInTheDocument();
  });

  it("offers the guarded quote-line repair action for unidentified legacy lines", async () => {
    const user = userEvent.setup();
    const onRepairQuoteLines = vi.fn();
    apiMocks.getOrderLineCosts.mockResolvedValueOnce(costResult({ unidentifiedLineCount: 1 }));

    renderCard({ onRepairQuoteLines });

    await user.click(await screen.findByRole("button", { name: "修复报价项目" }));
    expect(onRepairQuoteLines).toHaveBeenCalledOnce();
  });

  it("keeps the legacy-line repair action hidden without an authorized handler", async () => {
    apiMocks.getOrderLineCosts.mockResolvedValueOnce(costResult({ unidentifiedLineCount: 1 }));

    renderCard();

    expect(await screen.findByText(/当前工单或账号不可编辑报价/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "修复报价项目" })).not.toBeInTheDocument();
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "maps every stable cost source in %s and preserves unknown codes exactly",
    async (locale) => {
      apiMocks.getOrderLineCosts.mockResolvedValueOnce({
        ...costResult(),
        items: [
          {
            line_id: lineId,
            catalog_key: "display:main",
            name: "动态手动留空",
            cost_amount: null,
            source: "manual_blank",
          },
          {
            line_id: "55555555-5555-4555-8555-555555555555",
            name: "动态历史未知",
            cost_amount: null,
            source: "historical_unknown",
          },
          {
            line_id: "66666666-6666-4666-8666-666666666666",
            name: "动态未知来源",
            cost_amount: null,
            source: "CUSTOM_SOURCE_SENTINEL",
          },
        ],
      } as unknown as OrderLineCostsResult);

      renderCard({ locale });

      expect(
        await screen.findByText(
          translateMessage(locale, "orders2b2.internalCost.source.manualBlank"),
        ),
      ).toBeVisible();
      expect(
        screen.getByText(
          translateMessage(locale, "orders2b2.internalCost.source.historicalUnknown"),
        ),
      ).toBeVisible();
      expect(screen.getByText("CUSTOM_SOURCE_SENTINEL")).toBeVisible();
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "shows localized %s load pending and safe load error states",
    async (locale) => {
      apiMocks.getOrderLineCosts.mockReturnValueOnce(new Promise(() => undefined));
      const pending = renderCard({ locale });
      expect(
        screen.getByText(translateMessage(locale, "orders2b2.internalCost.loading")),
      ).toBeVisible();
      pending.unmount();

      apiMocks.getOrderLineCosts.mockRejectedValueOnce(new Error("COST_LOAD_SECRET_SENTINEL"));
      renderCard({ locale });
      expect(await screen.findByRole("alert")).toHaveTextContent(
        translateMessage(locale, "orders2b2.error.generic", {
          operation: translateMessage(locale, "orders2b2.operation.load"),
        }),
      );
      expect(screen.queryByText("COST_LOAD_SECRET_SENTINEL")).not.toBeInTheDocument();
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "submits exact %s updates and exposes pending then success",
    async (locale) => {
      let resolveSave!: (value: OrderLineCostsResult) => void;
      apiMocks.updateOrderLineCosts.mockReturnValueOnce(
        new Promise<OrderLineCostsResult>((resolve) => {
          resolveSave = resolve;
        }),
      );
      const user = userEvent.setup();
      renderCard({ locale });
      const input = await screen.findByLabelText(
        translateMessage(locale, "orders2b2.internalCost.inputLabel", { name: "屏幕" }),
      );
      await user.clear(input);
      await user.type(input, "20");
      await user.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b2.internalCost.save"),
        }),
      );

      expect(apiMocks.updateOrderLineCosts).toHaveBeenCalledWith(orderId, {
        expected_store_id: storeId,
        expected_version: 1,
        items: [{ line_id: lineId, mode: "manual", amount: 20 }],
      });
      expect(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b2.internalCost.saving"),
        }),
      ).toBeDisabled();
      resolveSave(costResult({ version: 2, amount: 20 }));
      await waitFor(() =>
        expect(apiMocks.toastSuccess).toHaveBeenCalledWith(
          translateMessage(locale, "orders2b2.internalCost.saved"),
        ),
      );
      expect(input).toHaveValue("20");
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "keeps the %s draft after safe save error and explicit conflict",
    async (locale) => {
      const user = userEvent.setup();
      apiMocks.updateOrderLineCosts.mockRejectedValueOnce(new Error("COST_SAVE_SECRET_SENTINEL"));
      const view = renderCard({ locale });
      let input = await screen.findByLabelText(
        translateMessage(locale, "orders2b2.internalCost.inputLabel", { name: "屏幕" }),
      );
      await user.clear(input);
      await user.type(input, "20");
      await user.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b2.internalCost.save"),
        }),
      );
      await waitFor(() =>
        expect(apiMocks.toastError).toHaveBeenCalledWith(
          translateMessage(locale, "orders2b2.error.generic", {
            operation: translateMessage(locale, "orders2b2.operation.save"),
          }),
        ),
      );
      expect(input).toHaveValue("20");
      expect(JSON.stringify(apiMocks.toastError.mock.calls)).not.toContain(
        "COST_SAVE_SECRET_SENTINEL",
      );
      view.unmount();

      vi.clearAllMocks();
      apiMocks.getOrderLineCosts.mockResolvedValue(costResult());
      apiMocks.updateOrderLineCosts.mockRejectedValueOnce(
        new RepairDeskApiError("COST_CONFLICT_SECRET_SENTINEL", 409, "ORDER_WRITE_CONFLICT"),
      );
      renderCard({ locale });
      input = await screen.findByLabelText(
        translateMessage(locale, "orders2b2.internalCost.inputLabel", { name: "屏幕" }),
      );
      await user.clear(input);
      await user.type(input, "21");
      await user.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b2.internalCost.save"),
        }),
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        translateMessage(locale, "orders2b2.internalCost.conflict"),
      );
      expect(input).toHaveValue("21");
      expect(input).toBeDisabled();
      expect(JSON.stringify(apiMocks.toastError.mock.calls)).not.toContain(
        "COST_CONFLICT_SECRET_SENTINEL",
      );
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "keeps %s internal costs read-only offline with zero writes",
    async (locale) => {
      Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
      renderCard({ locale });
      const input = await screen.findByLabelText(
        translateMessage(locale, "orders2b2.internalCost.inputLabel", { name: "屏幕" }),
      );
      expect(input).toBeDisabled();
      expect(
        screen.getByText(translateMessage(locale, "orders2b2.internalCost.offline")),
      ).toBeVisible();
      expect(apiMocks.updateOrderLineCosts).not.toHaveBeenCalled();
    },
  );
});

function renderCard({
  onRepairQuoteLines,
  locale = "zh-CN",
}: {
  onRepairQuoteLines?: () => void;
  locale?: "zh-CN" | "it-IT" | "en";
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider initialLocale={locale}>
        <OrderInternalCostCard
          orderId={orderId}
          storeId={storeId}
          faultPrices={[{ line_id: lineId, name: "屏幕", price: 90 }]}
          canManage
          onRepairQuoteLines={onRepairQuoteLines}
        />
      </LocaleProvider>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

function costResult({
  version = 1,
  amount = 15,
  unidentifiedLineCount = 0,
}: {
  version?: number;
  amount?: number;
  unidentifiedLineCount?: number;
} = {}) {
  return {
    order_id: orderId,
    version,
    currency_code: "EUR",
    unidentified_line_count: unidentifiedLineCount,
    items: [
      {
        line_id: lineId,
        catalog_key: "display:main",
        name: "屏幕",
        cost_amount: amount,
        source: "manual",
      },
    ],
  } satisfies OrderLineCostsResult;
}
