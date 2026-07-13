import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { BUYBACK_EVIDENCE_HOSTED_REQUEST_MAX_BYTES } from "@/features/buyback/model/buyback-evidence-policy";

vi.mock("@/server/api/repairdesk-request-guard", () => ({
  assertRepairDeskPostRequestAllowed: vi.fn(),
  resolveRepairDeskRequestOrigin: vi.fn(() => "http://localhost"),
}));

vi.mock("@/server/api/repairdesk-router", () => ({
  getRepairDeskPostActor: vi.fn(),
  handleRepairDeskGet: vi.fn(),
  handleRepairDeskPost: vi.fn(() => NextResponse.json({ ok: true })),
}));

import { POST } from "./route";

describe("RepairDesk attachment route request envelope", () => {
  it("rejects an attachment JSON envelope above the hosted 4.4MB guard", async () => {
    const request = new NextRequest("http://localhost/api/repairdesk/inventory/attachment/upload", {
      method: "POST",
      headers: {
        "content-length": String(BUYBACK_EVIDENCE_HOSTED_REQUEST_MAX_BYTES + 1),
        "content-type": "application/json",
      },
      body: "{}",
    });

    const response = await POST(request, {
      params: Promise.resolve({ path: ["inventory", "attachment", "upload"] }),
    });

    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({
      error: "附件请求过大，请压缩至 2.4MB 后重试",
    });
  });
});
