import type { NextRequest } from "next/server";

import {
  CustomerStatusDisabledError,
  issueCustomerStatusLinks,
} from "@/features/customer-status/server/customer-status.service";
import {
  CustomerStatusRequestError,
  assertCustomerStatusPublicRequest,
  customerStatusJson,
  readCustomerStatusJson,
} from "@/features/customer-status/server/customer-status-http";
import { ForbiddenError, UnauthorizedError, getRequestActor } from "@/server/auth-context";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertCustomerStatusPublicRequest(request);
    const actor = await getRequestActor();
    const body = await readCustomerStatusJson(request, 4096);
    const orderIds =
      body && typeof body === "object" && Array.isArray((body as { order_ids?: unknown }).order_ids)
        ? (body as { order_ids: unknown[] }).order_ids.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
    const links = await issueCustomerStatusLinks(orderIds, actor);
    return customerStatusJson({ links });
  } catch (error) {
    if (error instanceof UnauthorizedError) return privateError("登录已过期，请重新登录", 401);
    if (error instanceof ForbiddenError) return privateError(error.message, 403);
    if (error instanceof CustomerStatusDisabledError) return privateError(error.message, 503);
    if (error instanceof CustomerStatusRequestError)
      return privateError(error.message, error.status);
    return privateError("暂时无法准备客户查询二维码", 500);
  }
}

function privateError(message: string, status: number) {
  return customerStatusJson({ error: { message } }, status);
}
