import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ writeAiAssistantAudit: vi.fn() }));

vi.mock("./audit", async (importOriginal) => {
  const original = await importOriginal<typeof import("./audit")>();
  return { ...original, writeAiAssistantAudit: mocks.writeAiAssistantAudit };
});

import type { AiOrderToolCall } from "@/features/ai-assistant/model/contracts";
import { AiProviderRequestError, type AiAssistantProvider } from "./provider";
import { AiProviderBudgetError, type AiProviderBudgetGateway } from "./provider-budget";
import { aiQuotaExhaustedError, aiRequestRateLimitedError } from "./errors";
import { resetAiAssistantLocalRateLimitForTests } from "./request-rate-limit";
import { FakeAiAssistantProvider } from "@/features/ai-assistant/testing/fake-provider";
import type {
  AuditActor,
  OrderDetail,
  OrderListItem,
  OrderListResult,
} from "@/lib/repairdesk/types";
import { runAiOrderAssistantTurn } from "./order-assistant.service";

const enabledEnv = {
  AI_ASSISTANT_ENABLED: "1",
  AI_ORDER_READ_TOOLS_ENABLED: "1",
  AI_ASSISTANT_STORE_ALLOWLIST: "store-1",
} as const;

const liveEnv = {
  ...enabledEnv,
  AI_ASSISTANT_PROVIDER: "openai",
  AI_ASSISTANT_EXTERNAL_DATA_APPROVED: "1",
  AI_ASSISTANT_ORDER_EXTERNAL_DATA_APPROVED: "1",
  AI_ASSISTANT_REQUEST_FINGERPRINT_SECRET:
    "test-only-fingerprint-secret-with-at-least-32-characters",
  AI_ASSISTANT_SAFETY_IDENTIFIER_SECRET: "test-only-secret-with-at-least-32-characters",
} as const;

