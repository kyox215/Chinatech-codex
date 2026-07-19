import { describe, expect, it } from "vitest";

import type { AiOrderToolCall } from "@/features/ai-assistant/model/contracts";
import {
  createAiOrderContinuationToken,
  verifyAiOrderContinuationToken,
} from "./order-continuation";
import type { AuditActor } from "@/lib/repairdesk/types";

const secret = "test-only-continuation-secret-with-at-least-32-characters";
const now = new Date("2026-07-20T10:00:00.000Z");
const actor: AuditActor = {
  id: "actor-1",
  storeId: "store-1",
  displayName: "Owner",
  role: "owner",
};

describe("AI order continuation tokens", () => {
  it("round-trips a search plan while stripping provider evidence", () => {
    const token = createAiOrderContinuationToken({ actor, toolCall: call(), secret, now });

    expect(token).toBeTruthy();
    expect(verifyAiOrderContinuationToken({ actor, token: token!, secret, now })).toEqual({
      name: "search_orders",
      arguments: expect.objectContaining({
        device_search: "iPhone 15",
        evidence: [],
      }),
    });
  });

  it("keeps the validated query plan opaque to the browser", () => {
    const toolCall = call();
    toolCall.arguments.search = "customer-private-search-term";
    const token = createAiOrderContinuationToken({ actor, toolCall, secret, now });

    expect(token).toBeTruthy();
    expect(token).not.toContain("customer-private-search-term");
    expect(() =>
      JSON.parse(Buffer.from(token!.split(".")[0] ?? "", "base64url").toString("utf8")),
    ).toThrow();
    expect(
      verifyAiOrderContinuationToken({ actor, token: token!, secret, now }).arguments.search,
    ).toBe("customer-private-search-term");
  });

  it.each([
    ["actor", { ...actor, id: "actor-2" }, now],
    ["store", { ...actor, storeId: "store-2" }, now],
    ["expiry", actor, new Date("2026-07-20T10:10:01.000Z")],
  ])("rejects a token after %s scope changes", (_name, changedActor, changedNow) => {
    const token = createAiOrderContinuationToken({ actor, toolCall: call(), secret, now });

    expect(() =>
      verifyAiOrderContinuationToken({
        actor: changedActor,
        token: token!,
        secret,
        now: changedNow,
      }),
    ).toThrow();
  });

  it("rejects tampering", () => {
    const token = createAiOrderContinuationToken({ actor, toolCall: call(), secret, now })!;
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    expect(() => verifyAiOrderContinuationToken({ actor, token: tampered, secret, now })).toThrow();
  });

  it("does not issue a continuation without a server secret or stable scope", () => {
    expect(createAiOrderContinuationToken({ actor, toolCall: call(), secret: "", now })).toBeNull();
    expect(
      createAiOrderContinuationToken({
        actor: { displayName: "Owner" },
        toolCall: call(),
        secret,
        now,
      }),
    ).toBeNull();
  });
});

function call(): Extract<AiOrderToolCall, { name: "search_orders" }> {
  return {
    name: "search_orders",
    arguments: {
      search: null,
      device_search: "iPhone 15",
      view: "active",
      paid: "all",
      overdue: null,
      queue_group: null,
      financial_review: null,
      date_filter: null,
      service_group: null,
      completed_only: false,
      parts_status: null,
      evidence: [{ field: "device_search", quote: "苹果15" }],
      page_size: 8,
    },
  };
}
