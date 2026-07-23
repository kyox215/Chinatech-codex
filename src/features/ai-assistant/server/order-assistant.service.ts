import { randomUUID } from "node:crypto";

import {
  AI_ORDER_ASSISTANT_CONTRACT_VERSION,
  AI_ORDER_PLANNER_PROMPT_VERSION,
  aiOrderToolCallSchema,
  type AiAssistantRequest,
  type AiOrderAssistantResponse,
  type AiOrderAppliedFilter,
  type AiOrderCard,
  type AiOrderInterpretationStatus,
  type AiOrderToolCall,
} from "@/features/ai-assistant/model/contracts";
import { deviceLabelMatchesSearch } from "@/entities/order";
import { buildOrderDetailWorkspaceHref } from "@/features/orders/model/order-workspace-intent";
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
import {
  extractTrustedOrderSearchConstraints,
  hasExplicitAllOrderScope,
  planDeterministicOrderQuery,
} from "./order-intent-router";
import {
  createAiOrderContinuationToken,
  verifyAiOrderContinuationToken,
} from "./order-continuation";
import {
  compileEvidenceBackedProviderConstraints,
  stripOrderSearchEvidence,
} from "./order-query-evidence";
import {
  AI_ORDER_QUERY_TIME_ZONE,
  hasUnresolvedOrderDateExpression,
  redactValidatedOrderDateTokensForEgress,
  resolveOrderDateFilter,
} from "./order-query-date";
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
    | "acceptedFieldCount"
    | "changedFieldCount"
    | "rejectedFieldCount"
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
    const requestedPage = input.page ?? 1;
    const continuationCall = input.continuation_token
      ? verifyAiOrderContinuationToken({
          actor,
          token: input.continuation_token,
          secret: (dependencies.env ?? (process.env as AiAssistantFeatureEnvironment))
            .AI_ASSISTANT_REQUEST_FINGERPRINT_SECRET,
          now: dependencies.now?.(),
        })
      : null;
    const trustedSearchConstraints = continuationCall
      ? {}
      : extractTrustedOrderSearchConstraints(input.message);
    const unresolvedDateExpression = continuationCall
      ? false
      : hasUnresolvedOrderDateExpression(input.message);
    const localCandidate = continuationCall ? null : planDeterministicOrderQuery(input);
    const deterministic =
      unresolvedDateExpression ||
      (input.processing_mode === "model" && localCandidate?.toolCall.name !== "get_order_summary")
        ? null
        : localCandidate;
    let authoritativeSafetyPlan = false;
    let plannedToolCall: unknown;
    if (continuationCall) {
      authoritativeSafetyPlan = true;
      plannedToolCall = continuationCall;
      auditContext.provider = "none";
      auditContext.modelVersion = "order-continuation-v1";
      auditContext.policyVersion = "order-continuation-v1";
      auditContext.resolutionPath = "local";
      auditContext.budgetOutcome = "not_required";
      auditContext.safetyIdentifierPresent = false;
    } else if (unresolvedDateExpression) {
      authoritativeSafetyPlan = true;
      plannedToolCall = {
        name: "clarify_order_query",
        arguments: { question: unresolvedDateClarification(input.locale) },
      };
      auditContext.provider = "none";
      auditContext.modelVersion = "order-date-clarification-v1";
      auditContext.policyVersion = "order-date-clarification-v1";
      auditContext.resolutionPath = "deterministic";
      auditContext.budgetOutcome = "not_required";
      auditContext.safetyIdentifierPresent = false;
    } else if (deterministic) {
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
          orderMessage: redactValidatedOrderDateTokensForEgress(input.message),
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
    const reconciliation =
      deterministic || authoritativeSafetyPlan
        ? {
            toolCall: parsedCall.data,
            interpretationStatus:
              parsedCall.data.name === "clarify_order_query"
                ? ("needs_confirmation" as const)
                : ("confirmed" as const),
            acceptedFieldCount: 0,
            changedFieldCount: 0,
            rejectedFieldCount: 0,
          }
        : reconcileTrustedSearchConstraints(
            parsedCall.data,
            trustedSearchConstraints,
            input.message,
          );
    const effectiveCall = reconciliation.toolCall;
    auditContext.acceptedFieldCount = reconciliation.acceptedFieldCount;
    auditContext.changedFieldCount = reconciliation.changedFieldCount;
    auditContext.rejectedFieldCount = reconciliation.rejectedFieldCount;
    auditContext.event = "order_tool";
    auditContext.toolName = effectiveCall.name;

    if (effectiveCall.name === "clarify_order_query") {
      response = buildResponse({
        requestId,
        kind: "clarification",
        interpretationStatus: "needs_confirmation",
        message: effectiveCall.arguments.question,
        cards: [],
        appliedFilters: [],
        total: 0,
        resultTruncated: false,
        now: dependencies.now,
      });
    } else if (effectiveCall.name === "search_orders") {
      stage = "repository";
      const args = effectiveCall.arguments;
      const resolvedDate = resolveOrderDateFilter(args.date_filter, dependencies.now?.());
      if (args.device_search && args.search) throw aiProtocolError();
      if (
        args.financial_review &&
        !can(actor, "finance:aggregate_read") &&
        !isRepairDeskE2eSystemActor(actor)
      ) {
        throw aiNotAuthorizedError();
      }
      if (
        args.view !== "active" &&
        !can(actor, "order:archive_browse") &&
        !isRepairDeskE2eSystemActor(actor)
      ) {
        throw aiNotAuthorizedError();
      }
      const result = await dependencies.listOrdersPage(
        {
          page: requestedPage,
          pageSize: args.page_size,
          search: args.search ?? undefined,
          deviceSearch: args.device_search ?? undefined,
          view: args.view,
          paid: args.paid,
          overdue: args.overdue ?? undefined,
          queueGroups: args.queue_group ? [args.queue_group] : undefined,
          financialReview: args.financial_review ?? undefined,
          partsStatuses: args.parts_status ? [args.parts_status] : undefined,
          dateField: resolvedDate?.field,
          dateFrom: resolvedDate?.from ?? undefined,
          dateTo: resolvedDate?.to ?? undefined,
          dateTimeZone:
            resolvedDate && (resolvedDate.from || resolvedDate.to)
              ? AI_ORDER_QUERY_TIME_ZONE
              : undefined,
          repairServiceGroups: args.service_group ? [args.service_group] : undefined,
          completedOnly: args.completed_only,
          sortDateField: resolvedDate?.field ?? (args.completed_only ? "completed_at" : undefined),
        },
        actor,
      );
      const effectiveDeviceSearch = args.device_search;
      if (
        effectiveDeviceSearch &&
        result.items.some(
          (item) => !deviceLabelMatchesSearch(item.device_label, effectiveDeviceSearch),
        )
      ) {
        throw aiProtocolError();
      }
      const appliedFilters = buildAppliedFilters(args, resolvedDate, {
        explicitView: hasExplicitAllOrderScope(input.message),
      });
      const cards = result.items.slice(0, args.page_size).map((order) =>
        toAiOrderCard(order, {
          appliedFilters,
          canUseInlineActions: capabilities.canUseOrderInlineActions,
        }),
      );
      const isAmountReview = args.financial_review === "amount_anomaly";
      const isQuotedServiceReview = Boolean(args.service_group);
      const isPartsNeeded = args.parts_status === "needed";
      const moreResultsExist =
        result.page < result.pageCount ||
        result.total > (result.page - 1) * result.pageSize + cards.length;
      const continuationToken = moreResultsExist
        ? createAiOrderContinuationToken({
            actor,
            toolCall: effectiveCall,
            secret: (dependencies.env ?? (process.env as AiAssistantFeatureEnvironment))
              .AI_ASSISTANT_REQUEST_FINGERPRINT_SECRET,
            now: dependencies.now?.(),
          })
        : null;
      response = buildResponse({
        requestId,
        kind: "search_results",
        interpretationStatus: reconciliation.interpretationStatus,
        message:
          cards.length === 0
            ? isAmountReview
              ? "当前查询范围内未发现报价、定金、尾款或付款状态不一致的记录。"
              : isPartsNeeded
                ? "当前没有已标记为待订件的工单。该结果只依据订单级配件标记，可能不包含尚未记录的采购需求。"
                : "没有符合这些已确认条件的工单。"
            : isAmountReview
              ? `发现 ${result.total} 条金额状态需要人工核对的工单；请打开工单检查报价、定金、尾款和付款记录。`
              : isQuotedServiceReview
                ? `找到 ${result.total} 条符合条件的工单。维修项目依据报价记录匹配，不代表系统已确认实际更换。`
                : `RepairDesk 找到 ${result.total} 条符合条件的工单。`,
        cards,
        appliedFilters,
        total: result.total,
        resultTruncated: moreResultsExist,
        page: result.page,
        pageSize: result.pageSize,
        hasMore: moreResultsExist && Boolean(continuationToken),
        continuationToken,
        now: dependencies.now,
      });
    } else {
      stage = "repository";
      const reference = effectiveCall.arguments.order_reference.trim();
      const matches = await dependencies.listOrdersPage(
        { page: 1, pageSize: 20, search: reference, view: "all" },
        actor,
      );
      const exact = findExactOrder(matches.items, reference);
      if (!exact && matches.items.length !== 1) {
        const cards = matches.items.slice(0, 8).map((order) => toAiOrderCard(order));
        response = buildResponse({
          requestId,
          kind: cards.length > 0 ? "search_results" : "clarification",
          interpretationStatus: cards.length > 0 ? "confirmed" : "needs_confirmation",
          message:
            cards.length > 0
              ? "找到多条可能的工单，请选择一条查看详情。"
              : "没有找到这个工单，请核对订单号或补充客户、设备信息。",
          cards,
          appliedFilters: [],
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
          interpretationStatus: "confirmed",
          message: `这是 RepairDesk 中 ${detail.order.public_no} 的当前状态。`,
          cards: [toAiOrderCard(detail.order)],
          appliedFilters: [
            {
              key: "order_reference",
              label: "工单",
              value: detail.order.public_no,
              evidence: "exact",
              source: "user_explicit",
            },
          ],
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
      schemaVersion: AI_ORDER_ASSISTANT_CONTRACT_VERSION,
      ...auditContext,
    });
    throw error;
  }

  await writeRequiredAudit({
    actor,
    requestId,
    status: "succeeded",
    promptVersion: AI_ORDER_PLANNER_PROMPT_VERSION,
    schemaVersion: AI_ORDER_ASSISTANT_CONTRACT_VERSION,
    resultCount: response.cards.length,
    ...auditContext,
  });

  return response;
}

function reconcileTrustedSearchConstraints(
  call: AiOrderToolCall,
  trusted: Partial<Extract<AiOrderToolCall, { name: "search_orders" }>["arguments"]>,
  message: string,
): {
  toolCall: AiOrderToolCall;
  interpretationStatus: AiOrderInterpretationStatus;
  acceptedFieldCount: number;
  changedFieldCount: number;
  rejectedFieldCount: number;
} {
  const compilation =
    call.name === "search_orders"
      ? compileEvidenceBackedProviderConstraints(message, call.arguments)
      : { constraints: {}, acceptedFields: [], rejectedFields: [] };
  const merged = {
    ...compilation.constraints,
    ...trusted,
  } as Partial<Extract<AiOrderToolCall, { name: "search_orders" }>["arguments"]>;
  if (merged.device_search) merged.search = null;
  if (
    merged.date_filter ||
    merged.completed_only ||
    merged.service_group ||
    merged.view === "archive" ||
    merged.view === "all"
  ) {
    merged.view = merged.view === "archive" ? "archive" : "all";
  }

  if (!hasExecutableOrderConstraint(merged)) {
    const clarification =
      call.name === "clarify_order_query"
        ? call
        : aiOrderToolCallSchema.parse({
            name: "clarify_order_query",
            arguments: {
              question:
                "我还不能可靠确认这句话对应的订单条件，因此没有执行查询。请补充设备、日期、付款、流程或配件状态。",
            },
          });
    return {
      toolCall: clarification,
      interpretationStatus: "needs_confirmation",
      acceptedFieldCount: compilation.acceptedFields.length,
      changedFieldCount: call.name === "clarify_order_query" ? 0 : 1,
      rejectedFieldCount: compilation.rejectedFields.length,
    };
  }

  const authoritative = aiOrderToolCallSchema.parse(searchCall(merged));
  if (authoritative.name !== "search_orders") throw new Error("invalid authoritative AI search");
  const providerMatched =
    call.name === "search_orders" &&
    JSON.stringify({ ...stripOrderSearchEvidence(call.arguments), page_size: 8 }) ===
      JSON.stringify(stripOrderSearchEvidence(authoritative.arguments));
  const changedFieldCount = providerMatched ? 0 : Math.max(1, compilation.rejectedFields.length);
  return {
    toolCall: authoritative,
    interpretationStatus: providerMatched
      ? authoritative.arguments.view === "active"
        ? "defaulted"
        : "confirmed"
      : "corrected",
    acceptedFieldCount: compilation.acceptedFields.length,
    changedFieldCount,
    rejectedFieldCount: compilation.rejectedFields.length,
  };
}

function hasExecutableOrderConstraint(
  constraints: Partial<Extract<AiOrderToolCall, { name: "search_orders" }>["arguments"]>,
) {
  return Boolean(
    constraints.search ||
    constraints.device_search ||
    (constraints.view && constraints.view !== "active") ||
    (constraints.paid && constraints.paid !== "all") ||
    constraints.overdue ||
    constraints.queue_group ||
    constraints.financial_review ||
    constraints.date_filter ||
    constraints.service_group ||
    constraints.completed_only ||
    constraints.parts_status,
  );
}

function localModeClarification(locale: AiAssistantRequest["locale"]) {
  if (locale === "it-IT") {
    return "La modalità locale non riconosce ancora questa richiesta. Aggiungi numero ordine, cliente, dispositivo, pagamento o stato, oppure passa ad Assistenza AI.";
  }
  if (locale === "en") {
    return "Local processing does not recognize this request yet. Add an order number, customer, device, payment or status, or switch to Model assistance.";
  }
  return "本地处理暂时无法理解这句话。请补充订单号、客户、设备、付款或状态，或者切换到“大模型辅助”。";
}

function unresolvedDateClarification(locale: AiAssistantRequest["locale"]) {
  if (locale === "it-IT") {
    return "Non ho eseguito la ricerca perché la data è invalida o ambigua. Usa una data completa come 2026-07-19 oppure un intervallo con inizio e fine.";
  }
  if (locale === "en") {
    return "I did not run the search because the date is invalid or ambiguous. Use a complete date such as 2026-07-19, or provide a start and end date.";
  }
  return "这次没有执行查询，因为日期无效或存在歧义。请使用 2026-07-19 这样的完整日期，或补充明确的开始和结束日期。";
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
  interpretationStatus,
  message,
  cards,
  appliedFilters,
  total,
  resultTruncated,
  page = 1,
  pageSize = 8,
  hasMore = false,
  continuationToken = null,
  now = () => new Date(),
}: {
  requestId: string;
  kind: AiOrderAssistantResponse["kind"];
  interpretationStatus: AiOrderInterpretationStatus;
  message: string;
  cards: AiOrderCard[];
  appliedFilters: AiOrderAppliedFilter[];
  total: number;
  resultTruncated: boolean;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
  continuationToken?: string | null;
  now?: () => Date;
}): AiOrderAssistantResponse {
  return {
    request_id: requestId,
    contract_version: AI_ORDER_ASSISTANT_CONTRACT_VERSION,
    kind,
    interpretation_status: interpretationStatus,
    message,
    applied_filters: appliedFilters,
    cards,
    total,
    result_truncated: resultTruncated,
    page,
    page_size: pageSize,
    has_more: hasMore,
    continuation_token: continuationToken,
    generated_at: now().toISOString(),
    source: "repairdesk",
  };
}

