import {
  type AiOrderInlineActionRequest,
  type AiOrderInlineActionResponse,
} from "@/features/ai-assistant/model/contracts";
import type { AuditActor, OrderDetail } from "@/lib/repairdesk/types";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import { getAiAssistantCapabilities } from "./capabilities";
import {
  AiServiceError,
  type AiServiceErrorCode,
  aiDisabledError,
  aiNotAuthorizedError,
} from "./errors";
import type { AiAssistantFeatureEnvironment } from "./feature-flags";
import { toAiOrderCard } from "./order-assistant.service";

type InlineActionDependencies = {
  getOrder: (id: string, actor: AuditActor) => Promise<OrderDetail>;
  transitionOrder: (
    id: string,
    to: RepairOrderStatus,
    options: {
      reason?: string;
      expectedUpdatedAt?: string;
      idempotencyKey?: string;
      operator?: AuditActor;
    },
  ) => Promise<unknown>;
  env?: AiAssistantFeatureEnvironment;
};

export async function runAiOrderInlineAction({
  actor,
  input,
  dependencies,
}: {
  actor: AuditActor;
  input: AiOrderInlineActionRequest;
  dependencies: InlineActionDependencies;
}): Promise<AiOrderInlineActionResponse> {
  const capabilities = getAiAssistantCapabilities(actor, dependencies.env);
  if (!capabilities.canUseOrderAssistant) throw aiNotAuthorizedError();
  if (!capabilities.canUseOrderInlineActions) throw aiDisabledError();

  const current = await dependencies.getOrder(input.order_id, actor);
  if (current.order.public_no !== input.confirm_public_no) {
    throw conflict("AI_ACTION_CONFIRMATION_MISMATCH", "工单号确认不匹配，请刷新结果后重试");
  }
  if (current.order.updated_at !== input.expected_updated_at) {
    throw conflict("AI_ACTION_STALE_ORDER", "工单已发生变化，请刷新结果后重试");
  }
  if (current.capabilities?.canTransition !== true) throw aiNotAuthorizedError();

  const allowed = toAiOrderCard(current.order, { canUseInlineActions: true }).allowed_actions;
  if (!allowed.some((candidate) => candidate.action === input.action)) {
    throw conflict("AI_ACTION_NOT_AVAILABLE", "当前工单状态已不支持这项操作，请刷新结果");
  }

  try {
    await dependencies.transitionOrder(input.order_id, targetStatus(input.action), {
      reason: "ai_inline_action_confirmed",
      expectedUpdatedAt: input.expected_updated_at,
      idempotencyKey: input.idempotency_key,
      operator: actor,
    });
  } catch (error) {
    if (error instanceof Error && /已被更新|版本|stale/i.test(error.message)) {
      throw conflict("AI_ACTION_STALE_ORDER", "工单已发生变化，请刷新结果后重试");
    }
    throw error;
  }

  const updated = await dependencies.getOrder(input.order_id, actor);
  return {
    ok: true,
    action: input.action,
    message: "已记录为配件已订。此操作不会向供应商下单、付款或分配库存。",
    card: toAiOrderCard(updated.order, { canUseInlineActions: true }),
  };
}

function targetStatus(action: AiOrderInlineActionRequest["action"]): RepairOrderStatus {
  if (action === "mark_parts_ordered") return "parts_ordered";
  throw conflict("AI_ACTION_NOT_AVAILABLE", "不支持的订单操作");
}

function conflict(code: AiServiceErrorCode, message: string) {
  return new AiServiceError(message, code, 409, { retryable: false });
}
