import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { OrderListItem, OrderPurchaseLine } from "@/lib/repairdesk/types";
import { OrderPurchasingBoard } from "./order-purchasing-board";

const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), batch: vi.fn() }));
vi.mock("@/lib/repairdesk/api", () => ({
  readOrderPurchasingBoard: mocks.read,
  saveOrderPurchase: mocks.save,
  batchOrderPurchases: mocks.batch,
}));
vi.mock("./order-purchasing-editor", async () => {
  const actual = await vi.importActual<typeof import("./order-purchasing-editor")>(
    "./order-purchasing-editor",
  );
  return { ...actual, OrderPurchasingEditor: () => <div data-testid="editor">Editor</div> };
});
afterEach(cleanup);
const order = {
  id: "order-1",
  public_no: "R001",
  device_label: "Test phone",
  fault_prices: [],
} as unknown as OrderListItem;
const line: OrderPurchaseLine = {
  id: "line-1",
  order_id: order.id,
  line_id: null,
  part_name: "Screen",
  supplier_id: "supplier-1",
  supplier_name: "Supplier One",
  unit_cost_eur: "12.50",
  quantity: 2,
  status: "needed",
  revision: 3,
  ordered_at: null,
  arrived_at: null,
  updated_at: "2026-09-26T08:00:00Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockResolvedValue({
    groups: [{ order_id: order.id, lines: [line] }],
    suppliers: [{ id: "supplier-1", name: "Supplier One" }],
    permissions: { canManage: true, canAssignSupplier: true },
  });
  mocks.batch.mockResolvedValue({
    results: [{ id: line.id, ok: true, revision: 4 }],
    replayed: false,
  });
});
function setup(orders: OrderListItem[] = [order]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <LocaleProvider initialLocale="en">
        <OrderPurchasingBoard orders={orders} storeId="store-1" online />
      </LocaleProvider>
    </QueryClientProvider>,
  );
  return client;
}
describe("OrderPurchasingBoard", () => {
  it("reads a full queue using the API limit of fifty orders per request", async () => {
    const orders = Array.from({ length: 101 }, (_, index) => ({ ...order, id: `order-${index}` }));
    mocks.read.mockImplementation(async ({ order_ids }: { order_ids: string[] }) => ({
      groups: order_ids.map((id) => ({ order_id: id, lines: [] })),
      suppliers: [],
      permissions: { canManage: true, canAssignSupplier: true },
    }));
    setup(orders);
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(3));
    expect(mocks.read.mock.calls.map(([input]) => input.order_ids.length)).toEqual([50, 50, 1]);
    expect(mocks.read.mock.calls.flatMap(([input]) => input.order_ids)).toEqual(
      orders.map(({ id }) => id),
    );
    expect(await screen.findAllByRole("button", { name: "Add part" })).toHaveLength(101);
  });
  it("limits select-all to the fifty-item API contract and lets selected rows be removed", async () => {
    mocks.read.mockResolvedValue({
      groups: [
        {
          order_id: order.id,
          lines: Array.from({ length: 51 }, (_, index) => ({
            ...line,
            id: `part-${index}`,
            part_name: `Part ${index}`,
          })),
        },
      ],
      suppliers: [],
      permissions: { canManage: true, canAssignSupplier: true },
    });
    setup();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Select visible parts" }));
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(51);
    const last = screen.getByRole("checkbox", { name: "Selected parts: R001 Part 50" });
    expect(last).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selected parts: R001 Part 0" }));
    expect(last).toBeEnabled();
    fireEvent.click(last);
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(51);
    fireEvent.click(screen.getAllByRole("button", { name: "Mark ordered" }).at(-1)!);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(mocks.batch).toHaveBeenCalledTimes(1));
    expect(mocks.batch.mock.calls[0][0].items).toHaveLength(50);
  });
  it("submits scoped versioned status only, never resubmits the purchase cost", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Mark ordered" }));
    await waitFor(() => expect(mocks.batch).toHaveBeenCalledTimes(1));
    expect(mocks.batch.mock.calls[0][0]).toEqual({
      expected_store_id: "store-1",
      operation: "mark_ordered",
      items: [{ id: "line-1", expected_revision: 3 }],
      idempotency_key: expect.any(String),
    });
  });
  it("opens missing-cost records without transitioning", async () => {
    mocks.read.mockResolvedValue({
      groups: [{ order_id: order.id, lines: [{ ...line, unit_cost_eur: null }] }],
      suppliers: [],
      permissions: { canManage: true, canAssignSupplier: true },
    });
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Mark ordered" }));
    expect(screen.getByTestId("editor")).toBeVisible();
    expect(mocks.batch).not.toHaveBeenCalled();
  });
  it("keeps an identical operation key after uncertain network failure", async () => {
    mocks.batch.mockRejectedValueOnce(new Error("transport"));
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Mark ordered" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Mark ordered" }));
    await waitFor(() => expect(mocks.batch).toHaveBeenCalledTimes(2));
    expect(mocks.batch.mock.calls[1][0].idempotency_key).toBe(
      mocks.batch.mock.calls[0][0].idempotency_key,
    );
  });
  it("hides all purchase content when the read is forbidden", async () => {
    mocks.read.mockRejectedValue({ status: 403 });
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("do not have access");
    expect(screen.queryByText("12.50")).not.toBeInTheDocument();
    expect(screen.queryByText("Supplier One")).not.toBeInTheDocument();
    expect(mocks.batch).not.toHaveBeenCalled();
  });
});
