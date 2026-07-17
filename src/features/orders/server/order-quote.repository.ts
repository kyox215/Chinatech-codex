import type {
  AuditActor,
  ConfirmOrderQuoteSentInput,
  ConfirmOrderQuoteSentResult,
  PublishOrderQuoteInput,
  PublishOrderQuoteResult,
} from "@/lib/repairdesk/types";
import { getSupabaseAdmin } from "@/server/supabase";
import { fail, money, requiredString, requireStoreIdFromActor } from "@/server/repairdesk-shared";
import { isOrderCostsEnabled } from "./order-cost-feature";

export class OrderQuoteOperationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "OrderQuoteOperationError";
  }
}

export async function publishOrderQuote(
  id: string,
  input: PublishOrderQuoteInput,
  actor: AuditActor,
): Promise<PublishOrderQuoteResult> {
  const storeId = requireStoreIdFromActor(actor);
  if (!actor.id) throw quoteFailure("actor_forbidden");

  const supabase = getSupabaseAdmin();
  const rpcName = getOrderQuotePublishRpcName();
  const faultPrices = isOrderCostsEnabled()
    ? input.fault_prices
    : input.fault_prices.map(({ name, price, currency_code, note }) => ({
        name,
        price,
        ...(currency_code ? { currency_code } : {}),
        ...(note ? { note } : {}),
      }));
  const { data, error } = await supabase.rpc(rpcName, {
    p_store_id: storeId,
    p_order_id: id,
    p_actor_id: actor.id,
    p_expected_updated_at: input.expected_updated_at,
    p_idempotency_key: input.idempotency_key,
    p_diagnosis_result: input.diagnosis_result,
    p_fault_prices: faultPrices,
    p_price_exception_kind: input.price_exception?.kind ?? null,
    p_price_exception_reason: input.price_exception?.reason ?? null,
  });
  if (isMissingRpc(error, rpcName)) {
    throw new Error("报价发布数据库迁移尚未应用，请联系店主");
  }
  fail(error, "发布报价失败");
  const result = readResult(data, "发布报价失败");
  if (result.ok !== true) throw quoteFailure(requiredString(result.code), result);

  const code = requiredString(result.code);
  return {
    ok: true,
    code:
      code === "idempotent_replay"
        ? "idempotent_replay"
        : code === "already_published"
          ? "already_published"
          : "published",
    quote_event_id: requiredResultString(result, "quote_event_id", "发布报价失败"),
    updated_at: requiredResultString(result, "updated_at", "发布报价失败"),
    quotation_amount: money(result.quotation_amount),
    deposit_amount: money(result.deposit_amount),
    paid_amount: money(result.paid_amount),
    balance_amount: money(result.balance_amount),
    is_paid: result.is_paid === true,
    payment_status: requiredString(
      result.payment_status,
    ) as PublishOrderQuoteResult["payment_status"],
    status: requiredString(result.status),
    approval_status: requiredString(
      result.approval_status,
    ) as PublishOrderQuoteResult["approval_status"],
    approval_flow_status: requiredString(
      result.approval_flow_status,
    ) as PublishOrderQuoteResult["approval_flow_status"],
    approval_reset: result.approval_reset === true,
    replayed: code === "idempotent_replay" || code === "already_published",
  };
}

export function getOrderQuotePublishRpcName() {
  return isOrderCostsEnabled()
    ? "repairdesk_publish_order_quote_v2"
    : "repairdesk_publish_order_quote";
}

export async function confirmOrderQuoteSent(
  id: string,
  input: ConfirmOrderQuoteSentInput,
  actor: AuditActor,
): Promise<ConfirmOrderQuoteSentResult> {
  const storeId = requireStoreIdFromActor(actor);
  if (!actor.id) throw quoteFailure("actor_forbidden");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("repairdesk_confirm_order_quote_sent", {
    p_store_id: storeId,
    p_order_id: id,
    p_actor_id: actor.id,
    p_quote_event_id: input.quote_event_id,
    p_expected_updated_at: input.expected_updated_at,
    p_idempotency_key: input.idempotency_key,
    p_message_body: input.message_body,
  });
  if (isMissingRpc(error, "repairdesk_confirm_order_quote_sent")) {
    throw new Error("报价通知数据库迁移尚未应用，请联系店主");
  }
  fail(error, "确认报价已发送失败");
  const result = readResult(data, "确认报价已发送失败");
  if (result.ok !== true) throw quoteFailure(requiredString(result.code), result);

  const code = requiredString(result.code);
  return {
    ok: true,
    code: code === "idempotent_replay" ? "idempotent_replay" : "confirmed",
    message_id: requiredResultString(result, "message_id", "确认报价已发送失败"),
    quote_event_id: requiredResultString(result, "quote_event_id", "确认报价已发送失败"),
    updated_at: requiredResultString(result, "updated_at", "确认报价已发送失败"),
    from: requiredString(result.from),
    to: requiredString(result.to),
    replayed: code === "idempotent_replay",
  };
}

function readResult(data: unknown, context: string) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${context}：数据库返回无效`);
  }
  return data as Record<string, unknown>;
}

function requiredResultString(result: Record<string, unknown>, field: string, context: string) {
  const value = requiredString(result[field]);
  if (!value) throw new Error(`${context}：缺少 ${field}`);
  return value;
}

function isMissingRpc(error: unknown, functionName: string) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "PGRST202" ||
    candidate.code === "42883" ||
    candidate.message?.includes(functionName) === true
  );
}

function quoteFailure(code: string, details?: Record<string, unknown>): OrderQuoteOperationError {
  const messages: Record<string, string> = {
    actor_forbidden: "当前员工没有发布或发送报价的权限",
    invalid_target: "工单目标无效",
    order_not_found: "工单不存在",
    order_voided: "该工单记录已作废，只能查看历史证据",
    invalid_state: "当前工单阶段不允许发布或发送报价",
    invalid_transition: "当前流程未配置报价或待审批流转",
    invalid_idempotency_key: "操作标识无效",
    missing_expected_version: "缺少工单版本，请刷新后重试",
    stale_version: "工单已被其他操作更新，请刷新后比较并重试",
    idempotency_conflict: "该操作标识已用于不同请求，请刷新后重试",
    invalid_diagnosis: "检测结论不能为空，且不能超过 8000 个字符",
    invalid_quote_items: "报价项目无效，请检查名称、金额、币种和行数",
    invalid_price_exception: "零元项目必须说明免费、保修或仅检测原因",
    unexpected_price_exception: "没有零元项目时不能提交价格例外",
    quote_below_received_amount: "新报价不能低于已经收取的定金和款项",
    quote_not_found: "报价版本不存在",
    quote_outdated: "该报价已不是最新版本，请刷新后重新打开通知",
    quote_changed: "报价内容已变化，请刷新后重新打开通知",
    invalid_message: "通知内容不能为空，且不能超过 8000 个字符",
  };
  const status =
    code === "actor_forbidden"
      ? 403
      : code === "order_not_found"
        ? 404
        : [
              "stale_version",
              "idempotency_conflict",
              "invalid_state",
              "invalid_transition",
              "quote_outdated",
              "quote_changed",
            ].includes(code)
          ? 409
          : 422;
  return new OrderQuoteOperationError(
    messages[code] ?? "报价操作失败",
    code.toUpperCase() || "QUOTE_OPERATION_FAILED",
    status,
    details,
  );
}
