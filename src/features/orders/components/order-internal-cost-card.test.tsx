import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ordersKeys } from "@/features/orders/api/query-keys";
import type { OrderLineCostsResult } from "@/lib/repairdesk/types";

const apiMocks = vi.hoisted(() => ({
  getOrderLineCosts: vi.fn(),
  updateOrderLineCosts: vi.fn(),
}));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  getOrderLineCosts: apiMocks.getOrderLineCosts,
  updateOrderLineCosts: apiMocks.updateOrderLineCosts,
}));

vi.mock("@/components/unsaved-navigation-guard", () => ({
  UnsavedNavigationGuard: () => null,
}));

import { OrderInternalCostCard } from "./order-internal-cost-card";

const orderId = "11111111-1111-4111-8111-111111111111";
const storeId = "22222222-2222-4222-8222-222222222222";
const lineId = "33333333-3333-4333-8333-333333333333";

afterEach(cleanup);

describe("OrderInternalCostCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getOrderLineCosts.mockResolvedValue(costResult());
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
});

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <OrderInternalCostCard
        orderId={orderId}
        storeId={storeId}
        faultPrices={[{ line_id: lineId, name: "屏幕", price: 90 }]}
        canManage
      />
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

function costResult({ version = 1, amount = 15 }: { version?: number; amount?: number } = {}) {
  return {
    order_id: orderId,
    version,
    currency_code: "EUR",
    unidentified_line_count: 0,
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
