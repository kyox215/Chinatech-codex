import { z } from "zod";
import type { AuditActor } from "@/lib/repairdesk/types";
import { assertPermission, resolvePermissionRole } from "@/server/permissions";
import { requireStoreIdFromActor } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";
import {
  inventorySalesWorkflowCommandBodySchema,
  inventorySalesWorkflowCommandResultSchema,
  inventorySalesWorkflowReadBodySchema,
  inventorySalesWorkflowReadResultSchema,
  inventorySalesWorkflowReportBodySchema,
  inventorySalesWorkflowReportResultSchema,
  type InventorySalesWorkflowCommandBody,
  type InventorySalesWorkflowReadInput,
  type InventorySalesWorkflowReportInput,
} from "../model/workflow-contracts";
import {
  assertInventorySalesEnabled,
  InventorySalesError,
  isInventorySalesEnabled,
} from "./sales-access";

export function assertInventorySalesWorkflowAccess(
  actor: AuditActor,
  command?: InventorySalesWorkflowCommandBody,
) {
  assertInventorySalesEnabled(actor, command ? "command" : "read");
  assertPermission(actor, "inventory:read");
  assertPermission(actor, "inventory:sale");
  const role = resolvePermissionRole(actor);
  if (
    !role ||
    !["owner", "manager", "sales"].includes(role) ||
    (command?.command === "fiscal.verify" && !["owner", "manager"].includes(role))
  ) {
    throw new InventorySalesError("actor_forbidden", "当前员工没有执行此售卖流程操作的权限", 403);
  }
}
const messages: Record<string, string> = {
  actor_forbidden: "当前员工没有执行此售卖流程操作的权限",
  stale_version: "销售跟进资料已变化，请刷新后重试",
  stale_fiscal_revision: "财政凭证已更正，请核对最新凭证后重试",
  idempotency_conflict: "本次操作标识已用于其他内容",
  not_found: "销售单不存在或不属于当前门店",
  invalid_assignee: "跟进负责人必须是当前门店的活跃销售或管理人员",
  correction_reason_required: "更正已登记财政凭证时必须填写原因",
  fiscal_required: "请先登记外部财政凭证",
  issue_not_open: "该异常不存在或已经解决",
};
async function rpc<T>(
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
  dataEnvelope = true,
): Promise<T> {
  const { data, error } = await getSupabaseAdmin().rpc(name, args);
  if (error || !data || typeof data !== "object" || Array.isArray(data))
    throw new InventorySalesError("unavailable", "售卖跟进服务暂不可用，请保留操作标识后重试", 503);
  if (data.ok !== true) {
    const code = typeof data.code === "string" ? data.code : "unavailable";
    const status =
      code === "actor_forbidden"
        ? 403
        : code === "not_found"
          ? 404
          : [
                "stale_version",
                "stale_fiscal_revision",
                "idempotency_conflict",
                "issue_not_open",
              ].includes(code)
            ? 409
            : code === "unavailable"
              ? 503
              : 400;
    throw new InventorySalesError(
      code,
      messages[code] ?? "售卖跟进操作未完成，请核对资料后重试",
      status,
    );
  }
  const result = schema.safeParse(dataEnvelope ? data.data : data);
  if (!result.success)
    throw new InventorySalesError("unavailable", "售卖跟进资料不完整，请刷新后重试", 503);
  return result.data;
}
export async function runInventorySalesWorkflowCommand(
  input: InventorySalesWorkflowCommandBody,
  actor: AuditActor,
) {
  const parsed = inventorySalesWorkflowCommandBodySchema.parse(input);
  assertInventorySalesWorkflowAccess(actor, parsed);
  return rpc(
    "repairdesk_inventory_sales_workflow_command",
    {
      p_store_id: requireStoreIdFromActor(actor),
      p_actor_id: actor.id,
      p_sale_order_id: parsed.sale_order_id,
      p_expected_workflow_version: parsed.expected_workflow_version,
      p_idempotency_key: parsed.idempotency_key,
      p_command: parsed.command,
      p_payload: parsed.payload,
    },
    inventorySalesWorkflowCommandResultSchema,
    false,
  );
}
export async function readInventorySalesWorkflow(
  input: InventorySalesWorkflowReadInput,
  actor: AuditActor,
) {
  const parsed = inventorySalesWorkflowReadBodySchema.parse(input);
  assertInventorySalesWorkflowAccess(actor);
  const result = await rpc(
    "repairdesk_inventory_sales_workflow_read",
    {
      p_store_id: requireStoreIdFromActor(actor),
      p_actor_id: actor.id,
      p_sale_order_id: parsed.sale_order_id,
    },
    inventorySalesWorkflowReadResultSchema,
  );
  result.capabilities.can_edit =
    result.capabilities.can_edit && isInventorySalesEnabled(actor.storeId, "command");
  result.capabilities.can_verify =
    result.capabilities.can_verify && isInventorySalesEnabled(actor.storeId, "command");
  return result;
}
export async function readInventorySalesWorkflowReport(
  input: InventorySalesWorkflowReportInput,
  actor: AuditActor,
) {
  const parsed = inventorySalesWorkflowReportBodySchema.parse(input);
  assertInventorySalesWorkflowAccess(actor);
  return rpc(
    "repairdesk_inventory_sales_workflow_report",
    {
      p_store_id: requireStoreIdFromActor(actor),
      p_actor_id: actor.id,
      p_business_date: parsed.business_date,
      p_offset: parsed.offset,
      p_limit: parsed.limit,
    },
    inventorySalesWorkflowReportResultSchema,
  );
}
