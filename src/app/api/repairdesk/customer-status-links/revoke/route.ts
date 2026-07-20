import type { NextRequest } from "next/server";

import { revokeCustomerStatusLinksForOrder } from "@/features/customer-status/server/customer-status.service";
import {
  CustomerStatusRequestError,
  assertCustomerStatusPublicRequest,
  customerStatusJson,
  readCustomerStatusJson,
} from "@/features/customer-status/server/customer-status-http";
import { ForbiddenError, UnauthorizedError, getRequestActor } from "@/server/auth-context";

export const dynamic = "force-dynamic";

const allowedReasons = new Set(["operator_reset", "lost_print", "support_revoke"]);

export async function POST(request: NextRequest) {
  try {
    assertCustomerStatusPublicRequest(request);
    const actor = await getRequestActor();
    const body = await readCustomerStatusJson(request);
    const orderId =
      body &&
      typeof body === "object" &&
      typeof (body as { order_id?: unknown }).order_id === "string"
        ? (body as { order_id: string }).order_id
        : "";
    const requestedReason =
      body && typeof body === "object" && typeof (body as { reason?: unknown }).reason === "string"
        ? (body as { reason: string }).reason
        : "operator_reset";
    if (!orderId.trim() || !allowedReasons.has(requestedReason)) {
      throw new CustomerStatusRequestError("撤销参数无效", 400);
    }
    const result = await revokeCustomerStatusLinksForOrder(orderId, actor, requestedReason);
    return customerStatusJson(result);
  } catch (error) {
    if (error instanceof UnauthorizedError)
      return customerStatusJson({ error: { message: "登录已过期，请重新登录" } }, 401);
    if (error instanceof ForbiddenError)
      return customerStatusJson({ error: { message: "当前员工没有停用二维码的权限" } }, 403);
    if (error instanceof CustomerStatusRequestError)
      return customerStatusJson({ error: { message: error.message } }, error.status);
    return customerStatusJson({ error: { message: "暂时无法停用客户查询二维码" } }, 500);
  }
}
