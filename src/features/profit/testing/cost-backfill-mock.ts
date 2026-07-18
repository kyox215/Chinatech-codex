import type {
  ApplyCostBackfillInput,
  CostBackfillRun,
  CostBackfillRunsResult,
  PreviewCostBackfillInput,
  RevertCostBackfillInput,
} from "@/lib/repairdesk/types";

const runsByStore = new Map<string, CostBackfillRun[]>();

export async function readMockCostBackfillRuns(input: {
  expected_store_id: string;
  run_id?: string;
}): Promise<CostBackfillRunsResult> {
  const runs = runsByStore.get(input.expected_store_id) ?? [];
  return {
    runs: runs.map(
      ({ candidates: _candidates, store_id: _storeId, max_candidates: _max, ...run }) => run,
    ),
    selected: input.run_id ? runs.find((run) => run.id === input.run_id) : undefined,
  };
}

export async function previewMockCostBackfill(input: PreviewCostBackfillInput) {
  const existing = runsByStore.get(input.expected_store_id) ?? [];
  const createdAt = new Date().toISOString();
  const run: CostBackfillRun = {
    id: crypto.randomUUID(),
    store_id: input.expected_store_id,
    state: "previewed",
    start_date: input.start_date,
    end_date: input.end_date,
    max_candidates: input.max_candidates,
    fixture_hash: "a".repeat(64),
    candidate_count: 2,
    estimated_count: 1,
    unknown_count: 1,
    applied_count: 0,
    conflict_count: 0,
    failed_count: 0,
    reverted_count: 0,
    revert_conflict_count: 0,
    created_at: createdAt,
    candidates: [
      {
        id: crypto.randomUUID(),
        order_id: "00000000-0000-4000-8000-000000000101",
        line_ordinal: 1,
        planned_line_id: crypto.randomUUID(),
        line_id_was_missing: true,
        catalog_key: "display:main",
        line_name: "屏幕维修",
        proposed_cost_amount: 15,
        proposed_source: "backfill_estimate",
        proposed_evidence_status: "estimated",
        status: "previewed",
      },
      {
        id: crypto.randomUUID(),
        order_id: "00000000-0000-4000-8000-000000000102",
        line_ordinal: 1,
        planned_line_id: crypto.randomUUID(),
        line_id_was_missing: false,
        line_name: "其他维修",
        proposed_cost_amount: null,
        proposed_source: "historical_unknown",
        proposed_evidence_status: "unknown",
        status: "previewed",
      },
    ],
  };
  runsByStore.set(input.expected_store_id, [run, ...existing]);
  return run;
}

export async function applyMockCostBackfill(input: ApplyCostBackfillInput) {
  return mutate(input.expected_store_id, input.run_id, (run) => {
    run.state = "applied";
    run.applied_at = new Date().toISOString();
    run.applied_count = run.candidate_count;
    run.candidates = run.candidates.map((candidate, index) => ({
      ...candidate,
      status: "applied",
      applied_projection_revision: index + 2,
      applied_at: run.applied_at,
    }));
  });
}

export async function revertMockCostBackfill(input: RevertCostBackfillInput) {
  return mutate(input.expected_store_id, input.run_id, (run) => {
    run.state = "reverted";
    run.reverted_at = new Date().toISOString();
    run.applied_count = 0;
    run.reverted_count = run.candidate_count;
    run.candidates = run.candidates.map((candidate) => ({
      ...candidate,
      status: "reverted",
      reverted_at: run.reverted_at,
    }));
  });
}

function mutate(storeId: string, runId: string, update: (run: CostBackfillRun) => void) {
  const run = (runsByStore.get(storeId) ?? []).find((item) => item.id === runId);
  if (!run) throw new Error("回填运行不存在");
  update(run);
  return run;
}
