import { Buffer } from "node:buffer";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AiAssistantProvider } from "@/features/ai-assistant/server/provider";
import type { AuditActor, OrderListItem, OrderListResult } from "@/lib/repairdesk/types";

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  getAiAssistantProvider: vi.fn(),
  listOrdersPage: vi.fn(),
  getOrder: vi.fn(),
  writeAiAssistantAudit: vi.fn(),
}));

vi.mock("@/server/auth-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth-context")>()),
  getRequestActor: mocks.getRequestActor,
}));

vi.mock("@/server/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/supabase")>()),
  hasSupabaseConfig: () => true,
}));

vi.mock("@/shared/lib/e2e-auth-bypass", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/e2e-auth-bypass")>()),
  isRepairDeskE2eAuthBypassEnabled: () => false,
}));

vi.mock("@/features/orders/server/order.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/orders/server/order.service")>()),
  listOrdersPage: mocks.listOrdersPage,
  getOrder: mocks.getOrder,
}));

vi.mock("@/features/ai-assistant/server/provider-factory", () => ({
  getAiAssistantProvider: mocks.getAiAssistantProvider,
}));

vi.mock("@/features/ai-assistant/server/audit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/ai-assistant/server/audit")>()),
  writeAiAssistantAudit: mocks.writeAiAssistantAudit,
}));

import { handleRepairDeskGet, handleRepairDeskPost } from "./repairdesk-router";