export function toAiOrderCard(
  order: OrderListItem,
  options: {
    appliedFilters?: AiOrderAppliedFilter[];
    canUseInlineActions?: boolean;
  } = {},
): AiOrderCard {
  const displayStatus = order.workflow_status ?? order.status;
  return {
    id: order.id,
    public_no: order.public_no,
    customer_hint: maskCustomerName(order.customer_name),
    device_label: order.device_label,
    status: displayStatus,
    status_label: getStatusMeta(displayStatus).label,
    updated_at: order.updated_at,
    completed_at: order.completed_at ?? null,
    parts_status: order.parts_status ?? null,
    matched_reasons: (options.appliedFilters ?? []).map((filter) => filter.value).slice(0, 8),
    allowed_actions: allowedInlineActions(order, Boolean(options.canUseInlineActions)),
    href: buildOrderDetailWorkspaceHref(order.id, { source: "ai-assistant" }),
  };
}

function searchCall(
  overrides: Partial<Extract<AiOrderToolCall, { name: "search_orders" }>["arguments"]>,
): AiOrderToolCall {
  return {
    name: "search_orders",
    arguments: {
      search: null,
      device_search: null,
      view: "active",
      paid: "all",
      overdue: null,
      queue_group: null,
      financial_review: null,
      date_filter: null,
      service_group: null,
      completed_only: false,
      parts_status: null,
      page_size: 8,
      ...overrides,
    },
  };
}

