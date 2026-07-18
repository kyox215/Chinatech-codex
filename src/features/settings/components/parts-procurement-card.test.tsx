import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getPartsProcurement: vi.fn(),
  readCostCurrencySettings: vi.fn(),
  createPartCatalogItem: vi.fn(),
  receivePartLot: vi.fn(),
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

afterEach(cleanup);

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
});

function renderCard(multiCurrencyEnabled: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PartsProcurementCard storeId="store-a" multiCurrencyEnabled={multiCurrencyEnabled} />
    </QueryClientProvider>,
  );
}
