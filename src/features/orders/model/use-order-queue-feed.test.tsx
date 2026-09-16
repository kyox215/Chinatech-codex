import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderListPageInput, OrderQueueSummary } from "@/lib/repairdesk/types";
import { useOrderQueueFeed } from "./use-order-queue-feed";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  getOrderQueueSummary: mocks.load,
}));

const summary = (page: number, search = "") =>
  ({
    list: {
      items: Array.from({ length: page === 3 ? 25 : 100 }, (_, index) => ({
        id: `${search || "all"}-${(page - 1) * 100 + index}`,
      })),
      total: 225,
      page,
      pageSize: 100,
      pageCount: 3,
    },
    options: { permissions: { canBrowseOrderArchive: true } },
    workflow: { statuses: [], transitions: [] },
  }) as unknown as OrderQueueSummary;

function setup(input: OrderListPageInput = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    ...renderHook(
      ({ filters, store }) => useOrderQueueFeed({ ...filters, pageSize: 100 }, store, "u1", true),
      { wrapper, initialProps: { filters: input, store: "store-1" } },
    ),
  };
}

beforeEach(() => {
  mocks.load.mockReset();
  mocks.load.mockImplementation(async (input: OrderListPageInput) =>
    summary(input.page ?? 1, input.search),
  );
});

describe("incremental order queue", () => {
  it("loads 100 → 200 → 225, stops at the tail and refreshes only the first batch", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.data?.list.items).toHaveLength(100));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.data?.list.items).toHaveLength(200));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.data?.list.items).toHaveLength(225));
    expect(result.current.hasMore).toBe(false);
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data?.list.items).toHaveLength(100);
  });
  it("keeps loaded orders after a failed next batch and retries that batch", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.data?.list.items).toHaveLength(100));
    mocks.load.mockRejectedValueOnce(new Error("offline"));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.nextPageError).toBe(true));
    expect(result.current.data?.list.items).toHaveLength(100);
    await act(async () => {
      await result.current.retryNextPage();
    });
    await waitFor(() => expect(result.current.data?.list.items).toHaveLength(200));
  });
  it("discards fresh cached tail pages before refreshing, then requests changed server pages", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.data?.list.items).toHaveLength(100));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.data?.list.items).toHaveLength(200));
    mocks.load.mockImplementation(async (input: OrderListPageInput) =>
      summary(input.page ?? 1, "changed"),
    );
    const requestCount = mocks.load.mock.calls.length;
    await act(async () => {
      await result.current.refetch();
    });
    expect(mocks.load.mock.calls.slice(requestCount).map(([input]) => input.page)).toEqual([1]);
    expect(result.current.data?.list.items).toHaveLength(100);
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.data?.list.items).toHaveLength(200));
    expect(mocks.load.mock.calls.slice(requestCount).map(([input]) => input.page)).toEqual([1, 2]);
    expect(result.current.data?.list.items.every((order) => order.id.startsWith("changed-"))).toBe(
      true,
    );
  });
  it("never mixes filters or stores and resets the requested batch count", async () => {
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.data?.list.items).toHaveLength(100));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.data?.list.items).toHaveLength(200));
    rerender({ filters: { search: "other" }, store: "store-1" });
    await waitFor(() => expect(result.current.data?.list.items[0].id).toBe("other-0"));
    expect(result.current.data?.list.items).toHaveLength(100);
    rerender({ filters: {}, store: "store-2" });
    await waitFor(() => expect(result.current.data?.list.items).toHaveLength(100));
  });
  it("deduplicates overlapping batches while preserving their first position", async () => {
    mocks.load.mockImplementation(async (input: OrderListPageInput) => {
      const page = summary(input.page ?? 1);
      if (input.page === 2) page.list.items[0] = { ...page.list.items[0], id: "all-99" };
      return page;
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.data?.list.items).toHaveLength(100));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.data?.list.items).toHaveLength(199));
    expect(new Set(result.current.data?.list.items.map((item) => item.id)).size).toBe(199);
  });
});