describe("AI assistant BFF routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequestActor.mockResolvedValue(owner);
    mocks.getAiAssistantProvider.mockReturnValue(searchProvider());
    mocks.listOrdersPage.mockResolvedValue(result([sensitiveOrder()]));
    mocks.getOrder.mockResolvedValue({
      order: sensitiveOrder(),
      events: [],
      messages: [],
      attachments: [],
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("returns a private fail-closed capability projection while the feature is off", async () => {
    const response = await handleRepairDeskGet("ai/capabilities");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({
      data: {
        canUseOrderAssistant: false,
        canUseVisionIntake: false,
        canApplyInventoryDraft: false,
        reason: "feature_off",
      },
    });
  });

  it("projects RBAC on the server instead of trusting the client role", async () => {
    enableOrderAssistant();
    mocks.getRequestActor.mockResolvedValue({ ...owner, role: "viewer", storeRole: "viewer" });

    const response = await handleRepairDeskGet("ai/capabilities");

    await expect(response.json()).resolves.toMatchObject({
      data: { canUseOrderAssistant: false, reason: "permission_denied" },
    });
  });

  it("validates, plans and returns only the minimal server-projected order card", async () => {
    enableOrderAssistant();

    const response = await handleRepairDeskPost(
      "ai/order/turn",
      { message: "查询订单", locale: "zh-CN" },
      owner,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(mocks.getAiAssistantProvider).toHaveBeenCalledOnce();
    expect(mocks.listOrdersPage).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 8 }),
      owner,
    );
    expect(body.data.cards[0]).toEqual({
      id: "order-sensitive",
      public_no: "R-SYNTH-SEC",
      customer_hint: "S*** C***",
      device_label: "Synthetic Device",
      status: "intake",
      status_label: expect.any(String),
      updated_at: "2026-07-16T09:00:00.000Z",
      href: "/orders/order-sensitive",
    });
    expect(JSON.stringify(body)).not.toContain("SECRET-SENTINEL");
    expect(JSON.stringify(body)).not.toContain("999");
  });

  it("rejects undeclared request scope before provider or repository execution", async () => {
    enableOrderAssistant();

    const response = await handleRepairDeskPost(
      "ai/order/turn",
      { message: "查询订单", locale: "zh-CN", storeId: "other-store" },
      owner,
    );

    expect(response.status).toBe(400);
    expect(mocks.getAiAssistantProvider).not.toHaveBeenCalled();
    expect(mocks.listOrdersPage).not.toHaveBeenCalled();
  });

  it("returns the disabled envelope before provider construction or data access", async () => {
    const response = await handleRepairDeskPost(
      "ai/order/turn",
      { message: "查询订单", locale: "zh-CN" },
      owner,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: "AI_DISABLED" });
    expect(mocks.getAiAssistantProvider).not.toHaveBeenCalled();
    expect(mocks.listOrdersPage).not.toHaveBeenCalled();
  });

  it("never exposes provider failure details through the BFF envelope", async () => {
    enableOrderAssistant();
    const provider = searchProvider();
    vi.mocked(provider.planOrderQuery).mockRejectedValueOnce(
      new Error("SECRET provider host and response body"),
    );
    mocks.getAiAssistantProvider.mockReturnValue(provider);

    const response = await handleRepairDeskPost(
      "ai/order/turn",
      { message: "查询订单", locale: "zh-CN" },
      owner,
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      code: "AI_PROVIDER_UNAVAILABLE",
      error: "AI 服务暂时不可用，请继续使用手工查询",
    });
    expect(JSON.stringify(body)).not.toContain("SECRET");
  });

  it("never exposes repository failure details through the BFF envelope", async () => {
    enableOrderAssistant();
    mocks.listOrdersPage.mockRejectedValueOnce(new Error("SECRET database connection string"));

    const response = await handleRepairDeskPost(
      "ai/order/turn",
      { message: "查询订单", locale: "zh-CN" },
      owner,
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      code: "AI_DEPENDENCY_UNAVAILABLE",
      error: "订单查询服务暂时不可用，请继续使用手工查询",
    });
    expect(JSON.stringify(body)).not.toContain("SECRET");
  });

  it("fails closed with a safe envelope when required audit persistence fails", async () => {
    enableOrderAssistant();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.writeAiAssistantAudit.mockRejectedValueOnce(new Error("SECRET audit database detail"));

    const response = await handleRepairDeskPost(
      "ai/order/turn",
      { message: "查询订单", locale: "zh-CN" },
      owner,
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      code: "AI_AUDIT_UNAVAILABLE",
      error: "AI 安全审计暂时不可用，请继续使用手工查询",
    });
    expect(JSON.stringify(body)).not.toContain("SECRET");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("SECRET");
    consoleError.mockRestore();
  });

  it("authenticates, validates and returns a no-store fake vision result", async () => {
    enableVisionAssistant();
    const provider = visionProvider();
    mocks.getAiAssistantProvider.mockReturnValue(provider);

    const response = await handleRepairDeskPost("ai/vision/extract", visionInput(), owner);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(body.data).toMatchObject({
      contract_version: "ai-assistant-v1",
      provider: "fake",
      recognition: { fields: { model: { value: "A7 Pro" } }, label_claim_only: true },
    });
    expect(provider.recognizeInventoryLabel).toHaveBeenCalledOnce();
    expect(mocks.listOrdersPage).not.toHaveBeenCalled();
  });

  it("rejects caller-controlled vision scope before provider execution", async () => {
    enableVisionAssistant();
    const provider = visionProvider();
    mocks.getAiAssistantProvider.mockReturnValue(provider);

    const response = await handleRepairDeskPost(
      "ai/vision/extract",
      { ...visionInput(), store_id: "other-store" },
      owner,
    );

    expect(response.status).toBe(400);
    expect(provider.recognizeInventoryLabel).not.toHaveBeenCalled();
  });

  it("blocks viewer vision access and malformed derived bytes with safe envelopes", async () => {
    enableVisionAssistant();
    const provider = visionProvider();
    mocks.getAiAssistantProvider.mockReturnValue(provider);

    const forbidden = await handleRepairDeskPost("ai/vision/extract", visionInput(), {
      ...owner,
      role: "viewer",
      storeRole: "viewer",
    });
    expect(forbidden.status).toBe(403);

    const input = visionInput();
    const malformed = await handleRepairDeskPost(
      "ai/vision/extract",
      { ...input, byte_length: input.byte_length + 1 },
      owner,
    );
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({ code: "AI_INVALID_INPUT" });
    expect(provider.recognizeInventoryLabel).not.toHaveBeenCalled();
  });

  it("never exposes fake vision provider failure details", async () => {
    enableVisionAssistant();
    const provider = visionProvider();
    vi.mocked(provider.recognizeInventoryLabel).mockRejectedValueOnce(
      new Error("SECRET image provider payload"),
    );
    mocks.getAiAssistantProvider.mockReturnValue(provider);

    const response = await handleRepairDeskPost("ai/vision/extract", visionInput(), owner);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ code: "AI_PROVIDER_UNAVAILABLE" });
    expect(JSON.stringify(body)).not.toContain("SECRET");
  });
});

