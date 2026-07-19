import { describe, expect, it } from "vitest";

import { createAiActorRateFingerprint, createAiRequestFingerprint } from "./request-fingerprint";
import type { AuditActor } from "@/lib/repairdesk/types";

const secret = "test-only-fingerprint-secret-with-at-least-32-characters";
const actor = {
  id: "00000000-0000-4000-8000-000000000001",
  storeId: "00000000-0000-4000-8000-000000000002",
} as AuditActor;

function requestFingerprint(
  overrides: Partial<Parameters<typeof createAiRequestFingerprint>[0]> = {},
) {
  return createAiRequestFingerprint({
    actor,
    clientRequestId: "00000000-0000-4000-8000-000000000003",
    requestKind: "order_text",
    model: "gpt-5-nano-2025-08-07",
    locale: "en",
    content: "Show active unpaid repairs",
    secret,
    ...overrides,
  });
}

describe("AI request fingerprints", () => {
  it("is deterministic, normalized and opaque", () => {
    const first = requestFingerprint({ content: "Ｒｅｐａｉｒｓ" });
    const second = requestFingerprint({ content: "Repairs" });
    expect(first).toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toContain("Repairs");
    expect(first).not.toContain(secret);
  });

  it("binds store, actor, client request, kind, model, locale and content", () => {
    const baseline = requestFingerprint();
    expect(
      requestFingerprint({ clientRequestId: "00000000-0000-4000-8000-000000000004" }),
    ).not.toBe(baseline);
    expect(requestFingerprint({ requestKind: "inventory_vision" })).not.toBe(baseline);
    expect(requestFingerprint({ model: "gpt-4o-mini-2024-07-18" })).not.toBe(baseline);
    expect(requestFingerprint({ locale: "it-IT" })).not.toBe(baseline);
    expect(requestFingerprint({ content: "Show completed repairs" })).not.toBe(baseline);
    expect(
      requestFingerprint({ actor: { ...actor, id: "00000000-0000-4000-8000-000000000005" } }),
    ).not.toBe(baseline);
  });

  it("uses a separate namespace for rate-limit identities and rejects weak identity material", () => {
    const actorFingerprint = createAiActorRateFingerprint(actor, secret);
    expect(actorFingerprint).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(actorFingerprint).not.toBe(requestFingerprint());
    expect(() => requestFingerprint({ secret: "short" })).toThrow(/too short/);
    expect(() => requestFingerprint({ actor: { ...actor, id: "" } })).toThrow(/required/);
  });
});
