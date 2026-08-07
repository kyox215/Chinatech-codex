import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BUYBACK_EVIDENCE_HOSTED_REQUEST_MAX_BYTES } from "@/features/buyback/model/buyback-evidence-policy";
import { AI_INVENTORY_VISION_REQUEST_MAX_BYTES } from "@/features/ai-assistant/model/inventory-image-policy";
import { AiServiceError } from "@/features/ai-assistant/server/errors";

vi.mock("@/server/api/repairdesk-request-guard", () => ({
  assertRepairDeskPostRequestAllowed: mocks.assertRepairDeskPostRequestAllowed,
  resolveRepairDeskRequestOrigin: mocks.resolveRepairDeskRequestOrigin,
}));

const mocks = vi.hoisted(() => ({
  assertRepairDeskPostRequestAllowed: vi.fn(),
  consumeAiAssistantRequestRateLimit: vi.fn(),
  getAiAssistantCapabilities: vi.fn(),
  getRepairDeskPostActor: vi.fn(),
  handleRepairDeskPost: vi.fn(),
  resolveRepairDeskRequestOrigin: vi.fn(() => "http://localhost"),
}));

vi.mock("@/features/ai-assistant/server/capabilities", () => ({
  getAiAssistantCapabilities: mocks.getAiAssistantCapabilities,
}));

vi.mock("@/features/ai-assistant/server/request-rate-limit", () => ({
  consumeAiAssistantRequestRateLimit: mocks.consumeAiAssistantRequestRateLimit,
}));

vi.mock("@/server/api/repairdesk-router", () => ({
  getRepairDeskPostActor: mocks.getRepairDeskPostActor,
  handleRepairDeskGet: vi.fn(),
  handleRepairDeskPost: mocks.handleRepairDeskPost,
}));

import { UnauthorizedError } from "@/server/auth-context";
import {
  INVENTORY_V2_COMMAND_REQUEST_MAX_BYTES,
  MEMO_COMMAND_REQUEST_MAX_BYTES,
} from "@/server/api/repairdesk-request-limits";

import { INVENTORY_LIFECYCLE_COMMAND_MAX_BYTES, POST } from "./route";

