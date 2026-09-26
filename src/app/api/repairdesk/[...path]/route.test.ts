import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BUYBACK_EVIDENCE_HOSTED_REQUEST_MAX_BYTES } from "@/features/buyback/model/buyback-evidence-policy";

vi.mock("@/server/api/repairdesk-request-guard", () => ({
  assertRepairDeskPostRequestAllowed: mocks.assertRepairDeskPostRequestAllowed,
  resolveRepairDeskRequestOrigin: mocks.resolveRepairDeskRequestOrigin,
}));

const mocks = vi.hoisted(() => ({
  assertRepairDeskPostRequestAllowed: vi.fn(),
  getRepairDeskPostActor: vi.fn(),
  handleRepairDeskGet: vi.fn(),
  handleRepairDeskPost: vi.fn(),
  resolveRepairDeskRequestOrigin: vi.fn(() => "http://localhost"),
}));

vi.mock("@/server/api/repairdesk-router", () => ({
  getRepairDeskPostActor: mocks.getRepairDeskPostActor,
  handleRepairDeskGet: mocks.handleRepairDeskGet,
  handleRepairDeskPost: mocks.handleRepairDeskPost,
}));

import {
  INVENTORY_LIFECYCLE_COMMAND_MAX_BYTES,
  INVENTORY_V2_COMMAND_REQUEST_MAX_BYTES,
  MEMO_COMMAND_REQUEST_MAX_BYTES,
  MEMO_EDITOR_REQUEST_MAX_BYTES,
} from "@/server/api/repairdesk-request-limits";

import { GET, POST } from "./route";

describe("RepairDesk attachment route request envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_REPAIRDESK_TOOLKIT_ENABLED", "1");
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

  it("keeps toolkit GET and POST routes closed until explicitly enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_REPAIRDESK_TOOLKIT_ENABLED", "0");

    const getResponse = await GET(
      new NextRequest("http://localhost/api/repairdesk/toolkit/resources"),
      { params: Promise.resolve({ path: ["toolkit", "resources"] }) },
    );
    const postResponse = await POST(
      new NextRequest("http://localhost/api/repairdesk/toolkit/resources/link", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: "{}",
      }),
      { params: Promise.resolve({ path: ["toolkit", "resources", "link"] }) },
    );

    expect(getResponse.status).toBe(404);
    expect(postResponse.status).toBe(404);
    expect(mocks.handleRepairDeskGet).not.toHaveBeenCalled();
    expect(mocks.handleRepairDeskPost).not.toHaveBeenCalled();
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
      const body = `{"input":{"content":"${"A".repeat(MEMO_EDITOR_REQUEST_MAX_BYTES)}"}}`;
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

    const maxChecklistBody = JSON.stringify({
      input: {
        checklist: Array.from({ length: 100 }, (_, index) => ({
          id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          text: "交".repeat(200),
          completed: false,
        })),
      },
    });
    const maxChecklistRequest = new NextRequest("http://localhost/api/repairdesk/memos/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: maxChecklistBody,
    });
    const maxChecklistResponse = await POST(maxChecklistRequest, {
      params: Promise.resolve({ path: ["memos", "update"] }),
    });
    expect(new TextEncoder().encode(maxChecklistBody).byteLength).toBeLessThan(
      MEMO_EDITOR_REQUEST_MAX_BYTES,
    );
    expect(maxChecklistResponse.status).toBe(200);
    mocks.handleRepairDeskPost.mockClear();

    const smallCommand = new NextRequest("http://localhost/api/repairdesk/memos/checklist-item", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ padding: "A".repeat(MEMO_COMMAND_REQUEST_MAX_BYTES) }),
    });
    const smallCommandResponse = await POST(smallCommand, {
      params: Promise.resolve({ path: ["memos", "checklist-item"] }),
    });
    expect(smallCommandResponse.status).toBe(413);
  });

  it("returns 404 for retired assistant endpoints before body parsing or actor dispatch", async () => {
    for (const testCase of [
      { path: ["ai", "vision", "extract"], body: "{}" },
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

      expect(response.status).toBe(404);
      expect(request.bodyUsed).toBe(false);
      expect(mocks.getRepairDeskPostActor).not.toHaveBeenCalled();
      expect(mocks.handleRepairDeskPost).not.toHaveBeenCalled();
      mocks.getRepairDeskPostActor.mockClear();
    }
  });
  it("returns 404 for retired capability and usage reads without dispatch", async () => {
    for (const key of ["capabilities", "usage"]) {
      const request = new NextRequest(`http://localhost/api/repairdesk/ai/${key}`);
      const response = await GET(request, { params: Promise.resolve({ path: ["ai", key] }) });
      expect(response.status).toBe(404);
      expect(request.bodyUsed).toBe(false);
      expect(mocks.handleRepairDeskGet).not.toHaveBeenCalled();
    }
  });
});
