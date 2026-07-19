import { randomUUID } from "node:crypto";

import {
  AI_ASSISTANT_CONTRACT_VERSION,
  AI_ORDER_PLANNER_PROMPT_VERSION,
  aiOrderToolCallSchema,
  type AiAssistantRequest,
  type AiOrderAssistantResponse,
  type AiOrderCard,
} from "@/features/ai-assistant/model/contracts";
import {
  writeAiAssistantAudit,
  bucketAiAssistantLatency,
  type AiAssistantAuditStatus,
  type WriteAiAssistantAuditInput,
} from "./audit";
import { getAiAssistantCapabilities } from "./capabilities";
import { AI_PRICING_VERSION } from "./cost-policy";
import { assertAiProviderEgressAllowed } from "./egress-policy";
import {
  AiServiceError,
  aiAuditUnavailableError,
  aiBudgetUnavailableError,
  aiDependencyUnavailableError,
  aiDisabledError,
  aiNotAuthorizedError,
  aiProtocolError,
  aiQuotaExhaustedError,
  aiRequestCancelledError,
  aiRequestRateLimitedError,
  aiProviderRateLimitedError,
  aiProviderTimeoutError,
  aiProviderUnavailableError,
} from "./errors";
import type { AiAssistantFeatureEnvironment } from "./feature-flags";
import type { AiAssistantProvider } from "./provider";
import { AiProviderRequestError } from "./provider";
import { AiProviderBudgetError, type AiProviderBudgetGateway } from "./provider-budget";
import { AiProviderBudgetSession } from "./provider-budget-lifecycle";
import { planDeterministicOrderQuery } from "./order-intent-router";
import { createAiProviderSignal, isAiProviderTimeoutError } from "./provider-signal";
import { consumeAiAssistantRequestQuota, type ConsumeAiAssistantQuotaInput } from "./quota";
import {
  consumeAiAssistantRequestRateLimit,
  type ConsumeAiAssistantRequestRateLimitInput,
} from "./request-rate-limit";
import { getAiModelRuntimePolicy } from "./runtime-policy";
import { createAiSafetyIdentifierIfConfigured } from "./safety-identifier";
import { getStatusMeta } from "@/lib/mock/enums";
import { can } from "@/server/permissions";
import { isRepairDeskE2eSystemActor } from "@/shared/lib/e2e-auth-bypass";
import type {
  AuditActor,
  OrderDetail,
  OrderListItem,
  OrderListPageInput,
  OrderListResult,
} from "@/lib/repairdesk/types";

type OrderAssistantDependencies = {
  provider: AiAssistantProvider | (() => AiAssistantProvider);
  listOrdersPage: (input: OrderListPageInput, actor: AuditActor) => Promise<OrderListResult>;
  getOrder: (id: string, actor: AuditActor) => Promise<OrderDetail>;
  env?: AiAssistantFeatureEnvironment;
  now?: () => Date;
  requestSignal?: AbortSignal;
  consumeQuota?: (input: ConsumeAiAssistantQuotaInput) => unknown | Promise<unknown>;
  budgetGateway?: AiProviderBudgetGateway | (() => AiProviderBudgetGateway);
  consumeRequestRateLimit?: (
    input: ConsumeAiAssistantRequestRateLimitInput,
  ) => unknown | Promise<unknown>;
};

