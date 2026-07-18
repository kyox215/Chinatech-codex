import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuditActor, StoreRole } from "@/lib/repairdesk/types";
import { getAiAssistantCapabilities } from "./capabilities";
import type { AiAssistantFeatureEnvironment } from "./feature-flags";

const enabled: AiAssistantFeatureEnvironment = {
  AI_ASSISTANT_ENABLED: "1",
  AI_ORDER_READ_TOOLS_ENABLED: "1",
  AI_VISION_INTAKE_ENABLED: "1",
  AI_DRAFT_APPLY_ENABLED: "1",
  AI_ASSISTANT_STORE_ALLOWLIST: "store-1",
};

describe("AI assistant capability projection", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails closed when the parent feature flag is absent", () => {
    expect(getAiAssistantCapabilities(actor("owner"), {})).toEqual({
      canUseOrderAssistant: false,
      canUseVisionIntake: false,
      canApplyInventoryDraft: false,
      reason: "feature_off",
    });
  });

  it("does not expose first-release AI capabilities to viewers", () => {
    expect(getAiAssistantCapabilities(actor("viewer"), enabled)).toEqual({
      canUseOrderAssistant: false,
      canUseVisionIntake: false,
      canApplyInventoryDraft: false,
      reason: "permission_denied",
    });
  });

  it("requires an active membership before a technician can use scoped order read", () => {
    expect(
      getAiAssistantCapabilities(actor("technician", { activeMembershipId: undefined }), enabled)
        .canUseOrderAssistant,
    ).toBe(false);
    expect(
      getAiAssistantCapabilities(
        actor("technician", { activeMembershipId: "membership-tech" }),
        enabled,
      ).canUseOrderAssistant,
    ).toBe(true);
  });

  it("projects enabled owner capabilities without granting anything beyond RBAC", () => {
    expect(getAiAssistantCapabilities(actor("owner"), enabled)).toEqual({
      canUseOrderAssistant: true,
      canUseVisionIntake: true,
      canApplyInventoryDraft: true,
    });
  });

  it("reports rollout gating when RBAC allows access but child flags are off", () => {
    expect(
      getAiAssistantCapabilities(actor("owner"), {
        AI_ASSISTANT_ENABLED: "1",
        AI_ASSISTANT_STORE_ALLOWLIST: "store-1",
      }),
    ).toEqual({
      canUseOrderAssistant: false,
      canUseVisionIntake: false,
      canApplyInventoryDraft: false,
      reason: "rollout_not_enabled",
    });
  });

  it("does not roll out enabled AI flags to a store outside the allowlist", () => {
    expect(
      getAiAssistantCapabilities(actor("owner"), {
        ...enabled,
        AI_ASSISTANT_STORE_ALLOWLIST: "store-2",
      }),
    ).toEqual({
      canUseOrderAssistant: false,
      canUseVisionIntake: false,
      canApplyInventoryDraft: false,
      reason: "rollout_not_enabled",
    });
  });

  it("allows the repository's system actor only under the explicit E2E bypass", () => {
    const systemActor: AuditActor = { displayName: "系统", isSystem: true };
    expect(getAiAssistantCapabilities(systemActor, enabled).canUseOrderAssistant).toBe(false);

    vi.stubEnv("REPAIRDESK_E2E_BUSINESS_DESKTOP", "1");
    expect(getAiAssistantCapabilities(systemActor, enabled).canUseOrderAssistant).toBe(true);
  });

  it("never grants the E2E system actor in production", () => {
    vi.stubEnv("REPAIRDESK_E2E_BUSINESS_DESKTOP", "1");
    vi.stubEnv("NODE_ENV", "production");

    expect(
      getAiAssistantCapabilities({ displayName: "系统", isSystem: true }, enabled)
        .canUseOrderAssistant,
    ).toBe(false);
  });
});

function actor(role: StoreRole, overrides: Partial<AuditActor> = {}): AuditActor {
  return {
    id: `staff-${role}`,
    displayName: role,
    role,
    storeRole: role,
    storeId: "store-1",
    activeMembershipId: `membership-${role}`,
    ...overrides,
  };
}
