import type {
  ApplyCostBackfillInput,
  AuditActor,
  PreviewCostBackfillInput,
  RevertCostBackfillInput,
} from "@/lib/repairdesk/types";
import { writeAuditLog } from "@/server/audit";

import { assertCostBackfillAccess } from "./cost-backfill-feature";
import {
  applyCostBackfillRepository,
  previewCostBackfillRepository,
  readCostBackfillRunsRepository,
  revertCostBackfillRepository,
} from "./cost-backfill.repository";

export async function readCostBackfillRuns(
  input: { expected_store_id: string; run_id?: string },
  actor: AuditActor,
) {
  assertCostBackfillAccess(actor, input.expected_store_id, "preview");
  return readCostBackfillRunsRepository(input, actor);
}

export async function previewCostBackfill(input: PreviewCostBackfillInput, actor: AuditActor) {
  assertCostBackfillAccess(actor, input.expected_store_id, "preview");
  const result = await previewCostBackfillRepository(input, actor);
  await audit(actor, "preview", result);
  return result;
}

export async function applyCostBackfill(input: ApplyCostBackfillInput, actor: AuditActor) {
  assertCostBackfillAccess(actor, input.expected_store_id, "apply");
  const result = await applyCostBackfillRepository(input, actor);
  await audit(actor, "apply", result);
  return result;
}

export async function revertCostBackfill(input: RevertCostBackfillInput, actor: AuditActor) {
  assertCostBackfillAccess(actor, input.expected_store_id, "apply");
  const result = await revertCostBackfillRepository(input, actor);
  await audit(actor, "revert", result);
  return result;
}

async function audit(
  actor: AuditActor,
  action: "preview" | "apply" | "revert",
  result: {
    id: string;
    fixture_hash: string;
    state: string;
    candidate_count: number;
    estimated_count: number;
    unknown_count: number;
    applied_count: number;
    conflict_count: number;
    failed_count: number;
    reverted_count: number;
    revert_conflict_count: number;
  },
) {
  await writeAuditLog({
    actor,
    action,
    entityType: "repair_cost_backfill_run",
    entityId: result.id,
    metadata: {
      fixture_hash: result.fixture_hash,
      state: result.state,
      candidate_count: result.candidate_count,
      estimated_count: result.estimated_count,
      unknown_count: result.unknown_count,
      applied_count: result.applied_count,
      conflict_count: result.conflict_count,
      failed_count: result.failed_count,
      reverted_count: result.reverted_count,
      revert_conflict_count: result.revert_conflict_count,
    },
  });
}