describe("order assistant service", () => {
  beforeEach(() => {
    mocks.writeAiAssistantAudit.mockReset();
    resetAiAssistantLocalRateLimitForTests();
  });

  it("checks the feature gate before invoking the provider or repository", async () => {
    const provider = providerFor(searchCall());
    const listOrdersPage = vi.fn();

    await expect(
      runAiOrderAssistantTurn({
        actor: owner,
        input: { message: "查询订单", locale: "zh-CN" },
        dependencies: { provider, listOrdersPage, getOrder: vi.fn(), env: {} },
      }),
    ).rejects.toMatchObject({ code: "AI_DISABLED", status: 404 });

    expect(provider.planOrderQuery).not.toHaveBeenCalled();
    expect(listOrdersPage).not.toHaveBeenCalled();
    expect(mocks.writeAiAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "order_plan",
        provider: "none",
        status: "rejected",
        errorCode: "AI_DISABLED",
      }),
    );
  });

  it("checks RBAC before invoking the provider", async () => {
    const provider = providerFor(searchCall());

    await expect(
      runAiOrderAssistantTurn({
        actor: { ...owner, role: "viewer", storeRole: "viewer" },
        input: { message: "查询订单", locale: "zh-CN" },
        dependencies: {
          provider,
          listOrdersPage: vi.fn(),
          getOrder: vi.fn(),
          env: enabledEnv,
        },
      }),
    ).rejects.toMatchObject({ code: "AI_NOT_AUTHORIZED", status: 403 });

    expect(provider.planOrderQuery).not.toHaveBeenCalled();
    expect(mocks.writeAiAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "none",
        status: "rejected",
        errorCode: "AI_NOT_AUTHORIZED",
      }),
    );
  });

  it("enforces a configured per-store quota before invoking the provider", async () => {
    const provider = providerFor(searchCall());
    const consumeQuota = vi.fn(() => {
      throw aiQuotaExhaustedError();
    });

    await expect(
      runAiOrderAssistantTurn({
        actor: owner,
        input: { message: "查询订单", locale: "zh-CN" },
        dependencies: {
          provider,
          listOrdersPage: vi.fn(),
          getOrder: vi.fn(),
          env: enabledEnv,
          consumeQuota,
        },
      }),
    ).rejects.toMatchObject({ code: "AI_QUOTA_EXHAUSTED", status: 429 });

    expect(consumeQuota).toHaveBeenCalledWith(expect.objectContaining({ actor: owner }));
    expect(provider.planOrderQuery).not.toHaveBeenCalled();
    expect(mocks.writeAiAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rate_limited", errorCode: "AI_QUOTA_EXHAUSTED" }),
    );
  });

  it("routes an exact order reference without provider construction or paid quota", async () => {
    const selected = order();
    const providerFactory = vi.fn(() => providerFor(searchCall()));
    const consumeQuota = vi.fn();
    const consumeRequestRateLimit = vi.fn();

    const response = await runAiOrderAssistantTurn({
      actor: owner,
      input: { message: "请查工单 R2026001", locale: "zh-CN" },
      dependencies: {
        provider: providerFactory,
        listOrdersPage: vi.fn(async () => result([selected], 1)),
        getOrder: vi.fn(async () => detail(selected)),
        env: enabledEnv,
        consumeQuota,
        consumeRequestRateLimit,
      },
    });

    expect(response).toMatchObject({ kind: "order_summary", total: 1 });
    expect(consumeRequestRateLimit).toHaveBeenCalledOnce();
    expect(consumeQuota).not.toHaveBeenCalled();
    expect(providerFactory).not.toHaveBeenCalled();
    expect(mocks.writeAiAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "none",
        resolutionPath: "deterministic",
        policyVersion: "order-direct-v3",
        requestKind: "order_text",
      }),
    );
  });

  it("rate limits direct queries without consuming paid quota", async () => {
    const consumeQuota = vi.fn();
    await expect(
      runAiOrderAssistantTurn({
        actor: owner,
        input: { message: "R2026001", locale: "zh-CN" },
        dependencies: {
          provider: providerFor(searchCall()),
          listOrdersPage: vi.fn(),
          getOrder: vi.fn(),
          env: enabledEnv,
          consumeQuota,
          consumeRequestRateLimit: vi.fn(() => {
            throw aiRequestRateLimitedError();
          }),
        },
      }),
    ).rejects.toMatchObject({ code: "AI_RATE_LIMITED", status: 429 });

    expect(consumeQuota).not.toHaveBeenCalled();
    expect(mocks.writeAiAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rate_limited", errorCode: "AI_RATE_LIMITED" }),
    );
  });

  it("routes the reported amount-anomaly question locally and returns finance-review copy", async () => {
    const providerFactory = vi.fn(() => providerFor(searchCall()));
    const listOrdersPage = vi.fn(async () => result([], 0));
    const consumeQuota = vi.fn();

    const response = await runAiOrderAssistantTurn({
      actor: owner,
      input: { message: "有没有什么是金额异常的", locale: "zh-CN" },
      dependencies: {
        provider: providerFactory,
        listOrdersPage,
        getOrder: vi.fn(),
        env: enabledEnv,
        consumeQuota,
      },
    });

    expect(providerFactory).not.toHaveBeenCalled();
    expect(consumeQuota).not.toHaveBeenCalled();
    expect(listOrdersPage).toHaveBeenCalledWith(
      expect.objectContaining({
        view: "active",
        financialReview: "amount_anomaly",
        search: undefined,
      }),
      owner,
    );
    expect(response).toMatchObject({
      kind: "search_results",
      total: 0,
      message: "当前可见的活跃工单中，未发现报价、定金、尾款或付款状态不一致的记录。",
    });
  });

  it("routes the reported Apple 15 query locally through device-only search", async () => {
    const selected = order({ device_label: "Apple iPhone 15 Pro" });
    const providerFactory = vi.fn(() => providerFor(searchCall()));
    const listOrdersPage = vi.fn(async () => result([selected], 1));
    const consumeQuota = vi.fn();

    const response = await runAiOrderAssistantTurn({
      actor: owner,
      input: { message: "苹果15", locale: "zh-CN" },
      dependencies: {
        provider: providerFactory,
        listOrdersPage,
        getOrder: vi.fn(),
        env: enabledEnv,
        consumeQuota,
      },
    });

    expect(providerFactory).not.toHaveBeenCalled();
    expect(consumeQuota).not.toHaveBeenCalled();
    expect(listOrdersPage).toHaveBeenCalledWith(
      expect.objectContaining({
        view: "active",
        search: undefined,
        deviceSearch: "iPhone 15",
      }),
      owner,
    );
    expect(response).toMatchObject({
      kind: "search_results",
      total: 1,
      cards: [expect.objectContaining({ device_label: "Apple iPhone 15 Pro" })],
    });
  });

  it("blocks store-wide amount review without aggregate finance permission", async () => {
    const listOrdersPage = vi.fn();
    const restrictedActor = { ...owner, role: "sales" as const, storeRole: "sales" as const };

    await expect(
      runAiOrderAssistantTurn({
        actor: restrictedActor,
        input: { message: "有没有什么是金额异常的", locale: "zh-CN" },
        dependencies: {
          provider: providerFor(searchCall()),
          listOrdersPage,
          getOrder: vi.fn(),
          env: enabledEnv,
        },
      }),
    ).rejects.toMatchObject({ code: "AI_NOT_AUTHORIZED", status: 403 });

    expect(listOrdersPage).not.toHaveBeenCalled();
  });

  it("keeps an ambiguous reference sentence on the provider path without regressing its result", async () => {
    const selected = order();
    const provider = new FakeAiAssistantProvider();
    const providerSpy = vi.spyOn(provider, "planOrderQuery");
    const consumeQuota = vi.fn();

    const response = await runAiOrderAssistantTurn({
      actor: owner,
      input: { message: "订单 R2026001 状态怎么样", locale: "zh-CN" },
      dependencies: {
        provider,
        listOrdersPage: vi.fn(async () => result([selected], 1)),
        getOrder: vi.fn(async () => detail(selected)),
        env: enabledEnv,
        consumeQuota,
      },
    });

    expect(providerSpy).toHaveBeenCalledOnce();
    expect(consumeQuota).toHaveBeenCalledOnce();
    expect(response).toMatchObject({ kind: "order_summary", total: 1 });
    expect(mocks.writeAiAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "fake", resolutionPath: "provider" }),
    );
  });

  it("reserves durably before one OpenAI call and finalizes before repository access", async () => {
    const orderOfEvents: string[] = [];
    const provider = openAiProviderFor(searchCall({ paid: "unpaid" }), orderOfEvents);
    const gateway = durableGateway(orderOfEvents);
    const consumeQuota = vi.fn();
    const response = await runAiOrderAssistantTurn({
      actor: owner,
      input: {
        client_request_id: "00000000-0000-4000-8000-000000000101",
        message: "Combine active and unpaid repair filters",
        locale: "en",
      },
      dependencies: {
        provider,
        budgetGateway: gateway,
        consumeQuota,
        listOrdersPage: vi.fn(async () => {
          orderOfEvents.push("repository");
          return result([], 0);
        }),
        getOrder: vi.fn(),
        env: liveEnv,
      },
    });

    expect(response.kind).toBe("search_results");
    expect(orderOfEvents).toEqual(["reserve", "provider", "settle:completed", "repository"]);
    expect(consumeQuota).not.toHaveBeenCalled();
    expect(gateway.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        requestKind: "order_text",
        reservedMicroUsd: 308n,
        clientRequestId: "00000000-0000-4000-8000-000000000101",
        actorRateFingerprintHmac: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        requestFingerprintHmac: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      }),
    );
    expect(mocks.writeAiAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        reservedMicroUsd: 308,
        estimatedMicroUsd: 14,
        budgetOutcome: "settled",
        providerAttemptCount: 1,
      }),
    );
  });

  it("blocks a rejected durable reservation before OpenAI", async () => {
    const provider = openAiProviderFor(searchCall());
    const gateway = durableGateway();
    vi.mocked(gateway.reserve).mockRejectedValueOnce(
      new AiProviderBudgetError("quota", "monthly_budget_reached"),
    );

    await expect(
      runAiOrderAssistantTurn({
        actor: owner,
        input: { message: "Combine active repair filters", locale: "en" },
        dependencies: {
          provider,
          budgetGateway: gateway,
          listOrdersPage: vi.fn(),
          getOrder: vi.fn(),
          env: liveEnv,
        },
      }),
    ).rejects.toMatchObject({ code: "AI_QUOTA_EXHAUSTED", status: 429 });

    expect(provider.planOrderQuery).not.toHaveBeenCalled();
    expect(gateway.settle).not.toHaveBeenCalled();
    expect(mocks.writeAiAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({ budgetOutcome: "blocked", errorCode: "AI_QUOTA_EXHAUSTED" }),
    );
  });

  it("holds a reservation after an unknown dispatch and never releases it", async () => {
    const provider = openAiProviderFor(searchCall());
    vi.mocked(provider.planOrderQuery).mockRejectedValueOnce(
      new AiProviderRequestError("transport", "sent_unknown"),
    );
    const gateway = durableGateway();

    await expect(
      runAiOrderAssistantTurn({
        actor: owner,
        input: { message: "Combine active repair filters", locale: "en" },
        dependencies: {
          provider,
          budgetGateway: gateway,
          listOrdersPage: vi.fn(),
          getOrder: vi.fn(),
          env: liveEnv,
        },
      }),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_UNAVAILABLE", status: 503 });

    expect(gateway.settle).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "sent_unknown" }),
    );
    expect(gateway.settle).not.toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "not_sent" }),
    );
    expect(mocks.writeAiAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({ budgetOutcome: "conservative_hold" }),
    );
  });

  it("rejects likely customer PII before reserve or OpenAI dispatch", async () => {
    const provider = openAiProviderFor(searchCall());
    const gateway = durableGateway();
    await expect(
      runAiOrderAssistantTurn({
        actor: owner,
        input: { message: "查找 Mario 的未付款工单", locale: "zh-CN" },
        dependencies: {
          provider,
          budgetGateway: gateway,
          listOrdersPage: vi.fn(),
          getOrder: vi.fn(),
          env: liveEnv,
        },
      }),
    ).rejects.toMatchObject({ code: "AI_SENSITIVE_INPUT", status: 400 });
    expect(gateway.reserve).not.toHaveBeenCalled();
    expect(provider.planOrderQuery).not.toHaveBeenCalled();
  });

  it("runs bounded search through the existing actor-scoped repository and returns minimal cards", async () => {
    const sensitiveOrder = order({
      customer_name: "Mario Rossi",
      customer_phone: "+39 333 1234567",
      device_imei: "990000000000002",
      quotation_amount: 999,
    });
    const listOrdersPage = vi.fn(async () => result([sensitiveOrder], 2));

    const response = await runAiOrderAssistantTurn({
      actor: owner,
      input: { message: "查询未付款订单", locale: "zh-CN" },
      dependencies: {
        provider: providerFor(searchCall({ paid: "unpaid", page_size: 8 })),
        listOrdersPage,
        getOrder: vi.fn(),
        env: enabledEnv,
        now: () => new Date("2026-07-18T12:00:00.000Z"),
      },
    });

    expect(listOrdersPage).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 8, paid: "unpaid" }),
      owner,
    );
    expect(response).toMatchObject({
      kind: "search_results",
      total: 2,
      result_truncated: true,
      cards: [
        {
          public_no: "R2026001",
          customer_hint: "M*** R***",
          device_label: "Apple iPhone",
          href: "/orders/order-1",
        },
      ],
    });
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("+39 333 1234567");
    expect(serialized).not.toContain("990000000000002");
    expect(serialized).not.toContain("999");
    expect(mocks.writeAiAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({ event: "order_tool", toolName: "search_orders", resultCount: 1 }),
    );
  });

  it("passes only a HMAC safety identifier and bounded signal to the provider", async () => {
    const provider = providerFor(searchCall());
    await runAiOrderAssistantTurn({
      actor: owner,
      input: { message: "查询 Mario 的订单", locale: "zh-CN" },
      dependencies: {
        provider,
        listOrdersPage: vi.fn(async () => result([], 0)),
        getOrder: vi.fn(),
        env: {
          ...enabledEnv,
          AI_ASSISTANT_SAFETY_IDENTIFIER_SECRET: "test-only-secret-with-at-least-32-characters",
        },
      },
    });

    expect(provider.planOrderQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        safetyIdentifier: expect.stringMatching(/^u1_/),
      }),
    );
    const serialized = JSON.stringify(vi.mocked(provider.planOrderQuery).mock.calls[0]?.[0]);
    expect(serialized).not.toContain(owner.id);
    expect(mocks.writeAiAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({ safetyIdentifierPresent: true }),
    );
  });

  it("rejects provider tool arguments containing undeclared properties", async () => {
    const call = {
      ...searchCall(),
      arguments: { ...searchCall().arguments, store_id: "other-store" },
    } as unknown as AiOrderToolCall;
    const listOrdersPage = vi.fn();

    await expect(
      runAiOrderAssistantTurn({
        actor: owner,
        input: { message: "查询订单", locale: "zh-CN" },
        dependencies: {
          provider: providerFor(call),
          listOrdersPage,
          getOrder: vi.fn(),
          env: enabledEnv,
        },
      }),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_PROTOCOL_ERROR", status: 502 });

    expect(listOrdersPage).not.toHaveBeenCalled();
    expect(mocks.writeAiAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "order_plan",
        provider: "fake",
        status: "failed",
        errorCode: "AI_PROVIDER_PROTOCOL_ERROR",
      }),
    );
  });

  it("rejects provider plans that mix device-only and generic search terms", async () => {
    const listOrdersPage = vi.fn();

    await expect(
      runAiOrderAssistantTurn({
        actor: owner,
        input: { message: "查找某个设备", locale: "zh-CN" },
        dependencies: {
          provider: providerFor(searchCall({ search: "15", device_search: "iPhone 15" })),
          listOrdersPage,
          getOrder: vi.fn(),
          env: enabledEnv,
        },
      }),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_PROTOCOL_ERROR", status: 502 });

    expect(listOrdersPage).not.toHaveBeenCalled();
  });

  it("resolves an exact public number then reads the detail with the same actor", async () => {
    const selected = order();
    const getOrder = vi.fn(async () => detail(selected));

    const response = await runAiOrderAssistantTurn({
      actor: owner,
      input: { message: "R2026001", locale: "zh-CN" },
      dependencies: {
        provider: providerFor({
          name: "get_order_summary",
          arguments: { order_reference: "#R2026001" },
        }),
        listOrdersPage: vi.fn(async () => result([selected], 1)),
        getOrder,
        env: enabledEnv,
      },
    });

    expect(getOrder).toHaveBeenCalledWith("order-1", owner);
    expect(response).toMatchObject({ kind: "order_summary", total: 1 });
  });

  it("does not guess when an order reference matches multiple non-exact results", async () => {
    const getOrder = vi.fn();
    const response = await runAiOrderAssistantTurn({
      actor: owner,
      input: { message: "R2026", locale: "zh-CN" },
      dependencies: {
        provider: providerFor({
          name: "get_order_summary",
          arguments: { order_reference: "R2026" },
        }),
        listOrdersPage: vi.fn(async () =>
          result([order(), order({ id: "order-2", public_no: "R2026002" })], 2),
        ),
        getOrder,
        env: enabledEnv,
      },
    });

    expect(getOrder).not.toHaveBeenCalled();
    expect(response).toMatchObject({ kind: "search_results", total: 2 });
  });

  it("maps provider failures to a safe unavailable envelope and failed audit", async () => {
    const provider = providerFor(searchCall());
    vi.mocked(provider.planOrderQuery).mockRejectedValueOnce(
      new Error("SECRET provider transport details"),
    );

    await expect(
      runAiOrderAssistantTurn({
        actor: owner,
        input: { message: "查询订单", locale: "zh-CN" },
        dependencies: {
          provider,
          listOrdersPage: vi.fn(),
          getOrder: vi.fn(),
          env: enabledEnv,
        },
      }),
    ).rejects.toMatchObject({
      code: "AI_PROVIDER_UNAVAILABLE",
      status: 503,
      message: "AI 服务暂时不可用，请继续使用手工查询",
    });

    expect(mocks.writeAiAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "fake",
        status: "failed",
        errorCode: "AI_PROVIDER_UNAVAILABLE",
      }),
    );
  });

  it("maps Node provider deadline timeouts to the stable timeout envelope", async () => {
    const provider = providerFor(searchCall());
    vi.mocked(provider.planOrderQuery).mockRejectedValueOnce(
      new DOMException("provider deadline", "TimeoutError"),
    );

    await expect(
      runAiOrderAssistantTurn({
        actor: owner,
        input: { message: "查询订单", locale: "zh-CN" },
        dependencies: {
          provider,
          listOrdersPage: vi.fn(),
          getOrder: vi.fn(),
          env: enabledEnv,
        },
      }),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_TIMEOUT", status: 504 });

    expect(mocks.writeAiAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorCode: "AI_PROVIDER_TIMEOUT" }),
    );
  });

  it("classifies provider 429 failures without exposing the provider message", async () => {
    const provider = providerFor(searchCall());
    vi.mocked(provider.planOrderQuery).mockRejectedValueOnce(
      Object.assign(new Error("SECRET quota headers"), { status: 429 }),
    );

    await expect(
      runAiOrderAssistantTurn({
        actor: owner,
        input: { message: "查询订单", locale: "zh-CN" },
        dependencies: {
          provider,
          listOrdersPage: vi.fn(),
          getOrder: vi.fn(),
          env: enabledEnv,
        },
      }),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_RATE_LIMITED", status: 429 });

    expect(mocks.writeAiAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rate_limited", errorCode: "AI_PROVIDER_RATE_LIMITED" }),
    );
  });

  it("maps repository failures to a safe dependency envelope", async () => {
    await expect(
      runAiOrderAssistantTurn({
        actor: owner,
        input: { message: "查询订单", locale: "zh-CN" },
        dependencies: {
          provider: providerFor(searchCall()),
          listOrdersPage: vi.fn(async () => {
            throw new Error("SECRET postgres connection details");
          }),
          getOrder: vi.fn(),
          env: enabledEnv,
        },
      }),
    ).rejects.toMatchObject({
      code: "AI_DEPENDENCY_UNAVAILABLE",
      status: 503,
      message: "订单查询服务暂时不可用，请继续使用手工查询",
    });

    expect(mocks.writeAiAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "order_tool",
        status: "failed",
        errorCode: "AI_DEPENDENCY_UNAVAILABLE",
      }),
    );
  });

  it("fails closed with a safe 503 when the required audit cannot be written", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.writeAiAssistantAudit.mockRejectedValueOnce(new Error("SECRET audit database details"));

    await expect(
      runAiOrderAssistantTurn({
        actor: owner,
        input: { message: "查询订单", locale: "zh-CN" },
        dependencies: {
          provider: providerFor(searchCall()),
          listOrdersPage: vi.fn(async () => result([], 0)),
          getOrder: vi.fn(),
          env: enabledEnv,
        },
      }),
    ).rejects.toMatchObject({
      code: "AI_AUDIT_UNAVAILABLE",
      status: 503,
      message: "AI 安全审计暂时不可用，请继续使用手工查询",
    });

    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("SECRET");
    consoleError.mockRestore();
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

function searchCall(
  overrides: Partial<Extract<AiOrderToolCall, { name: "search_orders" }>["arguments"]> = {},
) {
  return {
    name: "search_orders" as const,
    arguments: {
      search: null,
      device_search: null,
      view: "active" as const,
      paid: "all" as const,
      overdue: null,
      queue_group: null,
      financial_review: null,
      page_size: 8,
      ...overrides,
    },
  };
}

function providerFor(toolCall: AiOrderToolCall): AiAssistantProvider {
  return {
    name: "fake",
    planOrderQuery: vi.fn(async () => ({
      toolCall,
      metadata: { provider: "fake" as const, model: "fake-test", latencyMs: 5 },
    })),
    recognizeInventoryLabel: vi.fn(async () => {
      throw new Error("not used in order assistant tests");
    }),
  };
}

function openAiProviderFor(
  toolCall: AiOrderToolCall,
  orderOfEvents: string[] = [],
): AiAssistantProvider {
  return {
    name: "openai",
    planOrderQuery: vi.fn(async () => {
      orderOfEvents.push("provider");
      return {
        toolCall,
        metadata: {
          provider: "openai" as const,
          model: "gpt-5-nano-2025-08-07",
          requestId: "req_test",
          usage: {
            inputTokens: 100,
            cachedInputTokens: 10,
            cacheWriteTokens: 0,
            outputTokens: 20,
            reasoningTokens: 5,
            totalTokens: 120,
          },
          attempts: 1 as const,
          latencyMs: 50,
        },
      };
    }),
    recognizeInventoryLabel: vi.fn(async () => {
      throw new Error("not used in order assistant tests");
    }),
  };
}

function durableGateway(orderOfEvents: string[] = []): AiProviderBudgetGateway {
  return {
    durability: "durable",
    reserve: vi.fn(async (input) => {
      orderOfEvents.push("reserve");
      return {
        reservationId: "00000000-0000-4000-8000-000000000102",
        clientRequestId: input.clientRequestId,
        policyVersion: input.policyVersion,
        reservedMicroUsd: input.reservedMicroUsd,
        expiresAt: "2026-07-18T12:10:00.000Z",
      };
    }),
    settle: vi.fn<AiProviderBudgetGateway["settle"]>(async (input) => {
      orderOfEvents.push(`settle:${input.outcome}`);
      if (input.outcome === "completed") {
        return { state: "succeeded", estimatedMicroUsd: 14n };
      }
      if (input.outcome === "not_sent") return { state: "failed_pre_dispatch" };
      return { state: "held_for_stale_settlement" };
    }),
  };
}

function order(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: "order-1",
    public_no: "R2026001",
    status: "new",
    order_type: "quick_repair",
    payment_status: "unpaid",
    approval_status: "pending",
    customer_id: "customer-1",
    device_id: "device-1",
    customer_name: "张伟",
    customer_phone: "+390000000",
    device_label: "Apple iPhone",
    device_imei: "350100000000000",
    issue_description: "屏幕碎裂",
    quotation_amount: 100,
    deposit_amount: 0,
    balance_amount: 100,
    currency_code: "EUR",
    is_paid: false,
    technician_name: "陈师傅",
    contact_phones: [],
    fault_prices: [],
    approval_overdue: false,
    pickup_overdue: false,
    created_at: "2026-07-07T00:00:00.000Z",
    updated_at: "2026-07-07T00:00:00.000Z",
    device_custody_status: "with_shop",
    ...overrides,
  };
}

function result(items: OrderListItem[], total: number): OrderListResult {
  return {
    items,
    total,
    page: 1,
    pageSize: 20,
    pageCount: total > 0 ? 1 : 0,
    workflowCounts: { all: total } as OrderListResult["workflowCounts"],
    queueCounts: { all: total } as OrderListResult["queueCounts"],
    resultGroupCounts: {} as OrderListResult["resultGroupCounts"],
  };
}

function detail(value: OrderListItem): OrderDetail {
  return {
    order: value,
    events: [],
    messages: [],
    attachments: [],
  };
}
