import { describe, expect, it } from "vitest";

import {
  createAiSafetyIdentifier,
  createAiSafetyIdentifierIfConfigured,
} from "./safety-identifier";

const actor = { id: "staff-secret-id", displayName: "Secret Name", storeId: "store-secret-id" };
const secret = "test-only-secret-with-at-least-32-characters";

describe("AI safety identifier", () => {
  it("is stable, bounded and does not reveal actor or store identifiers", () => {
    const value = createAiSafetyIdentifier(actor, secret);
    expect(value).toBe(createAiSafetyIdentifier(actor, secret));
    expect(value).toMatch(/^u1_[A-Za-z0-9_-]{43}$/);
    expect(value.length).toBeLessThanOrEqual(64);
    expect(value).not.toContain(actor.id);
    expect(value).not.toContain(actor.storeId);
    expect(value).not.toContain(actor.displayName);
  });

  it("returns no identifier for the fake/default-off slice without a secret", () => {
    expect(createAiSafetyIdentifierIfConfigured(actor, {})).toBeUndefined();
    expect(() => createAiSafetyIdentifier(actor, "short")).toThrow(/too short/);
  });
});
