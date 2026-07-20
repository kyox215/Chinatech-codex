import type { NextRequest } from "next/server";

import { CUSTOMER_STATUS_LINK_UNAVAILABLE_MESSAGE } from "@/features/customer-status/model/customer-status";
import { resolveCustomerStatusPublic } from "@/features/customer-status/server/customer-status.service";
import {
  CustomerStatusRequestError,
  assertCustomerStatusPublicRequest,
  customerStatusJson,
  getCustomerStatusClientAddress,
  readCustomerStatusJson,
} from "@/features/customer-status/server/customer-status-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertCustomerStatusPublicRequest(request);
    const body = await readCustomerStatusJson(request);
    const token =
      body && typeof body === "object" && typeof (body as { token?: unknown }).token === "string"
        ? (body as { token: string }).token
        : "";
    const status = await resolveCustomerStatusPublic(
      token,
      getCustomerStatusClientAddress(request),
    );
    if (!status) return unavailable();
    return customerStatusJson({ status });
  } catch (error) {
    if (hasErrorName(error, "CustomerStatusRateLimitError")) {
      const retryAfter = Number(
        (error as { retryAfterSeconds?: unknown }).retryAfterSeconds || 300,
      );
      return customerStatusJson(
        {
          error: {
            code: "RATE_LIMITED",
            message: error instanceof Error ? error.message : "Richieste troppo frequenti.",
          },
        },
        429,
        retryAfter,
      );
    }
    if (hasErrorName(error, "CustomerStatusUnavailableError")) {
      return unavailable();
    }
    if (hasErrorName(error, "CustomerStatusDisabledError")) {
      return customerStatusJson(
        {
          error: { code: "SERVICE_UNAVAILABLE", message: CUSTOMER_STATUS_LINK_UNAVAILABLE_MESSAGE },
        },
        503,
      );
    }
    if (error instanceof CustomerStatusRequestError) {
      return customerStatusJson(
        { error: { code: "INVALID_REQUEST", message: error.message } },
        error.status,
      );
    }
    return customerStatusJson(
      { error: { code: "SERVICE_ERROR", message: "Servizio temporaneamente non disponibile." } },
      500,
    );
  }
}

function hasErrorName(error: unknown, name: string) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "name" in error &&
    (error as { name?: unknown }).name === name,
  );
}

function unavailable() {
  return customerStatusJson(
    { error: { code: "LINK_UNAVAILABLE", message: CUSTOMER_STATUS_LINK_UNAVAILABLE_MESSAGE } },
    404,
  );
}
