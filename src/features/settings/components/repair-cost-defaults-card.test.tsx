import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { repairServiceCatalogItems } from "@/entities/order";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import type {
  StoreFaultCostDefaultItem,
  StoreFaultCostDefaultsResult,
  UpdateStoreFaultCostDefaultsRequest,
} from "@/lib/repairdesk/types";

const apiMocks = vi.hoisted(() => ({
  getStoreFaultCostDefaults: vi.fn(),
  updateStoreFaultCostDefaults: vi.fn(),
}));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  getStoreFaultCostDefaults: apiMocks.getStoreFaultCostDefaults,
  updateStoreFaultCostDefaults: apiMocks.updateStoreFaultCostDefaults,
}));

vi.mock("@/features/settings/components/unsaved-settings-guard", () => ({
  UnsavedSettingsGuard: () => null,
}));

import { RepairCostDefaultsCard } from "./repair-cost-defaults-card";

afterEach(cleanup);

describe("RepairCostDefaultsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getStoreFaultCostDefaults.mockResolvedValue(costDefaultsFixture());
    apiMocks.updateStoreFaultCostDefaults.mockImplementation(
      async (input: UpdateStoreFaultCostDefaultsRequest) => ({
        version: input.expected_version + 1,
        currency_code: "EUR" as const,
        items: input.items,
      }),
    );
  });

  it("preserves explicit zero, saves blank as null, and replaces the store-scoped cache", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderCard();
    const mainInput = await screen.findByLabelText("屏幕默认成本");
    const glassInput = screen.getByLabelText("屏幕 - 外屏碎裂默认成本");

    expect(mainInput).toHaveValue("15");
    expect(glassInput).toHaveValue("8");
    await user.clear(mainInput);
    await user.type(mainInput, "0");
    await user.clear(glassInput);
    await user.click(screen.getByRole("button", { name: "保存默认成本" }));

    await waitFor(() => expect(apiMocks.updateStoreFaultCostDefaults).toHaveBeenCalledTimes(1));
    const request = apiMocks.updateStoreFaultCostDefaults.mock.calls[0]?.[0] as
      | UpdateStoreFaultCostDefaultsRequest
      | undefined;
    expect(request).toMatchObject({ expected_store_id: "store-a", expected_version: 2 });
    expect(costItem(request?.items, "display:main")?.default_cost_amount).toBe(0);
    expect(costItem(request?.items, "display:glass")?.default_cost_amount).toBeNull();

    expect(await screen.findByText("维修项目默认成本已保存。")).toBeVisible();
    expect(
      queryClient.getQueryData<StoreFaultCostDefaultsResult>(["orders", "cost-defaults", "store-a"])
        ?.version,
    ).toBe(3);
  });

  it("blocks invalid precision before a request is sent", async () => {
    const user = userEvent.setup();
    renderCard();
    const input = await screen.findByLabelText("屏幕默认成本");

    await user.clear(input);
    await user.type(input, "12.345");

    expect(screen.getByText("请输入最多两位小数")).toBeVisible();
    expect(screen.getByRole("button", { name: "保存默认成本" })).toBeDisabled();
    expect(apiMocks.updateStoreFaultCostDefaults).not.toHaveBeenCalled();
  });

  it("locks editing after a version conflict and reloads the latest values on demand", async () => {
    const user = userEvent.setup();
    apiMocks.getStoreFaultCostDefaults
      .mockResolvedValueOnce(costDefaultsFixture())
      .mockResolvedValueOnce(costDefaultsFixture({ version: 3, displayMain: 25 }));
    apiMocks.updateStoreFaultCostDefaults.mockRejectedValueOnce(
      new RepairDeskApiError("版本冲突", 409),
    );
    renderCard();
    const input = await screen.findByLabelText("屏幕默认成本");

    await user.clear(input);
    await user.type(input, "20");
    await user.click(screen.getByRole("button", { name: "保存默认成本" }));

    expect(await screen.findByText(/默认成本已被其他会话更新/)).toBeVisible();
    expect(input).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "重新加载最新值" }));

    await waitFor(() => expect(input).toHaveValue("25"));
    expect(input).toBeEnabled();
    expect(screen.getByText("已加载最新默认成本。")).toBeVisible();
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
      <RepairCostDefaultsCard storeId="store-a" />
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

function costDefaultsFixture({
  version = 2,
  displayMain = 15,
}: {
  version?: number;
  displayMain?: number;
} = {}): StoreFaultCostDefaultsResult {
  return {
    version,
    currency_code: "EUR",
    items: repairServiceCatalogItems.map((item) => ({
      catalog_key: item.catalogKey,
      catalog_name: item.name,
      default_cost_amount:
        item.catalogKey === "display:main"
          ? displayMain
          : item.catalogKey === "display:glass"
            ? 8
            : null,
    })),
  };
}

function costItem(items: StoreFaultCostDefaultItem[] | undefined, catalogKey: string) {
  return items?.find((item) => item.catalog_key === catalogKey);
}