export async function runAiOrderAssistantTurn({
  actor,
  input,
  dependencies,
}: {
  actor: AuditActor;
  input: AiAssistantRequest;
  dependencies: OrderAssistantDependencies;
}): Promise<AiOrderAssistantResponse> {
  const requestId = input.client_request_id ?? randomUUID();
  const auditContext: Pick<
    WriteAiAssistantAuditInput,
    | "event"
    | "provider"
    | "modelVersion"
    | "toolName"
    | "inputTokens"
    | "outputTokens"
    | "latencyBucket"
    | "requestKind"
    | "processingMode"
    | "resolutionPath"
    | "policyVersion"
    | "cachedInputTokens"
    | "cacheWriteTokens"
    | "providerAttemptCount"
    | "pricingVersion"
    | "estimatedMicroUsd"
    | "reservedMicroUsd"
    | "budgetOutcome"
    | "safetyIdentifierPresent"
  > = {
    event: "order_plan",
    provider: "none",
    modelVersion: "not_started",
    requestKind: "order_text",
    ...(input.processing_mode ? { processingMode: input.processing_mode } : {}),
  };
  let stage: "authorization" | "budget" | "provider" | "protocol" | "repository" = "authorization";
  let budgetSession: AiProviderBudgetSession | undefined;

  let response: AiOrderAssistantResponse;
  try {
    const capabilities = getAiAssistantCapabilities(actor, dependencies.env);
    if (!capabilities.canUseOrderAssistant) {
      if (capabilities.reason === "feature_off" || capabilities.reason === "rollout_not_enabled") {
        throw aiDisabledError();
      }
      throw aiNotAuthorizedError();
    }

    await (dependencies.consumeRequestRateLimit ?? consumeAiAssistantRequestRateLimit)({
      actor,
      env: dependencies.env,
      now: dependencies.now,
    });

    const deterministic =
      input.processing_mode === "model" ? null : planDeterministicOrderQuery(input);
    let plannedToolCall: unknown;
    if (deterministic) {
      plannedToolCall = deterministic.toolCall;
      auditContext.provider = "none";
      auditContext.modelVersion = deterministic.policyVersion;
      auditContext.policyVersion = deterministic.policyVersion;
      auditContext.resolutionPath = "deterministic";
      auditContext.budgetOutcome = "not_required";
      auditContext.safetyIdentifierPresent = false;
    } else if (input.processing_mode === "local") {
      plannedToolCall = {
        name: "clarify_order_query",
        arguments: {
          question: localModeClarification(input.locale),
        },
      };
      auditContext.provider = "none";
      auditContext.modelVersion = "order-local-clarification-v1";
      auditContext.policyVersion = "order-local-clarification-v1";
      auditContext.resolutionPath = "local";
      auditContext.budgetOutcome = "not_required";
      auditContext.safetyIdentifierPresent = false;
    } else {
      const provider =
        typeof dependencies.provider === "function"
          ? dependencies.provider()
          : dependencies.provider;
      auditContext.provider = provider.name;
      auditContext.resolutionPath = "provider";
      const runtimePolicy = getAiModelRuntimePolicy("order_text");
      const safetyIdentifier = createAiSafetyIdentifierIfConfigured(actor, dependencies.env);
      auditContext.policyVersion = runtimePolicy.policyVersion;
      auditContext.safetyIdentifierPresent = Boolean(safetyIdentifier);
      if (provider.name === "fake") {
        await (dependencies.consumeQuota ?? consumeAiAssistantRequestQuota)({
          actor,
          env: dependencies.env,
          now: dependencies.now,
        });
        auditContext.budgetOutcome = "not_required";
      } else {
        assertAiProviderEgressAllowed({
          requestKind: "order_text",
          env: dependencies.env ?? (process.env as AiAssistantFeatureEnvironment),
          orderMessage: input.message,
        });
        stage = "budget";
        auditContext.budgetOutcome = "blocked";
        const gateway =
          typeof dependencies.budgetGateway === "function"
            ? dependencies.budgetGateway()
            : dependencies.budgetGateway;
        budgetSession = await AiProviderBudgetSession.reserve({
          gateway,
          actor,
          clientRequestId: requestId,
          requestKind: "order_text",
          locale: input.locale,
          content: input.message,
          env: dependencies.env ?? (process.env as AiAssistantFeatureEnvironment),
        });
        auditContext.reservedMicroUsd = budgetSession.reservedMicroUsd;
        auditContext.budgetOutcome = budgetSession.outcome;
      }

      stage = "provider";
      const planned = await provider.planOrderQuery({
        message: input.message,
        locale: input.locale,
        safetyIdentifier,
        signal: createAiProviderSignal(
          dependencies.requestSignal,
          runtimePolicy.providerDeadlineMs,
        ),
      });
      plannedToolCall = planned.toolCall;
      auditContext.provider = planned.metadata.provider;
      auditContext.modelVersion = planned.metadata.model;
      auditContext.inputTokens = planned.metadata.usage?.inputTokens;
      auditContext.cachedInputTokens = planned.metadata.usage?.cachedInputTokens;
      auditContext.cacheWriteTokens = planned.metadata.usage?.cacheWriteTokens;
      auditContext.outputTokens = planned.metadata.usage?.outputTokens;
      auditContext.providerAttemptCount = planned.metadata.attempts;
      auditContext.latencyBucket = bucketAiAssistantLatency(planned.metadata.latencyMs);
      stage = "protocol";
      if (planned.metadata.provider === "openai") {
        if (!budgetSession) throw aiBudgetUnavailableError();
        auditContext.pricingVersion = AI_PRICING_VERSION;
        await budgetSession.settleCompleted(planned.metadata);
        auditContext.estimatedMicroUsd = budgetSession.estimatedMicroUsd;
        auditContext.budgetOutcome = budgetSession.outcome;
      } else {
        auditContext.budgetOutcome = "not_required";
      }
    }

    stage = "protocol";
    const parsedCall = aiOrderToolCallSchema.safeParse(plannedToolCall);
    if (!parsedCall.success) throw aiProtocolError();
    auditContext.event = "order_tool";
    auditContext.toolName = parsedCall.data.name;

    if (parsedCall.data.name === "clarify_order_query") {
      response = buildResponse({
        requestId,
        kind: "clarification",
        message: parsedCall.data.arguments.question,
        cards: [],
        total: 0,
        resultTruncated: false,
        now: dependencies.now,
      });
    } else if (parsedCall.data.name === "search_orders") {
      stage = "repository";
      const args = parsedCall.data.arguments;
      if (args.device_search && args.search) throw aiProtocolError();
      if (
        args.financial_review &&
        !can(actor, "finance:aggregate_read") &&
        !isRepairDeskE2eSystemActor(actor)
      ) {
        throw aiNotAuthorizedError();
      }
      const result = await dependencies.listOrdersPage(
        {
          page: 1,
          pageSize: args.page_size,
          search: args.search ?? undefined,
          deviceSearch: args.device_search ?? undefined,
          view: args.view,
          paid: args.paid,
          overdue: args.overdue ?? undefined,
          queueGroups: args.queue_group ? [args.queue_group] : undefined,
          financialReview: args.financial_review ?? undefined,
        },
        actor,
      );
      const cards = result.items.slice(0, args.page_size).map(toAiOrderCard);
      const isAmountReview = args.financial_review === "amount_anomaly";
      response = buildResponse({
        requestId,
        kind: "search_results",
        message:
          cards.length === 0
            ? isAmountReview
              ? "当前可见的活跃工单中，未发现报价、定金、尾款或付款状态不一致的记录。"
              : "RepairDesk 中没有找到符合条件的工单。你可以补充订单号、客户或设备信息。"
            : isAmountReview
              ? `发现 ${result.total} 条金额状态需要人工核对的工单；请打开工单检查报价、定金、尾款和付款记录。`
              : `RepairDesk 找到 ${result.total} 条符合条件的工单。`,
        cards,
        total: result.total,
        resultTruncated: result.total > cards.length,
        now: dependencies.now,
      });
    } else {
      stage = "repository";
      const reference = parsedCall.data.arguments.order_reference.trim();
      const matches = await dependencies.listOrdersPage(
        { page: 1, pageSize: 20, search: reference, view: "all" },
        actor,
      );
      const exact = findExactOrder(matches.items, reference);
      if (!exact && matches.items.length !== 1) {
        const cards = matches.items.slice(0, 8).map(toAiOrderCard);
        response = buildResponse({
          requestId,
          kind: cards.length > 0 ? "search_results" : "clarification",
          message:
            cards.length > 0
              ? "找到多条可能的工单，请选择一条查看详情。"
              : "没有找到这个工单，请核对订单号或补充客户、设备信息。",
          cards,
          total: matches.total,
          resultTruncated: matches.total > cards.length,
          now: dependencies.now,
        });
      } else {
        const selected = exact ?? matches.items[0];
        if (!selected) throw aiProtocolError();
        const detail = await dependencies.getOrder(selected.id, actor);
        response = buildResponse({
          requestId,
          kind: "order_summary",
          message: `这是 RepairDesk 中 ${detail.order.public_no} 的当前状态。`,
          cards: [toAiOrderCard(detail.order)],
          total: 1,
          resultTruncated: false,
          now: dependencies.now,
        });
      }
    }
  } catch (caught) {
    if (budgetSession) {
      await budgetSession.settleAfterFailure(caught);
      auditContext.estimatedMicroUsd = budgetSession.estimatedMicroUsd;
      auditContext.budgetOutcome = budgetSession.outcome;
    }
    const error = normalizeOrderAssistantError(
      budgetSession?.settlementError ?? caught,
      stage,
      dependencies.requestSignal,
    );
    await writeRequiredAudit({
      actor,
      requestId,
      status: auditStatusFor(error),
      errorCode: error.code,
      promptVersion: AI_ORDER_PLANNER_PROMPT_VERSION,
      schemaVersion: AI_ASSISTANT_CONTRACT_VERSION,
      ...auditContext,
    });
    throw error;
  }

  await writeRequiredAudit({
    actor,
    requestId,
    status: "succeeded",
    promptVersion: AI_ORDER_PLANNER_PROMPT_VERSION,
    schemaVersion: AI_ASSISTANT_CONTRACT_VERSION,
    resultCount: response.cards.length,
    ...auditContext,
  });

  return response;
}

