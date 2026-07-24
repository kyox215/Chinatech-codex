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
      canUseOrderModel: false,
      canUseOrderInlineActions: false,
      canUseVisionIntake: false,
      canApplyInventoryDraft: false,
      reason: "feature_off",
    });
  });

  it("does not expose first-release AI capabilities to viewers", () => {
    expect(getAiAssistantCapabilities(actor("viewer"), enabled)).toEqual({
      canUseOrderAssistant: false,
      canUseOrderModel: false,
      canUseOrderInlineActions: false,
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
      canUseOrderModel: true,
      canUseOrderInlineActions: false,
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
      canUseOrderModel: false,
      canUseOrderInlineActions: false,
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
      canUseOrderModel: false,
      canUseOrderInlineActions: false,
      canUseVisionIntake: false,
      canApplyInventoryDraft: false,
      reason: "rollout_not_enabled",
    });
  });

  it("opens only order text to every store while vision remains on the pilot allowlist", () => {
    expect(
      getAiAssistantCapabilities(actor("owner", { storeId: "store-2" }), {
        ...enabled,
        AI_ORDER_ASSISTANT_ALL_STORES_ENABLED: "1",
      }),
    ).toEqual({
      canUseOrderAssistant: true,
      canUseOrderModel: false,
      canUseOrderInlineActions: false,
      canUseVisionIntake: false,
      canApplyInventoryDraft: false,
    });
  });

  it("lets one store be disabled without closing order text for every tenant", () => {
    const env = {
      ...enabled,
      AI_ORDER_ASSISTANT_ALL_STORES_ENABLED: "1",
      AI_ORDER_ASSISTANT_STORE_DENYLIST: "store-2",
    };

    expect(
      getAiAssistantCapabilities(actor("owner", { storeId: "store-2" }), env).canUseOrderAssistant,
    ).toBe(false);
    expect(
      getAiAssistantCapabilities(actor("owner", { storeId: "store-3" }), env).canUseOrderAssistant,
    ).toBe(true);
  });

  it("allows the repository's system actor only under the explicit E2E bypass", () => {
    const systemActor: AuditActor = { displayName: "系统", isSystem: true };
    expect(getAiAssistantCapabilities(systemActor, enabled).canUseOrderAssistant).toBe(false);

    vi.stubEnv("REPAIRDESK_E2E_BUSINESS_DESKTOP", "1");
    expect(getAiAssistantCapabilities(systemActor, enabled).canUseOrderAssistant).toBe(true);
  });

  it("keeps inline actions behind a separate owner-only flag", () => {
    const actionEnv = { ...enabled, AI_ORDER_INLINE_ACTIONS_ENABLED: "1" };
    expect(getAiAssistantCapabilities(actor("owner"), actionEnv).canUseOrderInlineActions).toBe(
      true,
    );
    expect(getAiAssistantCapabilities(actor("manager"), actionEnv).canUseOrderInlineActions).toBe(
      false,
    );
  });

  it("does not inherit inline writes from the all-store read rollout", () => {
    expect(
      getAiAssistantCapabilities(actor("owner", { storeId: "store-2" }), {
        ...enabled,
        AI_ORDER_ASSISTANT_ALL_STORES_ENABLED: "1",
        AI_ORDER_INLINE_ACTIONS_ENABLED: "1",
      }).canUseOrderInlineActions,
    ).toBe(false);
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
