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
import {
  AiServiceError,
  aiAuditUnavailableError,
  aiDependencyUnavailableError,
  aiDisabledError,
  aiNotAuthorizedError,
  aiProtocolError,
  aiProviderRateLimitedError,
  aiProviderTimeoutError,
  aiProviderUnavailableError,
} from "./errors";
import type { AiAssistantFeatureEnvironment } from "./feature-flags";
import type { AiAssistantProvider } from "./provider";
import { consumeAiAssistantRequestQuota, type ConsumeAiAssistantQuotaInput } from "./quota";
import { getStatusMeta } from "@/lib/mock/enums";
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
  consumeQuota?: (input: ConsumeAiAssistantQuotaInput) => unknown | Promise<unknown>;
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
  const requestId = randomUUID();
  const auditContext: Pick<
    WriteAiAssistantAuditInput,
    | "event"
    | "provider"
    | "modelVersion"
    | "toolName"
    | "inputTokens"
    | "outputTokens"
    | "latencyBucket"
  > = {
    event: "order_plan",
    provider: "none",
    modelVersion: "not_started",
  };
  let stage: "authorization" | "provider" | "protocol" | "repository" = "authorization";

  let response: AiOrderAssistantResponse;
  try {
    const capabilities = getAiAssistantCapabilities(actor, dependencies.env);
    if (!capabilities.canUseOrderAssistant) {
      if (capabilities.reason === "feature_off" || capabilities.reason === "rollout_not_enabled") {
        throw aiDisabledError();
      }
      throw aiNotAuthorizedError();
    }

    await (dependencies.consumeQuota ?? consumeAiAssistantRequestQuota)({
      actor,
      env: dependencies.env,
      now: dependencies.now,
    });

    stage = "provider";
    const provider =
      typeof dependencies.provider === "function" ? dependencies.provider() : dependencies.provider;
    auditContext.provider = provider.name;
    const planned = await provider.planOrderQuery({
      message: input.message,
      locale: input.locale,
    });
    auditContext.provider = planned.metadata.provider;
    auditContext.modelVersion = planned.metadata.model;
    auditContext.inputTokens = planned.metadata.usage?.inputTokens;
    auditContext.outputTokens = planned.metadata.usage?.outputTokens;
    auditContext.latencyBucket = bucketAiAssistantLatency(planned.metadata.latencyMs);

    stage = "protocol";
    const parsedCall = aiOrderToolCallSchema.safeParse(planned.toolCall);
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
      const result = await dependencies.listOrdersPage(
        {
          page: 1,
          pageSize: args.page_size,
          search: args.search ?? undefined,
          view: args.view,
          paid: args.paid,
          overdue: args.overdue ?? undefined,
          queueGroups: args.queue_group ? [args.queue_group] : undefined,
        },
        actor,
      );
      const cards = result.items.slice(0, args.page_size).map(toAiOrderCard);
      response = buildResponse({
        requestId,
        kind: "search_results",
        message:
          cards.length === 0
            ? "RepairDesk 中没有找到符合条件的工单。你可以补充订单号、客户或设备信息。"
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
    const error = normalizeOrderAssistantError(caught, stage);
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

function normalizeOrderAssistantError(
  error: unknown,
  stage: "authorization" | "provider" | "protocol" | "repository",
) {
  if (error instanceof AiServiceError) return error;
  if (stage === "provider") {
    if (isRateLimitedError(error)) return aiProviderRateLimitedError();
    if (error instanceof Error && error.name === "AbortError") return aiProviderTimeoutError();
    return aiProviderUnavailableError();
  }
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
  if (error.code === "AI_PROVIDER_RATE_LIMITED" || error.code === "AI_QUOTA_EXHAUSTED") {
    return "rate_limited";
  }
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
