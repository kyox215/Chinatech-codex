import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CostBackfillRun } from "@/lib/repairdesk/types";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

const apiMocks = vi.hoisted(() => ({
  read: vi.fn(),
  preview: vi.fn(),
  apply: vi.fn(),
  revert: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  readCostBackfillRuns: apiMocks.read,
  previewCostBackfill: apiMocks.preview,
  applyCostBackfill: apiMocks.apply,
  revertCostBackfill: apiMocks.revert,
}));
vi.mock("sonner", () => ({
  toast: { success: apiMocks.toastSuccess, error: apiMocks.toastError },
}));

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

  it.each([
    [
      "zh-CN",
      "开始日期",
      "结束日期",
      "最大候选数",
      "生成只读预览",
      "应用下一批",
      "确认应用",
      "补偿撤销",
      "确认撤销",
    ],
    [
      "it-IT",
      "Data iniziale",
      "Data finale",
      "Candidati massimi",
      "Genera anteprima in sola lettura",
      "Applica lotto successivo",
      "Conferma applicazione",
      "Annullamento compensativo",
      "Conferma revoca",
    ],
    [
      "en",
      "Start date",
      "End date",
      "Maximum candidates",
      "Generate read-only preview",
      "Apply next batch",
      "Confirm apply",
      "Compensating revert",
      "Confirm revoke",
    ],
  ] as const)(
    "keeps preview/apply/revert exact and same-tick locked in %s",
    async (
      locale,
      startLabel,
      endLabel,
      maxLabel,
      previewLabel,
      applyLabel,
      confirmApplyLabel,
      revertLabel,
      confirmRevertLabel,
    ) => {
      const previewPending = deferred<CostBackfillRun>();
      const applyPending = deferred<CostBackfillRun>();
      const revertPending = deferred<CostBackfillRun>();
      apiMocks.preview.mockReturnValueOnce(previewPending.promise);
      apiMocks.apply.mockReturnValueOnce(applyPending.promise);
      apiMocks.revert.mockReturnValueOnce(revertPending.promise);
      vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000099");
      const user = userEvent.setup();
      renderCard(true, locale);
      await screen.findByLabelText(startLabel);
      await user.clear(screen.getByLabelText(startLabel));
      await user.type(screen.getByLabelText(startLabel), "2026-01-01");
      await user.clear(screen.getByLabelText(endLabel));
      await user.type(screen.getByLabelText(endLabel), "2026-01-31");
      await user.clear(screen.getByLabelText(maxLabel));
      await user.type(screen.getByLabelText(maxLabel), "100");
      const previewButton = screen.getByRole("button", { name: previewLabel });
      fireEvent.click(previewButton);
      fireEvent.click(previewButton);
      await waitFor(() => expect(apiMocks.preview).toHaveBeenCalledTimes(1));
      expect(apiMocks.preview).toHaveBeenCalledWith({
        expected_store_id: "00000000-0000-4000-8000-000000000001",
        start_date: "2026-01-01",
        end_date: "2026-01-31",
        max_candidates: 100,
        idempotency_key: "00000000-0000-4000-8000-000000000099",
      });
      previewPending.resolve(runFixture());
      expect(await screen.findByText("Legacy Screen")).toBeVisible();

      await user.click(screen.getByRole("button", { name: applyLabel }));
      const confirmApply = screen.getByRole("button", { name: confirmApplyLabel });
      fireEvent.click(confirmApply);
      fireEvent.click(confirmApply);
      await waitFor(() => expect(apiMocks.apply).toHaveBeenCalledTimes(1));
      expect(apiMocks.apply).toHaveBeenCalledWith({
        expected_store_id: "00000000-0000-4000-8000-000000000001",
        run_id: "00000000-0000-4000-8000-000000000030",
        expected_fixture_hash: "a".repeat(64),
        batch_size: 50,
        idempotency_key: "00000000-0000-4000-8000-000000000030",
      });
      applyPending.resolve(runFixture({ state: "applied", applied_count: 2 }));
      await waitFor(() => expect(screen.getByRole("button", { name: revertLabel })).toBeVisible());

      await user.click(screen.getByRole("button", { name: revertLabel }));
      const confirmRevert = screen.getByRole("button", { name: confirmRevertLabel });
      fireEvent.click(confirmRevert);
      fireEvent.click(confirmRevert);
      await waitFor(() => expect(apiMocks.revert).toHaveBeenCalledTimes(1));
      expect(apiMocks.revert).toHaveBeenCalledWith({
        expected_store_id: "00000000-0000-4000-8000-000000000001",
        run_id: "00000000-0000-4000-8000-000000000030",
        batch_size: 50,
        idempotency_key: "00000000-0000-4000-8000-000000000030",
      });
      revertPending.resolve(runFixture({ state: "reverted", applied_count: 2, reverted_count: 2 }));
      await waitFor(() => expect(apiMocks.toastSuccess).toHaveBeenCalledTimes(3));
    },
  );

  it("reuses a preview fingerprint after an unknown result and consumes recent-run rejection", async () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000401")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000402");
    apiMocks.preview
      .mockRejectedValueOnce(new Error("RAW_PREVIEW_UNKNOWN"))
      .mockRejectedValueOnce(new Error("RAW_PREVIEW_UNKNOWN_AGAIN"));
    const user = userEvent.setup();
    renderCard(true);
    const previewButton = await screen.findByRole("button", { name: "生成只读预览" });
    await user.click(previewButton);
    await waitFor(() => expect(apiMocks.preview).toHaveBeenCalledTimes(1));
    await user.click(previewButton);
    await waitFor(() => expect(apiMocks.preview).toHaveBeenCalledTimes(2));
    expect(apiMocks.preview.mock.calls[1]?.[0]).toEqual(apiMocks.preview.mock.calls[0]?.[0]);
    expect(apiMocks.toastError.mock.calls.flat().join(" ")).not.toContain("RAW_PREVIEW");

    cleanup();
    apiMocks.read.mockResolvedValueOnce({ runs: [runFixture()] });
    const second = renderCard(true);
    const recent = await screen.findByRole("button", { name: /2026-01-01/ });
    apiMocks.read.mockRejectedValueOnce(new Error("RAW_RECENT_RUN"));
    await user.click(recent);
    await waitFor(() => expect(apiMocks.toastError).toHaveBeenCalledTimes(3));
    expect(apiMocks.toastError.mock.calls.flat().join(" ")).not.toContain("RAW_RECENT_RUN");
    second.unmount();
  });

  it("preserves a focused preview draft across locale switch with zero requests", async () => {
    renderCard(true, "en", "00000000-0000-4000-8000-000000000001", true);
    const start = await screen.findByLabelText("Start date");
    fireEvent.change(start, { target: { value: "2026-02-01" } });
    start.focus();
    const reads = apiMocks.read.mock.calls.length;
    fireEvent.click(screen.getByTestId("switch-it"));

    expect(await screen.findByLabelText("Data iniziale")).toBe(start);
    expect(start).toHaveValue("2026-02-01");
    expect(start).toHaveFocus();
    expect(apiMocks.read).toHaveBeenCalledTimes(reads);
    expect(apiMocks.preview).not.toHaveBeenCalled();
    expect(apiMocks.apply).not.toHaveBeenCalled();
    expect(apiMocks.revert).not.toHaveBeenCalled();
  });

  it("drops a late old-store preview without DOM, toast, or cache side effects", async () => {
    const pending = deferred<CostBackfillRun>();
    apiMocks.preview.mockReturnValueOnce(pending.promise);
    const client = createClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const view = renderCard(true, "zh-CN", "00000000-0000-4000-8000-000000000001", false, client);
    fireEvent.click(await screen.findByRole("button", { name: "生成只读预览" }));
    await waitFor(() => expect(apiMocks.preview).toHaveBeenCalledTimes(1));

    view.rerender(
      backfillTree(true, "zh-CN", "00000000-0000-4000-8000-000000000002", false, client),
    );
    invalidate.mockClear();
    await act(async () => {
      pending.resolve(runFixture());
      await pending.promise;
    });

    expect(screen.queryByText("Legacy Screen")).not.toBeInTheDocument();
    expect(apiMocks.toastSuccess).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it.each([
    ["apply", "应用下一批", "确认应用"],
    ["revert", "补偿撤销", "确认撤销"],
  ] as const)(
    "drops a late old-store %s result without DOM, toast, or cache side effects",
    async (kind, openLabel, confirmLabel) => {
      const pending = deferred<CostBackfillRun>();
      const mutationMock = kind === "apply" ? apiMocks.apply : apiMocks.revert;
      mutationMock.mockReturnValueOnce(pending.promise);
      apiMocks.preview.mockResolvedValueOnce(
        runFixture(kind === "revert" ? { state: "applied", applied_count: 2 } : {}),
      );
      const client = createClient();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      const user = userEvent.setup();
      const view = renderCard(true, "zh-CN", "00000000-0000-4000-8000-000000000001", false, client);
      await user.click(await screen.findByRole("button", { name: "生成只读预览" }));
      expect(await screen.findByText("Legacy Screen")).toBeVisible();
      apiMocks.toastSuccess.mockClear();
      invalidate.mockClear();

      await user.click(screen.getByRole("button", { name: openLabel }));
      fireEvent.click(screen.getByRole("button", { name: confirmLabel }));
      await waitFor(() => expect(mutationMock).toHaveBeenCalledTimes(1));
      view.rerender(
        backfillTree(true, "zh-CN", "00000000-0000-4000-8000-000000000002", false, client),
      );
      await act(async () => {
        pending.resolve(
          runFixture(
            kind === "apply"
              ? { state: "applied", applied_count: 2 }
              : { state: "reverted", applied_count: 2, reverted_count: 2 },
          ),
        );
        await pending.promise;
      });

      expect(screen.queryByText("Legacy Screen")).not.toBeInTheDocument();
      expect(apiMocks.toastSuccess).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
    },
  );
});

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function backfillTree(
  canApply: boolean,
  locale: AppLocale,
  storeId: string,
  withLocaleSwitch: boolean,
  queryClient: QueryClient,
) {
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider initialLocale={locale}>
        {withLocaleSwitch ? <TestLocaleSwitch /> : null}
        <CostBackfillCard storeId={storeId} canApply={canApply} />
      </LocaleProvider>
    </QueryClientProvider>
  );
}

function renderCard(
  canApply: boolean,
  locale: AppLocale = "zh-CN",
  storeId = "00000000-0000-4000-8000-000000000001",
  withLocaleSwitch = false,
  queryClient = createClient(),
) {
  return render(backfillTree(canApply, locale, storeId, withLocaleSwitch, queryClient));
}

function TestLocaleSwitch() {
  const { setLocale } = useLocale();
  return (
    <button type="button" data-testid="switch-it" onClick={() => setLocale("it-IT")}>
      switch-it
    </button>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
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
