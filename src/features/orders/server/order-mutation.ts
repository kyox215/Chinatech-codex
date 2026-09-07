import { createHash } from "node:crypto";

import type { PatchOrderResult } from "@/lib/repairdesk/types";
import type { getSupabaseAdmin } from "@/server/supabase";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function orderMutationIdentity<
  Request extends { expected_updated_at: string; idempotency_key?: string },
>(input: { storeId: string; actorId: string; orderId: string; mode: string; request: Request }) {
  const { idempotency_key: key, ...request } = input.request;
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify(
        canonicalize({
          storeId: input.storeId,
          actorId: input.actorId,
          orderId: input.orderId,
          mode: input.mode,
          request,
        }),
      ),
    )
    .digest("hex");
  // Same actor, target, version and payload keep the same intent across network retries.
  const operationId =
    key ??
    `${requestHash.slice(0, 8)}-${requestHash.slice(8, 12)}-4${requestHash.slice(13, 16)}-8${requestHash.slice(17, 20)}-${requestHash.slice(20, 32)}`;
  return { requestHash, operationId };
}

export class OrderMutationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "OrderMutationError";
  }
}

const failureMessages: Record<string, string> = {
  actor_forbidden: "当前员工没有执行该编辑的权限",
  order_not_found: "工单不存在或不属于当前店铺",
  customer_not_found: "工单客户不存在或不属于当前店铺",
  stale_version: "工单已被更新，请刷新后再试",
  order_terminal: "已结束工单必须使用审计化纠正或重新打开操作",
  order_voided: "该工单记录已作废，只能查看历史证据",
  quote_below_received_amount: "报价不能低于已收金额，请先通过收款纠正流程处理",
  deposit_correction_required:
    "已有收款或审批记录，不能通过编辑修改初始订金，请使用初始订金纠正流程",
  idempotency_conflict: "本次保存标识已用于不同内容，请重新载入工单后保存",
  customer_phone_conflict: "该手机号已存在客户档案，请先确认客户资料",
  custody_required: "请先确认设备由门店保管",
  invalid_assignee: "负责人不存在或不属于当前店铺",
  invalid_supplier: "配件供应商不存在或不属于当前店铺",
};

export async function mutateOrderAtomic(args: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  storeId: string;
  actorId: string;
  orderId: string;
  mode: "update" | "patch" | "finance";
  request: { expected_updated_at: string; idempotency_key?: string };
  orderChanges: Record<string, unknown>;
  customerChanges?: Record<string, unknown>;
}): Promise<PatchOrderResult> {
  const identity = orderMutationIdentity(args);
  const { data, error } = await args.supabase.rpc("repairdesk_mutate_order_v3", {
    p_store_id: args.storeId,
    p_actor_id: args.actorId,
    p_order_id: args.orderId,
    p_expected_updated_at: args.request.expected_updated_at,
    p_operation_id: identity.operationId,
    p_request_hash: identity.requestHash,
    p_mode: args.mode,
    p_order_changes: args.orderChanges,
    p_customer_changes: args.customerChanges ?? {},
  });
  if (error) {
    const missing = ["PGRST202", "42883"].includes(error.code ?? "");
    throw new OrderMutationError(
      missing
        ? "工单原子编辑迁移尚未应用，已阻止旧流程继续写入"
        : "工单保存事务失败，请用相同内容重试",
      missing ? "ORDER_MUTATION_MIGRATION_REQUIRED" : "ORDER_MUTATION_TRANSACTION_FAILED",
      503,
    );
  }
  const result = data as Record<string, unknown> | null;
  if (result?.ok === true && typeof result.updated_at === "string") {
    return { ok: true, updated_at: result.updated_at };
  }
  const code = typeof result?.code === "string" ? result.code : "invalid_result";
  throw new OrderMutationError(
    failureMessages[code] ?? "工单保存未完成，请检查输入并重新载入工单",
    code,
    code === "actor_forbidden" ? 403 : code.endsWith("not_found") ? 404 : 409,
  );
}