describe("RepairDesk attachment route request envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiAssistantCapabilities.mockReturnValue({
      canUseOrderAssistant: false,
      canUseOrderInlineActions: false,
      canUseVisionIntake: true,
      canApplyInventoryDraft: false,
    });
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

  it("requires same-origin JSON and an explicit Origin for toolkit posts", async () => {
    const request = new NextRequest("http://localhost/api/repairdesk/toolkit/resources", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
      },
      body: "{}",
    });

    await POST(request, {
      params: Promise.resolve({ path: ["toolkit", "resources"] }),
    });

    expect(mocks.assertRepairDeskPostRequestAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedContentTypes: ["application/json"],
        requireOrigin: true,
      }),
    );
  });

  it("enforces the streamed toolkit JSON cap when Content-Length is absent", async () => {
    const request = new NextRequest("http://localhost/api/repairdesk/toolkit/resources/link", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
      },
      body: `{"title":"${"A".repeat(64 * 1024)}"}`,
    });
    request.headers.delete("content-length");

    const response = await POST(request, {
      params: Promise.resolve({ path: ["toolkit", "resources", "link"] }),
    });

    expect(response.status).toBe(413);
    expect(mocks.handleRepairDeskPost).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed toolkit JSON instead of dispatching an empty object", async () => {
    const request = new NextRequest("http://localhost/api/repairdesk/toolkit/resources/link", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
      },
      body: "not-json",
    });

    const response = await POST(request, {
      params: Promise.resolve({ path: ["toolkit", "resources", "link"] }),
    });

    expect(response.status).toBe(400);
    expect(mocks.handleRepairDeskPost).not.toHaveBeenCalled();
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

  it("rejects oversized Inventory V2 command envelopes with and without content-length", async () => {
    for (const testCase of [
      { path: ["inventory", "v2", "intake", "create"], withContentLength: true },
      { path: ["inventory", "v2", "sales", "complete"], withContentLength: false },
    ]) {
      const body = `{"notes":"${"A".repeat(INVENTORY_V2_COMMAND_REQUEST_MAX_BYTES)}"}`;
      const request = new NextRequest(
        `http://localhost/api/repairdesk/${testCase.path.join("/")}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        },
      );
      if (!testCase.withContentLength) request.headers.delete("content-length");

      const response = await POST(request, { params: Promise.resolve({ path: testCase.path }) });

      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toEqual({
        error: "库存 V2 请求过大，请减少备注或标识符后重试",
      });
      expect(mocks.handleRepairDeskPost).not.toHaveBeenCalled();
    }
  });

  it("rejects oversized and structurally unbounded lifecycle command JSON", async () => {
    const path = ["inventory", "lifecycle", "command"];
    const oversized = new NextRequest(
      "http://localhost/api/repairdesk/inventory/lifecycle/command",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: `{"notes":"${"A".repeat(INVENTORY_LIFECYCLE_COMMAND_MAX_BYTES)}"}`,
      },
    );
    oversized.headers.delete("content-length");
    const oversizedResponse = await POST(oversized, { params: Promise.resolve({ path }) });
    expect(oversizedResponse.status).toBe(413);

    let nested: unknown = true;
    for (let index = 0; index < 10; index += 1) nested = { nested };
    const nestedResponse = await POST(
      new NextRequest("http://localhost/api/repairdesk/inventory/lifecycle/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(nested),
      }),
      { params: Promise.resolve({ path }) },
    );
    expect(nestedResponse.status).toBe(413);
    expect(mocks.handleRepairDeskPost).not.toHaveBeenCalled();
  });

  it("rejects oversized memo envelopes with and without content-length", async () => {
    for (const withContentLength of [true, false]) {
      const body = `{"input":{"content":"${"A".repeat(MEMO_COMMAND_REQUEST_MAX_BYTES)}"}}`;
      const request = new NextRequest("http://localhost/api/repairdesk/memos/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      if (!withContentLength) request.headers.delete("content-length");

      const response = await POST(request, {
        params: Promise.resolve({ path: ["memos", "create"] }),
      });

      expect(response.status).toBe(413);
      expect(mocks.handleRepairDeskPost).not.toHaveBeenCalled();
      mocks.handleRepairDeskPost.mockClear();
    }
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

  it("rejects disabled vision and rate-limited actors before consuming the image body", async () => {
    const disabledRequest = new NextRequest("http://localhost/api/repairdesk/ai/vision/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    mocks.getAiAssistantCapabilities.mockReturnValueOnce({
      canUseOrderAssistant: false,
      canUseOrderInlineActions: false,
      canUseVisionIntake: false,
      canApplyInventoryDraft: false,
      reason: "feature_off",
    });
    const disabled = await POST(disabledRequest, {
      params: Promise.resolve({ path: ["ai", "vision", "extract"] }),
    });
    expect(disabled.status).toBe(404);
    expect(disabledRequest.bodyUsed).toBe(false);

    const limitedRequest = new NextRequest("http://localhost/api/repairdesk/ai/vision/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    mocks.consumeAiAssistantRequestRateLimit.mockImplementationOnce(() => {
      throw new AiServiceError("AI 查询请求过于频繁", "AI_RATE_LIMITED", 429, {
        retryable: true,
      });
    });
    const limited = await POST(limitedRequest, {
      params: Promise.resolve({ path: ["ai", "vision", "extract"] }),
    });
    expect(limited.status).toBe(429);
    expect(limitedRequest.bodyUsed).toBe(false);
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
    expect(mocks.consumeAiAssistantRequestRateLimit).toHaveBeenCalledOnce();
    expect(mocks.handleRepairDeskPost).not.toHaveBeenCalled();
  });

  it("enforces streamed limits for text turns and inline actions without content-length", async () => {
    for (const testCase of [
      { path: ["ai", "order", "turn"], body: `{"message":"${"A".repeat(4_200)}"}` },
      { path: ["ai", "order", "action"], body: `{"order_id":"${"A".repeat(2_100)}"}` },
    ]) {
      const request = new NextRequest(
        `http://localhost/api/repairdesk/${testCase.path.join("/")}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: testCase.body,
        },
      );
      request.headers.delete("content-length");

      const response = await POST(request, { params: Promise.resolve({ path: testCase.path }) });

      expect(response.status).toBe(413);
      expect(mocks.getRepairDeskPostActor).toHaveBeenCalledWith(testCase.path.join("/"));
      expect(mocks.handleRepairDeskPost).not.toHaveBeenCalled();
      mocks.getRepairDeskPostActor.mockClear();
    }
  });
});