function buildAppliedFilters(
  args: Extract<AiOrderToolCall, { name: "search_orders" }>["arguments"],
  resolvedDate: ReturnType<typeof resolveOrderDateFilter>,
  options: { explicitView: boolean },
): AiOrderAppliedFilter[] {
  const filters: AiOrderAppliedFilter[] = [
    {
      key: "scope",
      label: "范围",
      value: orderViewLabel(args.view),
      evidence: "exact",
      source: options.explicitView
        ? "user_explicit"
        : args.view === "active"
          ? "system_default"
          : "server_derived",
    },
  ];
  if (args.device_search) {
    filters.push({
      key: "device",
      label: "设备",
      value: args.device_search,
      evidence: "exact",
      source: "user_explicit",
    });
  }
  if (resolvedDate) {
    const exactRange =
      resolvedDate.from && resolvedDate.to
        ? resolvedDate.from === resolvedDate.to
          ? resolvedDate.from
          : `${resolvedDate.from}—${resolvedDate.to}`
        : resolvedDate.from
          ? `${resolvedDate.from}起`
          : resolvedDate.to
            ? `截至${resolvedDate.to}`
            : "全部日期";
    filters.push({
      key: "date",
      label: "时间",
      value: `${exactRange}（${resolvedDate.fieldLabel} · ${resolvedDate.timeZone}）`,
      evidence: "exact",
      source: "user_explicit",
    });
  }
  if (args.completed_only) {
    filters.push({
      key: "completed",
      label: "流程",
      value: "已完成",
      evidence: "exact",
      source: "user_explicit",
    });
  }
  if (args.service_group) {
    filters.push({
      key: "service",
      label: "维修项目",
      value: `${serviceGroupLabel(args.service_group)}（依据报价项目）`,
      evidence: "quoted",
      source: "user_explicit",
    });
  }
  if (args.parts_status) {
    filters.push({
      key: "parts",
      label: "配件",
      value: `${partsStatusLabel(args.parts_status)}（订单级标记）`,
      evidence: "order_level",
      source: "user_explicit",
    });
  }
  if (args.paid !== "all") {
    filters.push({
      key: "payment",
      label: "付款",
      value: args.paid === "paid" ? "已付款" : "未付款",
      evidence: "exact",
      source: "user_explicit",
    });
  }
  if (args.queue_group) {
    filters.push({
      key: "queue",
      label: "队列",
      value: queueGroupLabel(args.queue_group),
      evidence: "exact",
      source: "user_explicit",
    });
  }
  if (args.overdue) {
    filters.push({
      key: "overdue",
      label: "时效",
      value: "已逾期",
      evidence: "exact",
      source: "user_explicit",
    });
  }
  if (args.financial_review) {
    filters.push({
      key: "finance",
      label: "复核",
      value: "金额状态异常",
      evidence: "exact",
      source: "user_explicit",
    });
  }
  return filters;
}

