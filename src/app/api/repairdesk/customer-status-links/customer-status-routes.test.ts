import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getRequestActor = vi.hoisted(() => vi.fn());
const issueLinks = vi.hoisted(() => vi.fn());
const resolveStaff = vi.hoisted(() => vi.fn());
const revokeLinks = vi.hoisted(() => vi.fn());

vi.mock("@/server/auth-context", async () => {
  const actual =
    await vi.importActual<typeof import("@/server/auth-context")>("@/server/auth-context");
  return { ...actual, getRequestActor };
});

vi.mock("@/features/customer-status/server/customer-status.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/customer-status/server/customer-status.service")
  >("@/features/customer-status/server/customer-status.service");
  return {
    ...actual,
    issueCustomerStatusLinks: issueLinks,
    resolveCustomerStatusForStaff: resolveStaff,
    revokeCustomerStatusLinksForOrder: revokeLinks,
  };
});

import { UnauthorizedError } from "@/server/auth-context";
import { POST as issue } from "./issue/route";
import { POST as revoke } from "./revoke/route";
import { POST as staffResolve } from "./staff-resolve/route";

describe("customer status authenticated routes", () => {
  beforeEach(() => {
    getRequestActor.mockReset();
    issueLinks.mockReset();
    resolveStaff.mockReset();
    revokeLinks.mockReset();
    getRequestActor.mockResolvedValue({
      id: "actor-1",
      displayName: "Owner",
      storeId: "store-1",
      storeRole: "owner",
    });
  });

  it("issues an atomic order-id keyed batch without logging the token into the URL", async () => {
    issueLinks.mockResolvedValue([
      {
        order_id: "order-1",
        url: `https://www.chinatech.in/r#${"A".repeat(43)}`,
        expires_at: "future",
      },
      {
        order_id: "order-2",
        url: `https://www.chinatech.in/r#${"B".repeat(43)}`,
        expires_at: "future",
      },
    ]);
    const request = jsonRequest("/api/repairdesk/customer-status-links/issue", {
      order_ids: ["order-1", "order-2"],
    });
    const response = await issue(request);

    expect(response.status).toBe(200);
    expect(request.url).not.toContain("A".repeat(43));
    expect(issueLinks).toHaveBeenCalledWith(
      ["order-1", "order-2"],
      expect.objectContaining({ storeId: "store-1" }),
    );
  });

  it("requires authentication before staff token resolution", async () => {
    getRequestActor.mockRejectedValue(new UnauthorizedError());
    const response = await staffResolve(
      jsonRequest("/api/repairdesk/customer-status-links/staff-resolve", {
        token: "A".repeat(43),
      }),
    );

    expect(response.status).toBe(401);
    expect(resolveStaff).not.toHaveBeenCalled();
  });

  it("returns only a relative task path after staff resolution", async () => {
    resolveStaff.mockResolvedValue("/orders/order-1/task");
    const response = await staffResolve(
      jsonRequest("/api/repairdesk/customer-status-links/staff-resolve", {
        token: "A".repeat(43),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ task_path: "/orders/order-1/task" });
  });

  it("revokes an order's active links through the protected fixed-reason contract", async () => {
    revokeLinks.mockResolvedValue({ revoked_count: 2 });
    const response = await revoke(
      jsonRequest("/api/repairdesk/customer-status-links/revoke", {
        order_id: "order-1",
        reason: "operator_reset",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ revoked_count: 2 });
    expect(revokeLinks).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({ storeId: "store-1" }),
      "operator_reset",
    );
  });
});

function jsonRequest(path: string, body: unknown) {
  return new NextRequest(`https://www.chinatech.in${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://www.chinatech.in" },
    body: JSON.stringify(body),
  });
}
