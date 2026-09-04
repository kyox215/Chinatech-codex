import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { repairServiceCatalogItems } from "@/entities/order";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import type {
  StoreFaultCostDefaultItem,
  StoreFaultCostDefaultsResult,
  UpdateStoreFaultCostDefaultsRequest,
} from "@/lib/repairdesk/types";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

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

  it.each([
    ["zh-CN", "屏幕默认成本", "保存默认成本", "保存默认成本失败"],
    [
      "it-IT",
      "Costo predefinito: 屏幕",
      "Salva costi predefiniti",
      "Salvataggio dei costi predefiniti non riuscito",
    ],
    ["en", "Default cost: 屏幕", "Save default costs", "Could not save default costs"],
  ] as const)(
    "keeps the canonical catalog body exact, locks same-tick save, and retains failure draft in %s",
    async (locale, inputLabel, saveLabel, failureLabel) => {
      const pending = deferred<StoreFaultCostDefaultsResult>();
      apiMocks.updateStoreFaultCostDefaults.mockReturnValueOnce(pending.promise);
      const user = userEvent.setup();
      renderCard(locale);
      const input = await screen.findByLabelText(inputLabel);
      await user.clear(input);
      await user.type(input, "18.25");
      const save = screen.getByRole("button", { name: saveLabel });
      fireEvent.click(save);
      fireEvent.click(save);

      await waitFor(() => expect(apiMocks.updateStoreFaultCostDefaults).toHaveBeenCalledTimes(1));
      const expected = costDefaultsFixture().items.map((item) => ({
        catalog_key: item.catalog_key,
        catalog_name: item.catalog_name,
        default_cost_amount: item.catalog_key === "display:main" ? 18.25 : item.default_cost_amount,
      }));
      expect(apiMocks.updateStoreFaultCostDefaults).toHaveBeenCalledWith({
        expected_store_id: "store-a",
        expected_version: 2,
        items: expected,
      });
      pending.reject(new Error("RAW_SQL_DETAILS_SENTINEL"));
      expect(await screen.findByRole("alert")).toHaveTextContent(failureLabel);
      expect(input).toHaveValue("18.25");
      expect(document.body).not.toHaveTextContent("RAW_SQL_DETAILS_SENTINEL");
    },
  );

  it("preserves a focused canonical cost draft across locale switch with zero requests", async () => {
    renderCard("en", "store-a", true);
    const input = await screen.findByLabelText("Default cost: 屏幕");
    fireEvent.change(input, { target: { value: "22.25" } });
    input.focus();
    const reads = apiMocks.getStoreFaultCostDefaults.mock.calls.length;
    fireEvent.click(screen.getByTestId("switch-it"));

    expect(await screen.findByLabelText("Costo predefinito: 屏幕")).toBe(input);
    expect(input).toHaveValue("22.25");
    expect(input).toHaveFocus();
    expect(apiMocks.getStoreFaultCostDefaults).toHaveBeenCalledTimes(reads);
    expect(apiMocks.updateStoreFaultCostDefaults).not.toHaveBeenCalled();
  });

  it("drops a late old-store save without notice or cache writes", async () => {
    const pending = deferred<StoreFaultCostDefaultsResult>();
    apiMocks.updateStoreFaultCostDefaults.mockReturnValueOnce(pending.promise);
    const client = createClient();
    const setQueryData = vi.spyOn(client, "setQueryData");
    const view = renderCard("zh-CN", "store-a", false, client);
    const input = await screen.findByLabelText("屏幕默认成本");
    fireEvent.change(input, { target: { value: "22" } });
    fireEvent.click(screen.getByRole("button", { name: "保存默认成本" }));
    await waitFor(() => expect(apiMocks.updateStoreFaultCostDefaults).toHaveBeenCalledTimes(1));

    view.rerender(defaultsTree("zh-CN", "store-b", false, client));
    setQueryData.mockClear();
    await act(async () => {
      pending.resolve(costDefaultsFixture({ version: 3, displayMain: 22 }));
      await pending.promise;
    });

    expect(setQueryData).not.toHaveBeenCalled();
    expect(screen.queryByText("维修项目默认成本已保存。")).not.toBeInTheDocument();
  });
});

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function defaultsTree(
  locale: AppLocale,
  storeId: string,
  withLocaleSwitch: boolean,
  queryClient: QueryClient,
) {
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider initialLocale={locale}>
        {withLocaleSwitch ? <TestLocaleSwitch /> : null}
        <RepairCostDefaultsCard storeId={storeId} />
      </LocaleProvider>
    </QueryClientProvider>
  );
}

function renderCard(
  locale: AppLocale = "zh-CN",
  storeId = "store-a",
  withLocaleSwitch = false,
  queryClient = createClient(),
) {
  const result = render(defaultsTree(locale, storeId, withLocaleSwitch, queryClient));
  return { ...result, queryClient };
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
