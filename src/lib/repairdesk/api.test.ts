import { afterEach, describe, expect, it, vi } from "vitest";

import {
  acceptKioskSession,
  createOrder,
  downloadOrderDataTemplate,
  getAiAssistantCapabilities,
  getDashboardSummary,
  getInventorySummary,
  getOrderCreateOperationStatus,
  getOrderQueueSummary,
  getOrderStats,
  getShellBootstrap,
  getStoreContext,
  isRepairDeskAuthorizationError,
  listAvailableKioskDevices,
  listOrderDataBatchHistory,
  isRepairDeskRequestTimeoutError,
  RepairDeskApiError,
  runAiInventoryVisionRecognition,
  runAiOrderAssistantTurn,
  searchCustomerIntakeCandidates,
  returnKioskSession,
  previewOrderDataImport,
  updateStoreSettings,
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

  it("posts structured intake identity fields while preserving the legacy overload", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await searchCustomerIntakeCandidates({
      phone: "3335719865",
      name: "Alessio",
      phoneMatchMode: "progressive",
      limit: 8,
      deviceLimit: 4,
    });
    await searchCustomerIntakeCandidates("333", 6, 2);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/repairdesk/customers/intake-search",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          phone: "3335719865",
          name: "Alessio",
          phoneMatchMode: "progressive",
          limit: 8,
          deviceLimit: 4,
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/repairdesk/customers/intake-search",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ q: "333", limit: 6, deviceLimit: 2 }),
      }),
    );
  });

  it("uses private AI capability and turn endpoints without caller-controlled scope", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              canUseOrderAssistant: true,
              canUseOrderInlineActions: false,
              canUseVisionIntake: false,
              canApplyInventoryDraft: false,
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              request_id: "00000000-0000-4000-8000-000000000001",
              contract_version: "ai-order-assistant-v4",
              interpretation_status: "confirmed",
              kind: "clarification",
              message: "请补充订单号",
              applied_filters: [],
              cards: [],
              total: 0,
              result_truncated: false,
              page: 1,
              page_size: 8,
              has_more: false,
              continuation_token: null,
              generated_at: "2026-07-18T12:00:00.000Z",
              source: "repairdesk",
            },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getAiAssistantCapabilities()).resolves.toMatchObject({
      canUseOrderAssistant: true,
    });
    await expect(
      runAiOrderAssistantTurn({ message: "查询订单", locale: "zh-CN" }),
    ).resolves.toMatchObject({ kind: "clarification" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/repairdesk/ai/capabilities",
      expect.not.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/repairdesk/ai/order/turn",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ message: "查询订单", locale: "zh-CN" }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("loads the atomic shell bootstrap contract from one private endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              onboarding: {
                userId: "user-1",
                displayName: "Owner",
                isPlatformAdmin: false,
                stores: [],
                requests: [],
                availableStores: [],
              },
              storeContext: { stores: [] },
              aiCapabilities: {
                canUseOrderAssistant: false,
                canUseOrderInlineActions: false,
                canUseVisionIntake: false,
                canApplyInventoryDraft: false,
                reason: "feature_off",
              },
              generatedAt: "2026-07-23T16:00:00.000Z",
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getShellBootstrap()).resolves.toMatchObject({
      onboarding: { userId: "user-1" },
      storeContext: { stores: [] },
      aiCapabilities: { reason: "feature_off" },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/repairdesk/shell/bootstrap",
      expect.objectContaining({ headers: { "content-type": "application/json" } }),
    );
  });

  it("uses the bounded private AI vision endpoint with caller cancellation support", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              request_id: "00000000-0000-4000-8000-000000000002",
              contract_version: "ai-assistant-v1",
              recognition: {
                schema_version: "ai-assistant-v1",
                fields: Object.fromEntries(
                  ["brand", "model", "color", "ram_capacity", "storage_capacity"].map((name) => [
                    name,
                    { value: null, confidence: "unknown", evidence: null, source: "unknown" },
                  ]),
                ),
                identifiers: [],
                conflicts: [],
                warnings: ["请手工录入"],
                label_claim_only: true,
              },
              provider: "fake",
              model_version: "fake-vision-test",
              generated_at: "2026-07-18T12:00:00.000Z",
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const input = {
      client_request_id: "00000000-0000-4000-8000-000000000201",
      image_data_url: "data:image/jpeg;base64,/9j/wAA=",
      mime_type: "image/jpeg" as const,
      byte_length: 5,
      width: 1,
      height: 1,
      locale: "zh-CN" as const,
    };

    await expect(
      runAiInventoryVisionRecognition(input, { signal: controller.signal }),
    ).resolves.toMatchObject({ provider: "fake" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/repairdesk/ai/vision/extract",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("scopes available kiosk devices to the selected order", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [{ id: "device_1", label: "Front iPad", status: "active" }],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listAvailableKioskDevices("order/with space")).resolves.toEqual([
      { id: "device_1", label: "Front iPad", status: "active" },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/repairdesk/kiosk/available-devices?order_id=order%2Fwith%20space",
      expect.not.objectContaining({ method: "POST" }),
    );
  });

  it("posts dashboard summary requests to the aggregate endpoint", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            data: {
              coverage: "store",
              policyVersion: "dashboard-priority-v1",
              generatedAt: "2026-07-16T12:00:00.000Z",
              totalCandidates: 0,
              hasMore: false,
              counts: { overdue: 0, ready: 0, active: 0, waiting: 0 },
              items: [],
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getDashboardSummary({ limit: 8 })).resolves.toMatchObject({
      coverage: "store",
      totalCandidates: 0,
      items: [],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/repairdesk/dashboard/priority-summary",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ limit: 8 }),
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
                resultGroupCounts: {},
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

    await acceptKioskSession({ id: "session_1", expected_submission_version: 2 });
    await returnKioskSession({
      id: "session_1",
      expected_submission_version: 2,
      reason: "号码不清楚",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/repairdesk/kiosk/sessions/accept",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ id: "session_1", expected_submission_version: 2 }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/repairdesk/kiosk/sessions/return",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          id: "session_1",
          expected_submission_version: 2,
          reason: "号码不清楚",
        }),
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

  it("requests store-bound order data batch history", async () => {
    const expectedStoreId = "00000000-0000-0000-0000-000000000001";
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ data: { storeId: expectedStoreId, items: [], hasMore: false } }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listOrderDataBatchHistory(expectedStoreId)).resolves.toEqual({
      storeId: expectedStoreId,
      items: [],
      hasMore: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/repairdesk/orders/data/batches",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ expectedStoreId }),
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

    const request = getOrderStats({ timeoutMs: 5 }).catch((caught: unknown) => caught);
    await vi.advanceTimersByTimeAsync(5);
    const error = await request;

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ message: "请求超时，请稍后重试" });
    expect(isRepairDeskRequestTimeoutError(error)).toBe(true);
  });

  it("sends create operation ids and reads their recovery status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: "order_1" } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { status: "created", id: "order_1" } }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await createOrder({
      operation_id: "00000000-0000-4000-8000-000000000905",
      order_type: "quick_repair",
      status: "new",
      issue_description: "Schermo rotto",
      fault_prices: [],
    });
    await expect(
      getOrderCreateOperationStatus("00000000-0000-4000-8000-000000000905"),
    ).resolves.toEqual({ status: "created", id: "order_1" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/repairdesk/orders/create",
      expect.objectContaining({
        body: expect.stringContaining("00000000-0000-4000-8000-000000000905"),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/repairdesk/orders/create/status",
      expect.objectContaining({
        body: JSON.stringify({ operation_id: "00000000-0000-4000-8000-000000000905" }),
      }),
    );
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

  it("sends the strict settings request and preserves structured conflict details", async () => {
    const request = {
      section: "notifications" as const,
      expectedStoreId: "5248dda1-2b32-46cd-8ed0-d15386a9e8ed",
      expectedUpdatedAt: "2026-07-12T10:00:00.000Z",
      input: { print_footer: "Footer", message_signature: "Firma" },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "设置已被更新",
          code: "SETTINGS_VERSION_CONFLICT",
          requestId: "req_1",
          fieldErrors: { "input.print_footer": ["冲突"] },
        }),
        { status: 409, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const error = await updateStoreSettings(request).catch((caught: unknown) => caught);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/repairdesk/settings/store/update",
      expect.objectContaining({ method: "POST", body: JSON.stringify(request) }),
    );
    expect(error).toMatchObject({
      status: 409,
      code: "SETTINGS_VERSION_CONFLICT",
      requestId: "req_1",
      fieldErrors: { "input.print_footer": ["冲突"] },
    });
  });
});
