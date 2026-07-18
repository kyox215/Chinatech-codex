import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BUYBACK_EVIDENCE_HOSTED_REQUEST_MAX_BYTES } from "@/features/buyback/model/buyback-evidence-policy";
import { AI_INVENTORY_VISION_REQUEST_MAX_BYTES } from "@/features/ai-assistant/model/inventory-image-policy";

vi.mock("@/server/api/repairdesk-request-guard", () => ({
  assertRepairDeskPostRequestAllowed: vi.fn(),
  resolveRepairDeskRequestOrigin: vi.fn(() => "http://localhost"),
}));

const mocks = vi.hoisted(() => ({
  getRepairDeskPostActor: vi.fn(),
  handleRepairDeskPost: vi.fn(),
}));

vi.mock("@/server/api/repairdesk-router", () => ({
  getRepairDeskPostActor: mocks.getRepairDeskPostActor,
  handleRepairDeskGet: vi.fn(),
  handleRepairDeskPost: mocks.handleRepairDeskPost,
}));

import { UnauthorizedError } from "@/server/auth-context";
import { POST } from "./route";

describe("RepairDesk attachment route request envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRepairDeskPostActor.mockResolvedValue({
      id: "staff-1",
      displayName: "Staff",
      storeId: "store-1",
    });
    mocks.handleRepairDeskPost.mockReturnValue(NextResponse.json({ ok: true }));
  });

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

  it("rejects an oversized AI text envelope before authentication or parsing", async () => {
    const request = new NextRequest("http://localhost/api/repairdesk/ai/order/turn", {
      method: "POST",
      headers: {
        "content-length": "4097",
        "content-type": "application/json",
      },
      body: "{}",
    });

    const response = await POST(request, {
      params: Promise.resolve({ path: ["ai", "order", "turn"] }),
    });

    expect(response.status).toBe(413);
    expect(mocks.getRepairDeskPostActor).not.toHaveBeenCalled();
    expect(mocks.handleRepairDeskPost).not.toHaveBeenCalled();
  });

  it("authenticates an AI turn before reading or dispatching its JSON body", async () => {
    mocks.getRepairDeskPostActor.mockRejectedValueOnce(new UnauthorizedError());
    const request = new NextRequest("http://localhost/api/repairdesk/ai/order/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });

    const response = await POST(request, {
      params: Promise.resolve({ path: ["ai", "order", "turn"] }),
    });

    expect(response.status).toBe(401);
    expect(mocks.getRepairDeskPostActor).toHaveBeenCalledWith("ai/order/turn");
    expect(mocks.handleRepairDeskPost).not.toHaveBeenCalled();
  });

  it("rejects an oversized AI vision envelope before authentication or parsing", async () => {
    const request = new NextRequest("http://localhost/api/repairdesk/ai/vision/extract", {
      method: "POST",
      headers: {
        "content-length": String(AI_INVENTORY_VISION_REQUEST_MAX_BYTES + 1),
        "content-type": "application/json",
      },
      body: "{}",
    });

    const response = await POST(request, {
      params: Promise.resolve({ path: ["ai", "vision", "extract"] }),
    });

    expect(response.status).toBe(413);
    expect(mocks.getRepairDeskPostActor).not.toHaveBeenCalled();
    expect(mocks.handleRepairDeskPost).not.toHaveBeenCalled();
  });

  it("authenticates AI vision before reading an invalid JSON body", async () => {
    mocks.getRepairDeskPostActor.mockRejectedValueOnce(new UnauthorizedError());
    const request = new NextRequest("http://localhost/api/repairdesk/ai/vision/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });

    const response = await POST(request, {
      params: Promise.resolve({ path: ["ai", "vision", "extract"] }),
    });

    expect(response.status).toBe(401);
    expect(mocks.getRepairDeskPostActor).toHaveBeenCalledWith("ai/vision/extract");
    expect(mocks.handleRepairDeskPost).not.toHaveBeenCalled();
  });

  it("enforces the streamed AI vision cap after authentication when content-length is absent", async () => {
    const request = new NextRequest("http://localhost/api/repairdesk/ai/vision/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: `{"image":"${"A".repeat(AI_INVENTORY_VISION_REQUEST_MAX_BYTES)}"}`,
    });
    request.headers.delete("content-length");

    const response = await POST(request, {
      params: Promise.resolve({ path: ["ai", "vision", "extract"] }),
    });

    expect(response.status).toBe(413);
    expect(mocks.getRepairDeskPostActor).toHaveBeenCalledWith("ai/vision/extract");
    expect(mocks.handleRepairDeskPost).not.toHaveBeenCalled();
  });
});
