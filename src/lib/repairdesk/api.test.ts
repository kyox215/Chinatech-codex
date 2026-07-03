import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getDashboardSummary,
  getInventorySummary,
  getOrderQueueSummary,
  getOrderStats,
} from "./api";

describe("repairdesk api client", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("unwraps repairdesk response data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: {
                total: 3,
                today: 1,
                inProgress: 2,
                unpaid: 1,
                approvalOverdue: 0,
                pickupOverdue: 0,
              },
            }),
            { status: 200 },
          ),
      ),
    );

    await expect(getOrderStats()).resolves.toMatchObject({
      total: 3,
      inProgress: 2,
    });
  });

  it("posts dashboard summary requests to the aggregate endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              recentOrders: {
                items: [],
                total: 0,
                page: 1,
                pageSize: 6,
                pageCount: 1,
                workflowCounts: { all: 0 },
              },
              stats: {
                total: 0,
                today: 0,
                inProgress: 0,
                unpaid: 0,
                approvalOverdue: 0,
                pickupOverdue: 0,
              },
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getDashboardSummary({ pageSize: 6 })).resolves.toMatchObject({
      recentOrders: { items: [], pageSize: 6 },
      stats: { total: 0 },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/repairdesk/dashboard/summary",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ pageSize: 6 }),
      }),
    );
  });

  it("posts inventory summary requests to the aggregate endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              list: { items: [], total: 0 },
              stats: {
                total: 0,
                inPipeline: 0,
                readyOrListed: 0,
                reserved: 0,
                sold: 0,
                buybackCost: 0,
                listedValue: 0,
                realizedProfit: 0,
              },
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getInventorySummary({ search: "iphone" })).resolves.toMatchObject({
      list: { items: [], total: 0 },
      stats: { total: 0 },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/repairdesk/inventory/summary",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ search: "iphone" }),
      }),
    );
  });

  it("posts order queue summary requests to the aggregate endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              list: {
                items: [],
                total: 0,
                page: 1,
                pageSize: 50,
                pageCount: 1,
                workflowCounts: { all: 0 },
              },
              workflow: { statuses: [], transitions: [] },
              options: { suppliers: [], technicians: [] },
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOrderQueueSummary({ page: 2, pageSize: 50 })).resolves.toMatchObject({
      list: { items: [], page: 1 },
      workflow: { statuses: [] },
      options: { technicians: [] },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/repairdesk/orders/queue-summary",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ page: 2, pageSize: 50 }),
      }),
    );
  });

  it("turns request timeouts into a friendly error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
    );

    const request = expect(getOrderStats({ timeoutMs: 5 })).rejects.toThrow("请求超时，请稍后重试");
    await vi.advanceTimersByTimeAsync(5);
    await request;
  });
});