function orderViewLabel(
  view: Extract<AiOrderToolCall, { name: "search_orders" }>["arguments"]["view"],
) {
  if (view === "all") return "全部工单";
  if (view === "archive") return "归档工单";
  return "活跃工单";
}

function allowedInlineActions(
  order: OrderListItem,
  enabled: boolean,
): AiOrderCard["allowed_actions"] {
  if (!enabled || order.parts_status !== "needed") return [];
  if (
    order.record_state === "voided" ||
    Boolean(order.deleted_at) ||
    order.status === "completed" ||
    order.status === "cancelled" ||
    order.workflow_status === "closed"
  ) {
    return [];
  }
  return [
    {
      action: "mark_parts_ordered",
      label: "标记已订件",
      description: "仅在您已向供应商完成下单后记录状态；RepairDesk 不会自动采购或付款。",
      requires_confirmation: true,
    },
  ];
}

function serviceGroupLabel(
  value: NonNullable<
    Extract<AiOrderToolCall, { name: "search_orders" }>["arguments"]["service_group"]
  >,
) {
  return (
    {
      display: "屏幕",
      battery: "电池",
      charging: "尾插",
      camera: "摄像头",
      liquid: "进水",
      mainboard: "主板",
      system: "系统",
      "back-cover": "后盖",
      face: "面容/指纹",
      speaker: "扬声器",
      microphone: "麦克风",
      button: "按键",
    } as const
  )[value];
}

function partsStatusLabel(
  value: NonNullable<
    Extract<AiOrderToolCall, { name: "search_orders" }>["arguments"]["parts_status"]
  >,
) {
  return { needed: "待订件", ordered: "配件已订", arrived: "配件已到", out_of_stock: "缺货" }[
    value
  ];
}

function queueGroupLabel(
  value: NonNullable<
    Extract<AiOrderToolCall, { name: "search_orders" }>["arguments"]["queue_group"]
  >,
) {
  return {
    processing: "处理中",
    ordered: "配件已订",
    arrived: "配件已到",
    arrived_notified: "到货已通知",
    repaired: "已维修",
    repaired_notified: "已维修并通知",
  }[value];
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
