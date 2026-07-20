import type {
  CustomerStatusIssuedLink,
  CustomerStatusPublicView,
} from "@/features/customer-status/model/customer-status";

type CustomerStatusApiError = {
  error?: { message?: string };
};

export async function issueCustomerStatusLinks(orderIds: string[]) {
  const response = await fetch("/api/repairdesk/customer-status-links/issue", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_ids: orderIds }),
  });
  const payload = (await response.json().catch(() => ({}))) as CustomerStatusApiError & {
    links?: CustomerStatusIssuedLink[];
  };
  if (!response.ok || !Array.isArray(payload.links)) {
    throw new Error(payload.error?.message || "无法准备客户查询二维码");
  }
  return payload.links;
}

export async function resolveCustomerStatus(token: string) {
  const response = await fetch("/api/public/order-status", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const payload = (await response.json().catch(() => ({}))) as CustomerStatusApiError & {
    status?: CustomerStatusPublicView;
  };
  if (!response.ok || !payload.status) {
    const error = new Error(payload.error?.message || "Impossibile caricare lo stato.");
    Object.assign(error, {
      status: response.status,
      retryAfter: response.headers.get("Retry-After"),
    });
    throw error;
  }
  return payload.status;
}

export async function resolveCustomerStatusForStaff(token: string) {
  const response = await fetch("/api/repairdesk/customer-status-links/staff-resolve", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const payload = (await response.json().catch(() => ({}))) as CustomerStatusApiError & {
    task_path?: string;
  };
  if (!response.ok || !payload.task_path) {
    const error = new Error(payload.error?.message || "Impossibile aprire l'ordine interno.");
    Object.assign(error, { status: response.status });
    throw error;
  }
  return payload.task_path;
}

export async function revokeCustomerStatusLinks(orderId: string) {
  const response = await fetch("/api/repairdesk/customer-status-links/revoke", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: orderId, reason: "operator_reset" }),
  });
  const payload = (await response.json().catch(() => ({}))) as CustomerStatusApiError & {
    revoked_count?: number;
  };
  if (!response.ok || typeof payload.revoked_count !== "number") {
    throw new Error(payload.error?.message || "无法停用已打印的客户查询二维码");
  }
  return payload.revoked_count;
}
