import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor, CostBackfillRun } from "@/lib/repairdesk/types";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  preview: vi.fn(),
  apply: vi.fn(),
  revert: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("./cost-backfill.repository", () => ({
  readCostBackfillRunsRepository: mocks.read,
  previewCostBackfillRepository: mocks.preview,
  applyCostBackfillRepository: mocks.apply,
  revertCostBackfillRepository: mocks.revert,
}));
vi.mock("@/server/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));

import {
  applyCostBackfill,
  previewCostBackfill,
  revertCostBackfill,
} from "./cost-backfill.service";

const storeId = "00000000-0000-4000-8000-000000000001";
const manager: AuditActor = {
  id: "00000000-0000-4000-8000-000000000010",
  displayName: "Manager",
  storeId,
  storeRole: "manager",
  permissionGrants: ["finance:cost_backfill_preview"],
};
const owner: AuditActor = {
  id: "00000000-0000-4000-8000-000000000011",
  displayName: "Owner",
  storeId,
  storeRole: "owner",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("REPAIRDESK_ORDER_COSTS_ENABLED", "1");
  vi.stubEnv("REPAIRDESK_COST_BACKFILL_ENABLED", "1");
  mocks.preview.mockResolvedValue(runFixture());
  mocks.apply.mockResolvedValue(runFixture({ state: "applied", applied_count: 1 }));
  mocks.revert.mockResolvedValue(runFixture({ state: "reverted", reverted_count: 1 }));
  mocks.writeAuditLog.mockResolvedValue({ ok: true });
});

afterEach(() => vi.unstubAllEnvs());

describe("cost backfill service", () => {
  it("lets a granted manager preview but blocks apply before the repository", async () => {
    await expect(
      previewCostBackfill(
        {
          expected_store_id: storeId,
          start_date: "2026-01-01",
          end_date: "2026-01-31",
          max_candidates: 100,
          idempotency_key: "00000000-0000-4000-8000-000000000020",
        },
        manager,
      ),
    ).resolves.toMatchObject({ state: "previewed" });
    await expect(
      applyCostBackfill(
        {
          expected_store_id: storeId,
          run_id: "00000000-0000-4000-8000-000000000030",
          expected_fixture_hash: "a".repeat(64),
          batch_size: 50,
          idempotency_key: "00000000-0000-4000-8000-000000000030",
        },
        manager,
      ),
    ).rejects.toThrow("仅店主可应用或撤销历史成本");
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("blocks a changed store before apply or revert reaches financial data", async () => {
    const input = {
      expected_store_id: "00000000-0000-4000-8000-000000000999",
      run_id: "00000000-0000-4000-8000-000000000030",
      batch_size: 50,
      idempotency_key: "00000000-0000-4000-8000-000000000030",
    };
    await expect(
      applyCostBackfill({ ...input, expected_fixture_hash: "a".repeat(64) }, owner),
    ).rejects.toThrow("店铺上下文已经变化");
    await expect(revertCostBackfill(input, owner)).rejects.toThrow("店铺上下文已经变化");
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.revert).not.toHaveBeenCalled();
  });

  it("audits only run hash, state and aggregate counts", async () => {
    await applyCostBackfill(
      {
        expected_store_id: storeId,
        run_id: "00000000-0000-4000-8000-000000000030",
        expected_fixture_hash: "a".repeat(64),
        batch_size: 50,
        idempotency_key: "00000000-0000-4000-8000-000000000030",
      },
      owner,
    );
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "apply",
        entityType: "repair_cost_backfill_run",
        metadata: expect.objectContaining({ fixture_hash: "a".repeat(64), applied_count: 1 }),
      }),
    );
    const serialized = JSON.stringify(mocks.writeAuditLog.mock.calls[0]?.[0]);
    expect(serialized).not.toContain("Legacy Screen");
    expect(serialized).not.toContain("candidates");
    expect(serialized).not.toContain("proposed_cost_amount");
  });
});

function runFixture(overrides: Partial<CostBackfillRun> = {}): CostBackfillRun {
  return {
    id: "00000000-0000-4000-8000-000000000030",
    store_id: storeId,
    state: "previewed",
    start_date: "2026-01-01",
    end_date: "2026-01-31",
    max_candidates: 100,
    fixture_hash: "a".repeat(64),
    candidate_count: 1,
    estimated_count: 1,
    unknown_count: 0,
    applied_count: 0,
    conflict_count: 0,
    failed_count: 0,
    reverted_count: 0,
    revert_conflict_count: 0,
    created_at: "2026-07-18T10:00:00.000Z",
    candidates: [
      {
        id: "00000000-0000-4000-8000-000000000031",
        order_id: "00000000-0000-4000-8000-000000000032",
        line_ordinal: 1,
        planned_line_id: "00000000-0000-4000-8000-000000000033",
        line_id_was_missing: true,
        catalog_key: "phone:legacy",
        line_name: "Legacy Screen",
        proposed_cost_amount: 15,
        proposed_source: "backfill_estimate",
        proposed_evidence_status: "estimated",
        status: "previewed",
      },
    ],
    ...overrides,
  };
}
