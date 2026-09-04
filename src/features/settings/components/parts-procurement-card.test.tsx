import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

const apiMocks = vi.hoisted(() => ({
  getPartsProcurement: vi.fn(),
  readCostCurrencySettings: vi.fn(),
  createPartCatalogItem: vi.fn(),
  receivePartLot: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: apiMocks.toastSuccess, error: apiMocks.toastError },
}));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  getPartsProcurement: apiMocks.getPartsProcurement,
  readCostCurrencySettings: apiMocks.readCostCurrencySettings,
  createPartCatalogItem: apiMocks.createPartCatalogItem,
  receivePartLot: apiMocks.receivePartLot,
}));

import { PartsProcurementCard } from "./parts-procurement-card";

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => undefined;
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = () => undefined;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PartsProcurementCard multi-currency receipts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getPartsProcurement.mockResolvedValue({
      items: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          sku: "OLED-15",
          name: "iPhone 15 OLED",
          compatible_models: [],
          active: true,
          weighted_average_unit_cost_eur: null,
          available_quantity: 0,
          created_at: "2026-07-18T10:00:00.000Z",
          updated_at: "2026-07-18T10:00:00.000Z",
        },
      ],
      lots: [],
      suppliers: [],
      allocations: [],
    });
    apiMocks.readCostCurrencySettings.mockResolvedValue({
      version: 2,
      items: [
        {
          currency_code: "EUR",
          enabled: true,
          rate_to_eur: 1,
          rate_at: "2026-07-18T10:00:00.000Z",
          rate_source: "store_base",
          revision: 2,
          stale: false,
        },
        {
          currency_code: "USD",
          enabled: true,
          rate_to_eur: 0.9,
          rate_at: "2026-07-18T10:00:00.000Z",
          rate_source: "owner_manual",
          revision: 2,
          stale: false,
        },
      ],
    });
    apiMocks.receivePartLot.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000004",
      replayed: false,
      unit_cost_eur: 9,
      fx_rate_to_eur: 0.9,
      fx_rate_at: "2026-07-18T10:00:00.000Z",
      fx_rate_source: "owner_manual",
      fx_rate_revision: 2,
    });
  });

  it("shows the EUR preview and sends only original currency input to the authoritative API", async () => {
    const user = userEvent.setup();
    renderCard(true);

    await user.click(await screen.findByRole("combobox", { name: "采购成本币种" }));
    await user.click(screen.getByRole("option", { name: /美元 USD/ }));
    const comboboxes = screen.getAllByRole("combobox");
    await user.click(comboboxes[0]);
    await user.click(screen.getByRole("option", { name: "iPhone 15 OLED" }));
    await user.type(screen.getByLabelText("批次号"), "USD-LOT-1");
    const cost = screen.getByLabelText("单位成本 USD");
    await user.clear(cost);
    await user.type(cost, "10");

    expect(screen.getByText(/当前单位成本约 €9.00/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "登记入库" }));

    await waitFor(() => expect(apiMocks.receivePartLot).toHaveBeenCalledTimes(1));
    expect(apiMocks.receivePartLot.mock.calls[0]?.[0]).toMatchObject({
      original_currency_code: "USD",
      original_unit_cost: 10,
    });
    expect(apiMocks.receivePartLot.mock.calls[0]?.[0]).not.toHaveProperty("fx_rate_to_eur");
  });

  it("keeps the existing EUR-only form and avoids reading rates when the child feature is hidden", async () => {
    renderCard(false);
    expect(await screen.findByLabelText("单位成本 €")).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "采购成本币种" })).not.toBeInTheDocument();
    expect(apiMocks.readCostCurrencySettings).not.toHaveBeenCalled();
  });

  it("preserves the original currency draft when the server rejects a stale rate", async () => {
    const user = userEvent.setup();
    apiMocks.receivePartLot.mockRejectedValueOnce(
      new Error("该币种汇率已超过 30 天，请店主更新后再入库"),
    );
    renderCard(true);

    await user.click(await screen.findByRole("combobox", { name: "采购成本币种" }));
    await user.click(screen.getByRole("option", { name: /美元 USD/ }));
    await user.click(screen.getByRole("combobox", { name: "配件" }));
    await user.click(screen.getByRole("option", { name: "iPhone 15 OLED" }));
    await user.type(screen.getByLabelText("批次号"), "USD-STALE-DRAFT");
    await user.type(screen.getByLabelText("单位成本 USD"), "10");
    await user.click(screen.getByRole("button", { name: "登记入库" }));

    await waitFor(() => expect(apiMocks.receivePartLot).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("批次号")).toHaveValue("USD-STALE-DRAFT");
    expect(screen.getByLabelText("单位成本 USD")).toHaveValue(10);
    expect(screen.getByRole("combobox", { name: "采购成本币种" })).toHaveTextContent("美元 USD");
  });

  it.each([
    ["zh-CN", "配件名称", "创建目录", "登记入库", "采购成本币种", "美元 USD"],
    [
      "it-IT",
      "Nome ricambio",
      "Crea articolo",
      "Registra ricevimento",
      "Valuta costo acquisto",
      "Dollaro USA USD",
    ],
    [
      "en",
      "Part name",
      "Create catalog item",
      "Record receipt",
      "Procurement cost currency",
      "US dollar USD",
    ],
  ] as const)(
    "keeps create and receive bodies locale-free and same-tick locked in %s",
    async (locale, nameLabel, createLabel, receiveLabel, currencyLabel, usdLabel) => {
      const createPending = deferred<{ id: string }>();
      const receivePending = deferred<{ id: string }>();
      apiMocks.createPartCatalogItem.mockReturnValueOnce(createPending.promise);
      apiMocks.receivePartLot.mockReturnValueOnce(receivePending.promise);
      const randomUuid = vi
        .spyOn(crypto, "randomUUID")
        .mockReturnValueOnce("00000000-0000-4000-8000-000000000101")
        .mockReturnValueOnce("00000000-0000-4000-8000-000000000102");
      const user = userEvent.setup();
      renderCard(true, locale);

      await user.type(await screen.findByLabelText("SKU"), " PART-RAW ");
      await user.type(screen.getByLabelText(nameLabel), "Dynamic Part 名称");
      const createButton = screen.getByRole("button", { name: createLabel });
      fireEvent.click(createButton);
      fireEvent.click(createButton);
      await waitFor(() => expect(apiMocks.createPartCatalogItem).toHaveBeenCalledTimes(1));
      expect(apiMocks.createPartCatalogItem).toHaveBeenCalledWith({
        expected_store_id: "store-a",
        sku: "PART-RAW",
        name: "Dynamic Part 名称",
        compatible_models: [],
        idempotency_key: "00000000-0000-4000-8000-000000000101",
      });
      createPending.resolve({ id: "part-created" });
      await waitFor(() => expect(apiMocks.toastSuccess).toHaveBeenCalledTimes(1));

      await user.click(screen.getByRole("combobox", { name: currencyLabel }));
      await user.click(screen.getByRole("option", { name: usdLabel }));
      await user.click(screen.getByRole("combobox", { name: /配件|Ricambi|Parts/ }));
      await user.click(screen.getByRole("option", { name: "iPhone 15 OLED" }));
      const lotLabel =
        locale === "zh-CN" ? "批次号" : locale === "it-IT" ? "Codice lotto" : "Lot code";
      const unitLabel =
        locale === "zh-CN"
          ? "单位成本 USD"
          : locale === "it-IT"
            ? "Costo unitario USD"
            : "Unit cost USD";
      await user.type(screen.getByLabelText(lotLabel), "LOT-DYNAMIC");
      await user.clear(screen.getByLabelText(unitLabel));
      await user.type(screen.getByLabelText(unitLabel), "10");
      const receiveButton = screen.getByRole("button", { name: receiveLabel });
      fireEvent.click(receiveButton);
      fireEvent.click(receiveButton);
      await waitFor(() => expect(apiMocks.receivePartLot).toHaveBeenCalledTimes(1));
      expect(apiMocks.receivePartLot).toHaveBeenCalledWith({
        expected_store_id: "store-a",
        part_item_id: "00000000-0000-4000-8000-000000000002",
        supplier_id: undefined,
        lot_code: "LOT-DYNAMIC",
        quantity: 1,
        original_unit_cost: 10,
        original_currency_code: "USD",
        idempotency_key: "00000000-0000-4000-8000-000000000102",
      });
      receivePending.resolve({ id: "lot-created" });
      await waitFor(() => expect(apiMocks.toastSuccess).toHaveBeenCalledTimes(2));
      randomUuid.mockRestore();
    },
  );

  it("reuses a fingerprint key after unknown failure and rotates it when the body changes", async () => {
    const randomUuid = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000201")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000202");
    apiMocks.createPartCatalogItem
      .mockRejectedValueOnce(new Error("RAW_PROVIDER_SENTINEL"))
      .mockRejectedValueOnce(new Error("RAW_PROVIDER_SENTINEL_AGAIN"))
      .mockRejectedValueOnce(new Error("RAW_PROVIDER_CHANGED"));
    const user = userEvent.setup();
    renderCard(true);
    await user.type(await screen.findByLabelText("SKU"), "RETRY-SKU");
    const name = screen.getByLabelText("配件名称");
    await user.type(name, "Retry Part");
    const button = screen.getByRole("button", { name: "创建目录" });

    await user.click(button);
    await waitFor(() => expect(apiMocks.createPartCatalogItem).toHaveBeenCalledTimes(1));
    await user.click(button);
    await waitFor(() => expect(apiMocks.createPartCatalogItem).toHaveBeenCalledTimes(2));
    expect(apiMocks.createPartCatalogItem.mock.calls[1]?.[0]).toEqual(
      apiMocks.createPartCatalogItem.mock.calls[0]?.[0],
    );
    await user.type(name, " changed");
    await user.click(button);
    await waitFor(() => expect(apiMocks.createPartCatalogItem).toHaveBeenCalledTimes(3));
    expect(apiMocks.createPartCatalogItem.mock.calls[2]?.[0].idempotency_key).toBe(
      "00000000-0000-4000-8000-000000000202",
    );
    expect(apiMocks.toastError).toHaveBeenCalledTimes(3);
    expect(apiMocks.toastError.mock.calls.flat().join(" ")).not.toContain("RAW_PROVIDER");
    expect(document.body).not.toHaveTextContent("RAW_PROVIDER");
    randomUuid.mockRestore();
  });

  it("reuses the exact receipt request after unknown failure and rotates it only with canonical input", async () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000301")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000302");
    apiMocks.receivePartLot
      .mockRejectedValueOnce(new Error("RAW_LOST_RESPONSE"))
      .mockRejectedValueOnce(new Error("RAW_LOST_RESPONSE_AGAIN"))
      .mockRejectedValueOnce(new Error("RAW_CHANGED_BODY"));
    const user = userEvent.setup();
    renderCard(true);
    await user.click(await screen.findByRole("combobox", { name: "配件" }));
    await user.click(screen.getByRole("option", { name: "iPhone 15 OLED" }));
    await user.type(screen.getByLabelText("批次号"), "RETRY-LOT");
    await user.type(screen.getByLabelText("单位成本 EUR"), "5");
    const button = screen.getByRole("button", { name: "登记入库" });

    await user.click(button);
    await waitFor(() => expect(apiMocks.receivePartLot).toHaveBeenCalledTimes(1));
    await user.click(button);
    await waitFor(() => expect(apiMocks.receivePartLot).toHaveBeenCalledTimes(2));
    expect(apiMocks.receivePartLot.mock.calls[1]?.[0]).toEqual(
      apiMocks.receivePartLot.mock.calls[0]?.[0],
    );
    await user.type(screen.getByLabelText("批次号"), "-NEXT");
    await user.click(button);
    await waitFor(() => expect(apiMocks.receivePartLot).toHaveBeenCalledTimes(3));
    expect(apiMocks.receivePartLot.mock.calls[2]?.[0]).toEqual({
      expected_store_id: "store-a",
      part_item_id: "00000000-0000-4000-8000-000000000002",
      supplier_id: undefined,
      lot_code: "RETRY-LOT-NEXT",
      quantity: 1,
      original_unit_cost: 5,
      original_currency_code: "EUR",
      idempotency_key: "00000000-0000-4000-8000-000000000302",
    });
    expect(apiMocks.toastError.mock.calls.flat().join(" ")).not.toContain("RAW_");
    expect(screen.getByLabelText("批次号")).toHaveValue("RETRY-LOT-NEXT");
  });

  it("preserves a focused dynamic draft across locale switch with zero extra reads or writes", async () => {
    renderCard(true, "en", "store-a", true);
    const name = await screen.findByLabelText("Part name");
    fireEvent.change(name, { target: { value: "Dynamic Ricambio 客户" } });
    name.focus();
    const readCounts = {
      procurement: apiMocks.getPartsProcurement.mock.calls.length,
      currency: apiMocks.readCostCurrencySettings.mock.calls.length,
    };
    fireEvent.click(screen.getByTestId("switch-it"));

    expect(await screen.findByLabelText("Nome ricambio")).toBe(name);
    expect(name).toHaveValue("Dynamic Ricambio 客户");
    expect(name).toHaveFocus();
    expect(apiMocks.getPartsProcurement).toHaveBeenCalledTimes(readCounts.procurement);
    expect(apiMocks.readCostCurrencySettings).toHaveBeenCalledTimes(readCounts.currency);
    expect(apiMocks.createPartCatalogItem).not.toHaveBeenCalled();
    expect(apiMocks.receivePartLot).not.toHaveBeenCalled();
  });

  it("drops a late old-store create result without toast or cache invalidation", async () => {
    const pending = deferred<{ id: string }>();
    apiMocks.createPartCatalogItem.mockReturnValueOnce(pending.promise);
    const client = createClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const view = renderCard(true, "zh-CN", "store-a", false, client);
    fireEvent.change(await screen.findByLabelText("SKU"), { target: { value: "OLD-SKU" } });
    fireEvent.change(screen.getByLabelText("配件名称"), { target: { value: "Old Store Part" } });
    fireEvent.click(screen.getByRole("button", { name: "创建目录" }));
    await waitFor(() => expect(apiMocks.createPartCatalogItem).toHaveBeenCalledTimes(1));

    view.rerender(partsTree(true, "zh-CN", "store-b", false, client));
    await act(async () => {
      pending.resolve({ id: "old-result" });
      await pending.promise;
    });

    expect(apiMocks.toastSuccess).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue("Old Store Part")).not.toBeInTheDocument();
  });

  it("drops a late old-store receipt without toast, cache, or draft side effects", async () => {
    const pending = deferred<{ id: string }>();
    apiMocks.receivePartLot.mockReturnValueOnce(pending.promise);
    const client = createClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const user = userEvent.setup();
    const view = renderCard(true, "zh-CN", "store-a", false, client);
    await user.click(await screen.findByRole("combobox", { name: "配件" }));
    await user.click(screen.getByRole("option", { name: "iPhone 15 OLED" }));
    await user.type(screen.getByLabelText("批次号"), "OLD-STORE-LOT");
    await user.type(screen.getByLabelText("单位成本 EUR"), "5");
    fireEvent.click(screen.getByRole("button", { name: "登记入库" }));
    await waitFor(() => expect(apiMocks.receivePartLot).toHaveBeenCalledTimes(1));

    view.rerender(partsTree(true, "zh-CN", "store-b", false, client));
    invalidate.mockClear();
    await act(async () => {
      pending.resolve({ id: "old-lot-result" });
      await pending.promise;
    });

    expect(apiMocks.toastSuccess).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue("OLD-STORE-LOT")).not.toBeInTheDocument();
  });
});

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function partsTree(
  multiCurrencyEnabled: boolean,
  locale: AppLocale,
  storeId: string,
  withLocaleSwitch: boolean,
  client: QueryClient,
) {
  return (
    <QueryClientProvider client={client}>
      <LocaleProvider initialLocale={locale}>
        {withLocaleSwitch ? <TestLocaleSwitch /> : null}
        <PartsProcurementCard storeId={storeId} multiCurrencyEnabled={multiCurrencyEnabled} />
      </LocaleProvider>
    </QueryClientProvider>
  );
}

function renderCard(
  multiCurrencyEnabled: boolean,
  locale: AppLocale = "zh-CN",
  storeId = "store-a",
  withLocaleSwitch = false,
  client = createClient(),
) {
  return render(partsTree(multiCurrencyEnabled, locale, storeId, withLocaleSwitch, client));
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
