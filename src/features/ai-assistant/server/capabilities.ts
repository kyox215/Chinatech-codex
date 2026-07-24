import type { AiAssistantCapabilities } from "@/features/ai-assistant/model/contracts";
import {
  isAiAssistantEnabled,
  isAiAssistantStoreEnabled,
  isAiDraftApplyEnabled,
  isAiOrderInlineActionsEnabled,
  isAiOrderAssistantStoreEnabled,
  isAiOrderProviderStoreEnabled,
  isAiOrderReadToolsEnabled,
  isAiVisionIntakeEnabled,
  type AiAssistantFeatureEnvironment,
} from "@/features/ai-assistant/server/feature-flags";
import type { AuditActor } from "@/lib/repairdesk/types";
import { can } from "@/server/permissions";
import { isRepairDeskE2eSystemActor } from "@/shared/lib/e2e-auth-bypass";

export function getAiAssistantCapabilities(
  actor: AuditActor,
  env: AiAssistantFeatureEnvironment = process.env as AiAssistantFeatureEnvironment,
): AiAssistantCapabilities {
  if (!isAiAssistantEnabled(env)) {
    return {
      canUseOrderAssistant: false,
      canUseOrderModel: false,
      canUseOrderInlineActions: false,
      canUseVisionIntake: false,
      canApplyInventoryDraft: false,
      reason: "feature_off",
    };
  }

  const isE2eSystemActor = isRepairDeskE2eSystemActor(actor);
  const role = actor.storeRole ?? actor.role;
  const hasScopedMembership = Boolean(actor.activeMembershipId);
  const firstReleaseRoleAllowed = isE2eSystemActor || role !== "viewer";
  const orderStoreRolloutAllowed =
    isE2eSystemActor || isAiOrderAssistantStoreEnabled(actor.storeId, env);
  const pilotStoreRolloutAllowed =
    isE2eSystemActor || isAiAssistantStoreEnabled(actor.storeId, env);
  const canReadOrders =
    isE2eSystemActor || can(actor, "order:list", { scopeSatisfied: hasScopedMembership });
  const canCreateInventory = isE2eSystemActor || can(actor, "inventory:create");
  const canUseOrderAssistant =
    orderStoreRolloutAllowed &&
    firstReleaseRoleAllowed &&
    canReadOrders &&
    isAiOrderReadToolsEnabled(env);
  const canUseOrderModel =
    canUseOrderAssistant && (isE2eSystemActor || isAiOrderProviderStoreEnabled(actor.storeId, env));
  const canUseVisionIntake =
    pilotStoreRolloutAllowed &&
    firstReleaseRoleAllowed &&
    canCreateInventory &&
    isAiVisionIntakeEnabled(env);
  const canApplyInventoryDraft = canUseVisionIntake && isAiDraftApplyEnabled(env);
  const canUseOrderInlineActions =
    canUseOrderAssistant &&
    pilotStoreRolloutAllowed &&
    isAiOrderInlineActionsEnabled(env) &&
    (isE2eSystemActor || role === "owner") &&
    (isE2eSystemActor || can(actor, "order:transition", { scopeSatisfied: hasScopedMembership }));

  return {
    canUseOrderAssistant,
    canUseOrderModel,
    canUseOrderInlineActions,
    canUseVisionIntake,
    canApplyInventoryDraft,
    ...(!canUseOrderAssistant && !canUseVisionIntake
      ? {
          reason:
            !firstReleaseRoleAllowed || (!canReadOrders && !canCreateInventory)
              ? ("permission_denied" as const)
              : ("rollout_not_enabled" as const),
        }
      : {}),
  };
}
