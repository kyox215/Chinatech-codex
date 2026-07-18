import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CostCurrencySettingsResult,
  UpdateCostCurrencySettingsInput,
} from "@/lib/repairdesk/types";

const apiMocks = vi.hoisted(() => ({
  readCostCurrencySettings: vi.fn(),
  updateCostCurrencySettings: vi.fn(),
}));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  readCostCurrencySettings: apiMocks.readCostCurrencySettings,
  updateCostCurrencySettings: apiMocks.updateCostCurrencySettings,
}));
vi.mock("@/features/settings/components/unsaved-settings-guard", () => ({
  UnsavedSettingsGuard: () => null,
}));

import { CostCurrencySettingsCard } from "./cost-currency-settings-card";

afterEach(cleanup);

describe("CostCurrencySettingsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.readCostCurrencySettings.mockResolvedValue(fixture());
    apiMocks.updateCostCurrencySettings.mockImplementation(
      async (input: UpdateCostCurrencySettingsInput): Promise<CostCurrencySettingsResult> => ({
        version: input.expected_version + 1,
        items: input.items.map((item) => ({
          ...item,
          rate_at: item.rate_at,
          rate_source:
            item.currency_code === "EUR" ? "store_base" : item.enabled ? "owner_manual" : undefined,
          revision: input.expected_version + 1,
          stale: false,
        })),
      }),
    );
  });

  it("locks EUR at one and saves a complete owner-managed currency set", async () => {
    const user = userEvent.setup();
    renderCard();
    const eur = await screen.findByLabelText("EUR 兑 EUR 汇率");
    const usd = screen.getByLabelText("USD 兑 EUR 汇率");

    expect(eur).toBeDisabled();
    expect(eur).toHaveValue(1);
    await user.clear(usd);
    await user.type(usd, "0.88");
    await user.click(screen.getByRole("button", { name: "保存汇率设置" }));

    await waitFor(() => expect(apiMocks.updateCostCurrencySettings).toHaveBeenCalledTimes(1));
    const request = apiMocks.updateCostCurrencySettings.mock
      .calls[0]?.[0] as UpdateCostCurrencySettingsInput;
    expect(request).toMatchObject({ expected_store_id: "store-a", expected_version: 1 });
    expect(request.items).toHaveLength(5);
    expect(request.items.find((item) => item.currency_code === "USD")).toMatchObject({
      enabled: true,
      rate_to_eur: 0.88,
    });
    expect(request.items.find((item) => item.currency_code === "EUR")).toMatchObject({
      enabled: true,
      rate_to_eur: 1,
    });
  });

  it("labels stale rates and blocks invalid enabled rates before save", async () => {
    const user = userEvent.setup();
    apiMocks.readCostCurrencySettings.mockResolvedValue(fixture({ usdStale: true }));
    renderCard();
    const usd = await screen.findByLabelText("USD 兑 EUR 汇率");
    expect(screen.getByText("已超过 30 天，新采购将被阻止")).toBeVisible();

    await user.clear(usd);
    await user.type(usd, "0");
    expect(screen.getByText("请输入有效正数汇率。")).toBeVisible();
    expect(screen.getByRole("button", { name: "保存汇率设置" })).toBeDisabled();
    expect(apiMocks.updateCostCurrencySettings).not.toHaveBeenCalled();
  });
});

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CostCurrencySettingsCard storeId="store-a" />
    </QueryClientProvider>,
  );
}

function fixture({ usdStale = false }: { usdStale?: boolean } = {}): CostCurrencySettingsResult {
  return {
    version: 1,
    items: [
      {
        currency_code: "EUR",
        enabled: true,
        rate_to_eur: 1,
        rate_at: "2026-07-18T10:00:00.000Z",
        rate_source: "store_base",
        revision: 1,
        stale: false,
      },
      {
        currency_code: "USD",
        enabled: true,
        rate_to_eur: 0.92,
        rate_at: "2026-07-18T10:00:00.000Z",
        rate_source: "owner_manual",
        revision: 1,
        stale: usdStale,
      },
      { currency_code: "GBP", enabled: false, rate_to_eur: null, revision: 1, stale: false },
      {
        currency_code: "CNY",
        enabled: true,
        rate_to_eur: 0.12,
        rate_at: "2026-07-18T10:00:00.000Z",
        rate_source: "owner_manual",
        revision: 1,
        stale: false,
      },
      { currency_code: "CHF", enabled: false, rate_to_eur: null, revision: 1, stale: false },
    ],
  };
}
