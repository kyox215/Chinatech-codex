import type {
  InventoryLifecycleCommand,
  InventoryLifecycleProjection,
  InventoryLifecycleProjectionMode,
  InventoryLifecycleProjectionStatus,
} from "@/lib/repairdesk/types";

export type InventoryNoActionGuidanceState =
  | "projection-unavailable"
  | "facts-need-review"
  | "terminal-complete"
  | "server-readonly"
  | "target-unavailable"
  | "loading";

export type InventoryNoActionGuidance = {
  state: InventoryNoActionGuidanceState;
  targetCommand?: InventoryLifecycleCommand;
};

export type InventoryNoActionGuidanceInput = {
  lifecycleState?: "loading" | "ready" | "unavailable" | "dormant";
  hasData: boolean;
  projectionMode?: InventoryLifecycleProjectionMode;
  projection?: Pick<InventoryLifecycleProjection, "mode" | "status" | "needs_review">;
  status?: string | null;
  allowedActions: readonly InventoryLifecycleCommand[];
  targetCommand?: InventoryLifecycleCommand;
  /**
   * A server action can be present while its transition target facts are not
   * readable yet. Keep that distinction explicit instead of rewriting the
   * server action list or guessing a permission outcome.
   */
  transitionTargetsAvailable?: boolean;
};

const terminalStatuses = new Set([
  "cancelled",
  "closed",
  "complete",
  "completed",
  "delivered",
  "removed",
]);

const terminalProjectionStatuses = new Set<InventoryLifecycleProjectionStatus>([
  "delivered",
  "removed",
]);

/**
 * Explains why a readable lifecycle record has no caller-selected next write.
 * It never infers roles or hidden permissions and never supplies a mutation.
 */
export function resolveInventoryNoActionGuidance({
  lifecycleState = "ready",
  hasData,
  projectionMode,
  projection,
  status,
  allowedActions,
  targetCommand,
  transitionTargetsAvailable = true,
}: InventoryNoActionGuidanceInput): InventoryNoActionGuidance | null {
  if (!hasData) return null;
  if (lifecycleState === "loading") return { state: "loading" };

  const actions = new Set(allowedActions);
  if (actions.size > 0 && targetCommand && !actions.has(targetCommand)) {
    return { state: "target-unavailable", targetCommand };
  }
  if (
    actions.size > 0 &&
    targetCommand &&
    actions.has(targetCommand) &&
    !transitionTargetsAvailable
  ) {
    return { state: "facts-need-review", targetCommand };
  }
  if (projectionMode === "unavailable" || projection?.mode === "unavailable") {
    return actions.size === 0 ? { state: "projection-unavailable" } : null;
  }
  if (projection?.needs_review) {
    return actions.size === 0 ? { state: "facts-need-review" } : null;
  }
  if (actions.size > 0) return null;
  if (
    (status && terminalStatuses.has(status)) ||
    (projection?.status && terminalProjectionStatuses.has(projection.status))
  ) {
    return { state: "terminal-complete" };
  }
  return { state: "server-readonly" };
}