function localModeClarification(locale: AiAssistantRequest["locale"]) {
  if (locale === "it-IT") {
    return "La modalità locale non riconosce ancora questa richiesta. Aggiungi numero ordine, cliente, dispositivo, pagamento o stato, oppure passa a Comprensione AI.";
  }
  if (locale === "en") {
    return "Local processing does not recognize this request yet. Add an order number, customer, device, payment or status, or switch to Model understanding.";
  }
  return "本地处理暂时无法理解这句话。请补充订单号、客户、设备、付款或状态，或者切换到“大模型理解”。";
}

function normalizeOrderAssistantError(
  error: unknown,
  stage: "authorization" | "budget" | "provider" | "protocol" | "repository",
  requestSignal?: AbortSignal,
) {
  if (error instanceof AiServiceError) return error;
  if (error instanceof AiProviderBudgetError) {
    if (error.kind === "quota") {
      return error.safeCode === "actor_minute_limit_reached"
        ? aiRequestRateLimitedError()
        : aiQuotaExhaustedError();
    }
    if (error.kind === "authorization") return aiNotAuthorizedError();
    if (error.kind === "configuration") {
      return new AiServiceError(
        "AI 服务配置尚未完成，请继续使用手工查询",
        "AI_MISCONFIGURED",
        503,
        { retryable: false },
      );
    }
    return aiBudgetUnavailableError();
  }
  if (requestSignal?.aborted && stage === "provider") return aiRequestCancelledError();
  if (stage === "provider") {
    if (error instanceof AiProviderRequestError && error.category === "cancelled") {
      return aiRequestCancelledError();
    }
    if (error instanceof AiProviderRequestError && error.category === "timeout") {
      return aiProviderTimeoutError();
    }
    if (error instanceof AiProviderRequestError && error.category === "configuration") {
      return new AiServiceError(
        "AI 服务配置尚未完成，请继续使用手工查询",
        "AI_MISCONFIGURED",
        503,
        { retryable: false },
      );
    }
    if (isRateLimitedError(error)) return aiProviderRateLimitedError();
    if (isAiProviderTimeoutError(error)) return aiProviderTimeoutError();
    if (error instanceof AiProviderRequestError && error.category === "protocol") {
      return aiProtocolError();
    }
    return aiProviderUnavailableError();
  }
  if (stage === "budget") return aiBudgetUnavailableError();
  if (stage === "repository") return aiDependencyUnavailableError();
  return aiProtocolError();
}