const owner: AuditActor = {
  id: "staff-owner",
  displayName: "Owner",
  role: "owner",
  storeRole: "owner",
  storeId: "store-1",
  activeMembershipId: "membership-owner",
};

function enableOrderAssistant() {
  vi.stubEnv("AI_ASSISTANT_ENABLED", "1");
  vi.stubEnv("AI_ORDER_READ_TOOLS_ENABLED", "1");
  vi.stubEnv("AI_ASSISTANT_STORE_ALLOWLIST", "store-1");
}

function enableVisionAssistant() {
  vi.stubEnv("AI_ASSISTANT_ENABLED", "1");
  vi.stubEnv("AI_VISION_INTAKE_ENABLED", "1");
  vi.stubEnv("AI_ASSISTANT_STORE_ALLOWLIST", "store-1");
}

function searchProvider(): AiAssistantProvider {
  return {
    name: "fake",
    planOrderQuery: vi.fn(async () => ({
      toolCall: {
        name: "search_orders" as const,
        arguments: {
          search: null,
          view: "active" as const,
          paid: "all" as const,
          overdue: null,
          queue_group: null,
          page_size: 8,
        },
      },
      metadata: { provider: "fake" as const, model: "fake-test", latencyMs: 5 },
    })),
    recognizeInventoryLabel: vi.fn(async () => {
      throw new Error("not used in order route tests");
    }),
  };
}

function visionProvider(): AiAssistantProvider {
  const field = (value: string) => ({
    value,
    confidence: "review" as const,
    evidence: "synthetic label",
    source: "vision" as const,
  });
  return {
    name: "fake",
    planOrderQuery: vi.fn(async () => {
      throw new Error("not used in vision route tests");
    }),
    recognizeInventoryLabel: vi.fn(async () => ({
      recognition: {
        schema_version: "ai-assistant-v1" as const,
        fields: {
          brand: field("Redmi"),
          model: field("A7 Pro"),
          color: field("Black"),
          ram_capacity: field("4 GB"),
          storage_capacity: field("64 GB"),
        },
        identifiers: [],
        conflicts: [],
        warnings: ["仅为合成标签声明"],
        label_claim_only: true as const,
      },
      metadata: { provider: "fake" as const, model: "fake-vision-test", latencyMs: 4 },
    })),
  };
}

function visionInput() {
  const bytes = Uint8Array.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x07, 0x08, 0x00, 0x02, 0x00, 0x03, 0xff, 0xd9,
  ]);
  return {
    client_request_id: "00000000-0000-4000-8000-000000000202",
    image_data_url: `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`,
    mime_type: "image/jpeg" as const,
    byte_length: bytes.length,
    width: 3,
    height: 2,
    locale: "zh-CN" as const,
    fixture_key: "synthetic-redmi-a7-pro-box" as const,
  };
}

function result(items: OrderListItem[]): OrderListResult {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 8,
    pageCount: 1,
    workflowCounts: { all: items.length } as OrderListResult["workflowCounts"],
    queueCounts: { all: items.length } as OrderListResult["queueCounts"],
    resultGroupCounts: {} as OrderListResult["resultGroupCounts"],
  };
}

function sensitiveOrder(): OrderListItem {
  return {
    id: "order-sensitive",
    public_no: "R-SYNTH-SEC",
    order_type: "quick_repair",
    status: "new",
    device_custody_status: "with_shop",
    workflow_status: "intake",
    payment_status: "unpaid",
    approval_status: "pending",
    customer_id: "customer-sensitive",
    device_id: "device-sensitive",
    customer_name: "Synthetic Customer",
    customer_phone: "SECRET-SENTINEL-PHONE",
    device_label: "Synthetic Device",
    device_imei: "SECRET-SENTINEL-IMEI",
    issue_description: "SECRET-SENTINEL-ISSUE",
    quotation_amount: 999,
    deposit_amount: 1,
    balance_amount: 998,
    currency_code: "EUR",
    is_paid: false,
    technician_name: "Synthetic Owner",
    contact_phones: ["SECRET-SENTINEL-CONTACT"],
    fault_prices: [{ name: "SECRET-SENTINEL-PART", price: 999, currency_code: "EUR" }],
    approval_overdue: false,
    pickup_overdue: false,
    created_at: "2026-07-16T08:00:00.000Z",
    updated_at: "2026-07-16T09:00:00.000Z",
  };
}
