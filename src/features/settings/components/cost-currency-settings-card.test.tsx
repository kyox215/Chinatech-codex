import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CostCurrencySettingsResult,
  UpdateCostCurrencySettingsInput,
} from "@/lib/repairdesk/types";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

const apiMocks = vi.hoisted(() => ({
  readCostCurrencySettings: vi.fn(),
  updateCostCurrencySettings: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: apiMocks.toastSuccess, error: apiMocks.toastError },
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

  it.each([
    ["zh-CN", "USD 兑 EUR 汇率", "保存汇率设置"],
    ["it-IT", "Tasso USD in EUR", "Salva tassi"],
    ["en", "USD to EUR rate", "Save rate settings"],
  ] as const)(
    "sends one exact locale-free save body and retains rejected drafts in %s",
    async (locale, rateLabel, saveLabel) => {
      const frozenTimestamp = "2026-09-03T12:34:56.000Z";
      vi.spyOn(Date.prototype, "toISOString").mockReturnValue(frozenTimestamp);
      const pending = deferred<CostCurrencySettingsResult>();
      apiMocks.updateCostCurrencySettings.mockReturnValueOnce(pending.promise);
      const user = userEvent.setup();
      renderCard(locale);
      const usd = await screen.findByLabelText(rateLabel);
      await user.clear(usd);
      await user.type(usd, "0.88");
      const save = screen.getByRole("button", { name: saveLabel });
      fireEvent.click(save);
      fireEvent.click(save);

      await waitFor(() => expect(apiMocks.updateCostCurrencySettings).toHaveBeenCalledTimes(1));
      expect(apiMocks.updateCostCurrencySettings.mock.calls[0]?.[0]).toEqual({
        expected_store_id: "store-a",
        expected_version: 1,
        items: [
          {
            currency_code: "EUR",
            enabled: true,
            rate_to_eur: 1,
            rate_at: "2026-07-18T10:00:00.000Z",
          },
          { currency_code: "USD", enabled: true, rate_to_eur: 0.88, rate_at: frozenTimestamp },
          { currency_code: "GBP", enabled: false, rate_to_eur: null, rate_at: undefined },
          {
            currency_code: "CNY",
            enabled: true,
            rate_to_eur: 0.12,
            rate_at: "2026-07-18T10:00:00.000Z",
          },
          { currency_code: "CHF", enabled: false, rate_to_eur: null, rate_at: undefined },
        ],
      });
      pending.reject(new Error("RAW_DATABASE_DETAILS_SENTINEL"));
      await waitFor(() => expect(apiMocks.toastError).toHaveBeenCalledTimes(1));
      expect(usd).toHaveValue(0.88);
      expect(apiMocks.toastError.mock.calls.flat().join(" ")).not.toContain("RAW_DATABASE");
      expect(document.body).not.toHaveTextContent("RAW_DATABASE_DETAILS_SENTINEL");
    },
  );

  it.each([
    ["zh-CN", "2026年7月18日 12:00", "时间无效"],
    ["it-IT", "18 lug 2026, 12:00", "Data non valida"],
    ["en", "Jul 18, 2026, 12:00 PM", "Invalid date"],
  ] as const)(
    "formats Rome timestamps and invalid values exactly in %s",
    async (locale, expected, invalid) => {
      const current = fixture();
      current.items[2] = {
        currency_code: "GBP",
        enabled: true,
        rate_to_eur: 1.1,
        rate_at: "not-a-date",
        rate_source: "owner_manual",
        revision: 1,
        stale: false,
      };
      apiMocks.readCostCurrencySettings.mockResolvedValue(current);
      renderCard(locale);
      expect(await screen.findAllByText(expected)).not.toHaveLength(0);
      expect(screen.getByText(invalid)).toBeVisible();
      expect(document.body).not.toHaveTextContent("not-a-date");
    },
  );

  it("preserves a focused rate draft across locale switch with zero requests", async () => {
    renderCard("en", "store-a", true);
    const usd = await screen.findByLabelText("USD to EUR rate");
    fireEvent.change(usd, { target: { value: "0.811" } });
    usd.focus();
    const reads = apiMocks.readCostCurrencySettings.mock.calls.length;
    fireEvent.click(screen.getByTestId("switch-it"));

    expect(await screen.findByLabelText("Tasso USD in EUR")).toBe(usd);
    expect(usd).toHaveValue(0.811);
    expect(usd).toHaveFocus();
    expect(apiMocks.readCostCurrencySettings).toHaveBeenCalledTimes(reads);
    expect(apiMocks.updateCostCurrencySettings).not.toHaveBeenCalled();
  });

  it("drops a late old-store save without toast or cache writes", async () => {
    const pending = deferred<CostCurrencySettingsResult>();
    apiMocks.updateCostCurrencySettings.mockReturnValueOnce(pending.promise);
    const client = createClient();
    const setQueryData = vi.spyOn(client, "setQueryData");
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const view = renderCard("zh-CN", "store-a", false, client);
    const usd = await screen.findByLabelText("USD 兑 EUR 汇率");
    fireEvent.change(usd, { target: { value: "0.88" } });
    fireEvent.click(screen.getByRole("button", { name: "保存汇率设置" }));
    await waitFor(() => expect(apiMocks.updateCostCurrencySettings).toHaveBeenCalledTimes(1));

    view.rerender(currencyTree("zh-CN", "store-b", false, client));
    setQueryData.mockClear();
    invalidate.mockClear();
    await act(async () => {
      pending.resolve(fixture());
      await pending.promise;
    });

    expect(apiMocks.toastSuccess).not.toHaveBeenCalled();
    expect(setQueryData).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function currencyTree(
  locale: AppLocale,
  storeId: string,
  withLocaleSwitch: boolean,
  client: QueryClient,
) {
  return (
    <QueryClientProvider client={client}>
      <LocaleProvider initialLocale={locale}>
        {withLocaleSwitch ? <TestLocaleSwitch /> : null}
        <CostCurrencySettingsCard storeId={storeId} />
      </LocaleProvider>
    </QueryClientProvider>
  );
}

function renderCard(
  locale: AppLocale = "zh-CN",
  storeId = "store-a",
  withLocaleSwitch = false,
  client = createClient(),
) {
  return render(currencyTree(locale, storeId, withLocaleSwitch, client));
}

function TestLocaleSwitch() {
  const { setLocale } = useLocale();
  return (
    <button type="button" data-testid="switch-it" onClick={() => setLocale("it-IT")}>
      switch-it
    </button>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
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
