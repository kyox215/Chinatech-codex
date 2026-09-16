import type {
  AuditActor,
  OrderNotificationInput,
  OrderNotificationResult,
  OrderWhatsappNotificationInput,
} from "@/lib/repairdesk/types";
import { requireStoreIdFromActor } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";
import { resolveWhatsappPhone } from "@/shared/lib/whatsapp-phone";
import { OrderMutationError } from "./order-mutation";

const failures: Record<string, [number, string]> = {
  actor_forbidden: [403, "当前员工没有记录客户通知的权限"],
  order_not_found: [404, "工单不存在或不属于当前店铺"],
  order_voided: [409, "该工单记录已作废，只能查看历史证据"],
  stale_version: [409, "工单已被更新，请载入最新版本后重新确认通知"],
  idempotency_conflict: [409, "本次通知标识已用于其他内容，请载入最新版本"],
  custody_required: [409, "设备未留店，不能发送取机通知或进入该状态"],
  invalid_transition: [409, "通知不能执行此状态流转，请使用对应工单操作"],
  invalid_request: [400, "通知内容、版本或提交标识无效"],
};

export async function recordOrderNotification(
  id: string,
  input: OrderNotificationInput & Partial<OrderWhatsappNotificationInput>,
  actor: AuditActor,
): Promise<OrderNotificationResult> {
  const storeId = requireStoreIdFromActor(actor);
  if (!actor.id || !["owner", "manager", "sales"].includes(actor.storeRole ?? actor.role ?? "")) {
    throw new OrderMutationError(failures.actor_forbidden[1], "actor_forbidden", 403);
  }
  const body = input.body.trim();
  if (
    !body ||
    body.length > 10000 ||
    !input.expected_updated_at ||
    !Number.isFinite(Date.parse(input.expected_updated_at)) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.idempotency_key)
  )
    throw new OrderMutationError(failures.invalid_request[1], "invalid_request", 400);
  const recipient = input.recipient_phone ? resolveWhatsappPhone(input.recipient_phone) : null;
  if (recipient && !recipient.valid) {
    throw new OrderMutationError(failures.invalid_request[1], "invalid_request", 400);
  }
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_record_order_notification", {
    p_store_id: storeId,
    p_actor_id: actor.id,
    p_order_id: id,
    p_expected_updated_at: input.expected_updated_at,
    p_operation_id: input.idempotency_key,
    p_body: body,
    p_channel: input.channel,
    p_template_kind: input.template_kind ?? null,
    p_recipient_phone: recipient?.valid ? recipient.e164 : null,
    p_transition_to: input.transition_to ?? null,
  });
  if (error) {
    throw new OrderMutationError(
      "通知事务未确认，请保留原请求并重试",
      ["PGRST202", "42883"].includes(error.code ?? "")
        ? "ORDER_NOTIFICATION_MIGRATION_REQUIRED"
        : "ORDER_NOTIFICATION_TRANSACTION_FAILED",
      503,
    );
  }
  const result = data as Record<string, unknown> | null;
  if (result?.ok === false && typeof result.code === "string" && failures[result.code]) {
    const [status, message] = failures[result.code];
    throw new OrderMutationError(message, result.code, status);
  }
  if (
    result?.ok !== true ||
    typeof result.id !== "string" ||
    !result.id ||
    typeof result.event_id !== "string" ||
    !result.event_id ||
    typeof result.updated_at !== "string" ||
    !Number.isFinite(Date.parse(result.updated_at)) ||
    typeof result.replayed !== "boolean" ||
    result.delivery_verified !== false ||
    result.channel !== input.channel ||
    result.body !== body ||
    result.statusChanged !== Boolean(input.transition_to) ||
    result.to !== (input.transition_to ?? null) ||
    result.recipient_phone !== (recipient?.valid ? recipient.e164 : null) ||
    typeof result.from !== "string" ||
    (input.template_kind !== undefined && result.template_kind !== input.template_kind)
  ) {
    throw new OrderMutationError(
      "通知事务回执不完整，请用原请求重试",
      "ORDER_NOTIFICATION_INVALID_RESULT",
      503,
    );
  }
  return result as unknown as OrderNotificationResult;
}
