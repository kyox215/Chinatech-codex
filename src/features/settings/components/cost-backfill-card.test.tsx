import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CostBackfillRun } from "@/lib/repairdesk/types";

const apiMocks = vi.hoisted(() => ({
  read: vi.fn(),
  preview: vi.fn(),
  apply: vi.fn(),
  revert: vi.fn(),
}));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  readCostBackfillRuns: apiMocks.read,
  previewCostBackfill: apiMocks.preview,
  applyCostBackfill: apiMocks.apply,
  revertCostBackfill: apiMocks.revert,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CostBackfillCard } from "./cost-backfill-card";

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.read.mockResolvedValue({ runs: [] });
  apiMocks.preview.mockResolvedValue(runFixture());
  apiMocks.apply.mockResolvedValue(runFixture({ state: "applied", applied_count: 2 }));
  apiMocks.revert.mockResolvedValue(runFixture({ state: "reverted", reverted_count: 2 }));
});

afterEach(cleanup);

describe("CostBackfillCard", () => {
  it("never auto-applies and gives a preview-only manager no mutation controls", async () => {
    const user = userEvent.setup();
    renderCard(false);
    expect(await screen.findByText(/发布与部署不会自动应用任何运行/)).toBeVisible();
    expect(apiMocks.preview).not.toHaveBeenCalled();
    expect(apiMocks.apply).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "生成只读预览" }));
    expect(await screen.findByText("Legacy Screen")).toBeVisible();
    expect(screen.getByText(/只有店主可应用或撤销/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "应用下一批" })).not.toBeInTheDocument();
  });

  it("requires an explicit owner confirmation before applying a batch", async () => {
    const user = userEvent.setup();
    renderCard(true);
    await user.click(await screen.findByRole("button", { name: "生成只读预览" }));
    await screen.findByText("Legacy Screen");
    await user.click(screen.getByRole("button", { name: "应用下一批" }));
    expect(screen.getByRole("alertdialog", { name: "应用这个历史成本候选批次？" })).toBeVisible();
    expect(apiMocks.apply).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "确认应用" }));
    await waitFor(() => expect(apiMocks.apply).toHaveBeenCalledTimes(1));
    expect(apiMocks.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        run_id: "00000000-0000-4000-8000-000000000030",
        expected_fixture_hash: "a".repeat(64),
        idempotency_key: "00000000-0000-4000-8000-000000000030",
      }),
    );
  });
});

function renderCard(canApply: boolean) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CostBackfillCard storeId="00000000-0000-4000-8000-000000000001" canApply={canApply} />
    </QueryClientProvider>,
  );
}

function runFixture(overrides: Partial<CostBackfillRun> = {}): CostBackfillRun {
  return {
    id: "00000000-0000-4000-8000-000000000030",
    store_id: "00000000-0000-4000-8000-000000000001",
    state: "previewed",
    start_date: "2026-01-01",
    end_date: "2026-01-31",
    max_candidates: 100,
    fixture_hash: "a".repeat(64),
    candidate_count: 2,
    estimated_count: 1,
    unknown_count: 1,
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
