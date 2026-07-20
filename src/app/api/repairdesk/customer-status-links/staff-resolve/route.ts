import type { NextRequest } from "next/server";

import { CUSTOMER_STATUS_LINK_UNAVAILABLE_MESSAGE } from "@/features/customer-status/model/customer-status";
import {
  CustomerStatusDisabledError,
  CustomerStatusUnavailableError,
  resolveCustomerStatusForStaff,
} from "@/features/customer-status/server/customer-status.service";
import {
  CustomerStatusRequestError,
  assertCustomerStatusPublicRequest,
  customerStatusJson,
  readCustomerStatusJson,
} from "@/features/customer-status/server/customer-status-http";
import { UnauthorizedError, getRequestActor } from "@/server/auth-context";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertCustomerStatusPublicRequest(request);
    const actor = await getRequestActor();
    const body = await readCustomerStatusJson(request);
    const token =
      body && typeof body === "object" && typeof (body as { token?: unknown }).token === "string"
        ? (body as { token: string }).token
        : "";
    const taskPath = await resolveCustomerStatusForStaff(token, actor);
    return customerStatusJson({ task_path: taskPath });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return customerStatusJson({ error: { message: "登录已过期，请重新登录" } }, 401);
    }
    if (
      error instanceof CustomerStatusUnavailableError ||
      (error instanceof Error && error.name === "CustomerStatusUnavailableError")
    ) {
      return unavailable();
    }
    if (error instanceof CustomerStatusDisabledError) {
      return customerStatusJson({ error: { message: error.message } }, 503);
    }
    if (error instanceof CustomerStatusRequestError) {
      return customerStatusJson({ error: { message: error.message } }, error.status);
    }
    return customerStatusJson({ error: { message: "暂时无法打开内部工单" } }, 500);
  }
}

function unavailable() {
  return customerStatusJson(
    { error: { code: "LINK_UNAVAILABLE", message: CUSTOMER_STATUS_LINK_UNAVAILABLE_MESSAGE } },
    404,
  );
}