function isRateLimitedError(error: unknown) {
  return (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status === 429
  );
}

function auditStatusFor(error: AiServiceError): AiAssistantAuditStatus {
  if (error.code === "AI_NOT_AUTHORIZED" || error.code === "AI_DISABLED") return "rejected";
  if (
    error.code === "AI_PROVIDER_RATE_LIMITED" ||
    error.code === "AI_QUOTA_EXHAUSTED" ||
    error.code === "AI_RATE_LIMITED"
  ) {
    return "rate_limited";
  }
  if (error.code === "AI_REQUEST_CANCELLED") return "cancelled";
  return "failed";
}

async function writeRequiredAudit(input: WriteAiAssistantAuditInput) {
  try {
    await writeAiAssistantAudit(input);
  } catch {
    console.error("[ai-assistant] audit write unavailable", {
      requestId: input.requestId,
      event: input.event,
      status: input.status,
      errorCode: "AI_AUDIT_UNAVAILABLE",
    });
    throw aiAuditUnavailableError();
  }
}

function buildResponse({
  requestId,
  kind,
  message,
  cards,
  total,
  resultTruncated,
  now = () => new Date(),
}: {
  requestId: string;
  kind: AiOrderAssistantResponse["kind"];
  message: string;
  cards: AiOrderCard[];
  total: number;
  resultTruncated: boolean;
  now?: () => Date;
}): AiOrderAssistantResponse {
  return {
    request_id: requestId,
    contract_version: AI_ASSISTANT_CONTRACT_VERSION,
    kind,
    message,
    cards,
    total,
    result_truncated: resultTruncated,
    generated_at: now().toISOString(),
    source: "repairdesk",
  };
}

export function toAiOrderCard(order: OrderListItem): AiOrderCard {
  const displayStatus = order.workflow_status ?? order.status;
  return {
    id: order.id,
    public_no: order.public_no,
    customer_hint: maskCustomerName(order.customer_name),
    device_label: order.device_label,
    status: displayStatus,
    status_label: getStatusMeta(displayStatus).label,
    updated_at: order.updated_at,
    href: `/orders/${encodeURIComponent(order.id)}`,
  };
}

export function maskCustomerName(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "客户";
  return words
    .map((word) => `${Array.from(word)[0] ?? ""}${word.length > 1 ? "***" : "*"}`)
    .join(" ");
}

function findExactOrder(items: OrderListItem[], reference: string) {
  const normalized = reference.replace(/^#/, "").trim().toLowerCase();
  return items.find(
    (item) =>
      item.id.toLowerCase() === normalized ||
      item.public_no.toLowerCase() === normalized ||
      item.public_no.replace(/^#/, "").toLowerCase() === normalized,
  );
}
