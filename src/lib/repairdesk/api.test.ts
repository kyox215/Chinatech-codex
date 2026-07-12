import { afterEach, describe, expect, it, vi } from "vitest";

import {
  acceptKioskSession,
  downloadOrderDataTemplate,
  getDashboardSummary,
  getInventorySummary,
  getOrderQueueSummary,
  getOrderStats,
  getStoreContext,
  isRepairDeskAuthorizationError,
  RepairDeskApiError,
  returnKioskSession,
  previewOrderDataImport,
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
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
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
                queueCounts: { all: 0 },
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
                queueCounts: { all: 0 },
              },
              workflow: { statuses: [], transitions: [] },
              options: {
                suppliers: [],
                technicians: [],
                permissions: {
                  canReadSuppliers: false,
                  canAssignSuppliers: false,
                  canManageSuppliers: false,
                },
              },
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

  it("posts kiosk review decisions to staff endpoints", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              id: "session_1",
              store_id: "store_1",
              device_id: "device_1",
              session_type: "order_contact_signature",
              status: "accepted",
              request_payload: {},
              submission_payload: {},
              submission_version: 1,
              expires_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await acceptKioskSession("session_1");
    await returnKioskSession({ id: "session_1", reason: "号码不清楚" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/repairdesk/kiosk/sessions/accept",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ id: "session_1" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/repairdesk/kiosk/sessions/return",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ id: "session_1", reason: "号码不清楚" }),
      }),
    );
  });

  it("downloads order data files and preserves the server filename", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: {
            "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "content-disposition": "attachment; filename*=UTF-8''repairdesk-template.xlsx",
          },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      downloadOrderDataTemplate("00000000-0000-0000-0000-000000000001"),
    ).resolves.toMatchObject({
      fileName: "repairdesk-template.xlsx",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/repairdesk/orders/data/template",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ expectedStoreId: "00000000-0000-0000-0000-000000000001" }),
      }),
    );
  });

  it("uploads XLSX previews as multipart without overriding the boundary", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            data: {
              batchId: "batch",
              storeId: "store",
              templateVersion: "repairdesk-order-data-v1",
              mode: "update_only",
              expiresAt: new Date().toISOString(),
              summary: { total: 0, ready: 0, create: 0, update: 0, invalid: 0, skipped: 0 },
              rows: [],
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const file = new File([new Uint8Array([0x50, 0x4b])], "orders.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await previewOrderDataImport({
      file,
      expectedStoreId: "00000000-0000-0000-0000-000000000001",
      mode: "update_only",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBeInstanceOf(FormData);
    expect(init?.headers).toEqual({});
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

  it.each([401, 403])(
    "preserves authorization status %s for authority revocation",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: "Access revoked" }), {
            status,
            headers: { "content-type": "application/json" },
          }),
        ),
      );

      const error = await getStoreContext().catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(RepairDeskApiError);
      expect(error).toMatchObject({ message: "Access revoked", status });
      expect(isRepairDeskAuthorizationError(error)).toBe(true);
    },
  );

  it("does not classify ordinary server failures as authority loss", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Temporary failure" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const error = await getStoreContext().catch((caught: unknown) => caught);

    expect(error).toMatchObject({ status: 500 });
    expect(isRepairDeskAuthorizationError(error)).toBe(false);
  });
});
