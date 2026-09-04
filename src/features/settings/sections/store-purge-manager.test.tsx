import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getStorePurgeConfirmationPhrase } from "@/entities/store/model/store-purge-confirmation";
import type {
  ActorStoreMembership,
  StoreLifecyclePreflight,
  StorePurgeRequest,
} from "@/lib/repairdesk/types";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

import { StorePurgeManager } from "./store-purge-manager";
import { formatPurgeTimestamp } from "./store-purge-status-card";

const storeId = "00000000-0000-4000-8000-00000000cafe";
const store: ActorStoreMembership = {
  id: storeId,
  name: "Demo Archived Store",
  slug: "demo-archived-store",
  role: "owner",
  status: "inactive",
  lifecycle: { store_id: storeId, phase: "archived", revision: 7 },
};

const mocks = vi.hoisted(() => ({
  getPurge: vi.fn(),
  createPreflight: vi.fn(),
  issueChallenge: vi.fn(),
  request: vi.fn(),
  cancel: vi.fn(),
  confirm: vi.fn(),
  clearTenantCache: vi.fn(),
  refreshStoreContext: vi.fn(),
  isMobile: false,
}));

vi.mock("@/lib/repairdesk/api", () => ({
  getStorePurgeRequest: mocks.getPurge,
  createStoreLifecyclePreflight: mocks.createPreflight,
  issueStoreLifecycleChallenge: mocks.issueChallenge,
  requestStorePurge: mocks.request,
  cancelStorePurgeRequest: mocks.cancel,
  confirmStorePurgeRequest: mocks.confirm,
}));

vi.mock("@/features/settings/model/store-lifecycle-mfa", () => ({
  lifecycleMfaRequired: () => false,
  verifyRecentLifecycleAal2: vi.fn(),
}));

vi.mock("@/features/stores/api/tenant-cache", () => ({
  clearTenantScopedQueryCache: mocks.clearTenantCache,
  refreshStoreContextQueries: mocks.refreshStoreContext,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mocks.isMobile,
}));

describe("StorePurgeManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isMobile = false;
    mocks.createPreflight.mockResolvedValue(eligiblePreflight());
    mocks.issueChallenge.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000901",
      store_id: storeId,
      operation_kind: "request_purge",
      lifecycle_revision: 7,
      assurance_level: "aal2",
      expires_at: "2099-01-01T00:00:00.000Z",
    });
    mocks.request.mockResolvedValue(coolingRequest());
    mocks.cancel.mockResolvedValue(cancelledRequest());
    mocks.confirm.mockResolvedValue(scheduledRequest());
    mocks.clearTenantCache.mockResolvedValue(undefined);
    mocks.refreshStoreContext.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not read or expose purge status when the capability denies the actor", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <StorePurgeManager
          store={store}
          capability={{ allowed: false, code: "primary_owner_required" }}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("只有系统登记的店铺主账号可以申请永久删除。")).toBeVisible();
    expect(mocks.getPurge).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "申请永久删除" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "二次确认并永久删除" })).not.toBeInTheDocument();
    expect(screen.queryByText(storeId)).not.toBeInTheDocument();
  });

  it("keeps actions read-only while status is loading or unavailable", async () => {
    let resolveStatus: ((value: null) => void) | undefined;
    mocks.getPurge.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          resolveStatus = resolve;
        }),
    );
    const view = renderManager();

    expect(await screen.findByTestId("purge-status-loading")).toBeVisible();
    expect(screen.queryByRole("button", { name: "申请永久删除" })).not.toBeInTheDocument();

    resolveStatus?.(null);
    await waitFor(() => expect(screen.getByRole("button", { name: "申请永久删除" })).toBeVisible());

    view.unmount();
    mocks.getPurge.mockRejectedValueOnce(new Error("status read failed"));
    renderManager();
    expect(await screen.findByTestId("purge-status-error")).toBeVisible();
    expect(screen.queryByRole("button", { name: "申请永久删除" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试读取状态" })).toBeEnabled();
  });

  it("keeps an existing cancellation available when only new scheduling is disabled", async () => {
    mocks.getPurge.mockResolvedValue(coolingRequest());
    render(
      <QueryClientProvider client={new QueryClient()}>
        <StorePurgeManager
          store={store}
          capability={{ allowed: false, code: "feature_disabled" }}
        />
      </QueryClientProvider>,
    );

    const cancel = await screen.findByRole("button", { name: "取消永久删除" });
    expect(screen.queryByRole("button", { name: "申请永久删除" })).not.toBeInTheDocument();
    fireEvent.click(cancel);
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledTimes(1));
  });

  it.each([
    ["zh-CN" as const, "永久删除冷静期中", "取消永久删除"],
    ["it-IT" as const, "Periodo di attesa per l’eliminazione", "Annulla eliminazione definitiva"],
    ["en" as const, "Permanent deletion cooling-off period", "Cancel permanent deletion"],
  ])(
    "presents a canonical cooling state in %s without changing it",
    async (locale, status, cancel) => {
      mocks.getPurge.mockResolvedValue(coolingRequest());
      renderManager(locale);
      expect(await screen.findByText(status)).toBeVisible();
      expect(screen.getByRole("button", { name: cancel })).toBeEnabled();
      expect(mocks.cancel).not.toHaveBeenCalled();
    },
  );

  it("requires an exact request phrase and sends only the shared phrase field", async () => {
    mocks.getPurge.mockResolvedValue(null);
    renderManager();

    await screen.findByRole("button", { name: "申请永久删除" });
    fireEvent.click(screen.getByRole("button", { name: "申请永久删除" }));
    expect(await screen.findByRole("dialog", { name: "申请永久删除店铺" })).toBeVisible();

    const phrase = getStorePurgeConfirmationPhrase(storeId, "request_purge");
    const input = screen.getByLabelText("请逐字输入以下提示词");
    const submit = screen.getByRole("button", { name: "建立删除申请" });
    expect(screen.getByText(phrase, { exact: true })).toBeVisible();
    expect(submit).toBeDisabled();

    fireEvent.change(input, { target: { value: `${phrase} ` } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("提示词不匹配");
    expect(submit).toBeDisabled();

    fireEvent.change(input, { target: { value: phrase } });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1));
    expect(mocks.request).toHaveBeenCalledWith({
      expectedStoreId: storeId,
      expectedRevision: 7,
      reauthChallengeId: "00000000-0000-4000-8000-000000000901",
      preflightSnapshotHash: "a".repeat(64),
      confirmationPhrase: phrase,
    });
  });

  it("formats purge status dates in Rome and never echoes invalid input", () => {
    const hostTimezone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    const instant = "2026-10-25T01:30:00.000Z";
    try {
      expect(formatPurgeTimestamp(instant, "zh-CN")).toBe("2026年10月25日 02:30");
      expect(formatPurgeTimestamp(instant, "it-IT")).toBe("25 ott 2026, 02:30");
      expect(formatPurgeTimestamp(instant, "en")).toBe("Oct 25, 2026, 2:30 AM");
      expect(formatPurgeTimestamp("RAW_INVALID_TIMESTAMP", "zh-CN")).toBe("时间不可用");
      expect(formatPurgeTimestamp("RAW_INVALID_TIMESTAMP", "it-IT")).toBe("Data non disponibile");
      expect(formatPurgeTimestamp("RAW_INVALID_TIMESTAMP", "en")).toBe("Date unavailable");
    } finally {
      if (hostTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = hostTimezone;
    }
  });

  it("takes the begin/preflight lock before the first await", async () => {
    let resolvePreflight!: (value: StoreLifecyclePreflight) => void;
    mocks.getPurge.mockResolvedValue(null);
    mocks.createPreflight.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePreflight = resolve;
        }),
    );
    renderManager();
    const begin = await screen.findByRole("button", { name: "申请永久删除" });
    fireEvent.click(begin);
    fireEvent.click(begin);
    expect(mocks.createPreflight).toHaveBeenCalledTimes(1);
    await act(async () => resolvePreflight(eligiblePreflight()));
  });

  it("locks phrase, acknowledgement, cancel, and submit controls while a mutation is pending", async () => {
    mocks.getPurge.mockResolvedValue(null);
    mocks.request.mockImplementation(() => new Promise<StorePurgeRequest>(() => undefined));
    renderManager();

    await screen.findByRole("button", { name: "申请永久删除" });
    fireEvent.click(screen.getByRole("button", { name: "申请永久删除" }));
    await screen.findByRole("dialog", { name: "申请永久删除店铺" });
    const phrase = getStorePurgeConfirmationPhrase(storeId, "request_purge");
    fireEvent.change(screen.getByLabelText("请逐字输入以下提示词"), {
      target: { value: phrase },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    const submit = screen.getByRole("button", { name: "建立删除申请" });
    fireEvent.click(submit);

    await waitFor(() => expect(screen.getByRole("button", { name: "正在提交…" })).toBeDisabled());
    expect(screen.getByLabelText("请逐字输入以下提示词")).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "复制删除确认提示词" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "返回" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "正在提交…" }));
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });

  it("keeps the shared lock until a rejected submit is reconciled", async () => {
    mocks.getPurge.mockResolvedValueOnce(null).mockResolvedValue(coolingRequest());
    mocks.request.mockRejectedValueOnce(new Error("network after commit"));
    renderManager();

    await screen.findByRole("button", { name: "申请永久删除" });
    fireEvent.click(screen.getByRole("button", { name: "申请永久删除" }));
    await screen.findByRole("dialog", { name: "申请永久删除店铺" });
    const phrase = getStorePurgeConfirmationPhrase(storeId, "request_purge");
    fireEvent.change(screen.getByLabelText("请逐字输入以下提示词"), {
      target: { value: phrase },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "建立删除申请" }));

    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.getPurge.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(await screen.findByText("永久删除冷静期中")).toBeVisible();
    expect(screen.queryByRole("button", { name: "申请永久删除" })).not.toBeInTheDocument();
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });

  it.each([
    { kind: "request" as const, initial: null },
    { kind: "cancel" as const, initial: coolingRequest() },
    { kind: "confirm" as const, initial: readyRequest() },
  ])("fails closed after a rejected $kind reconciliation", async ({ kind, initial }) => {
    let mutationStarted = false;
    mocks.getPurge.mockImplementation(async () => {
      if (mutationStarted) throw new Error("status unavailable");
      return initial;
    });
    const remoteMutation =
      kind === "request" ? mocks.request : kind === "cancel" ? mocks.cancel : mocks.confirm;
    remoteMutation.mockImplementation(async () => {
      mutationStarted = true;
      throw new Error("network after commit");
    });
    renderManager();

    if (kind === "request") {
      await screen.findByRole("button", { name: "申请永久删除" });
      fireEvent.click(screen.getByRole("button", { name: "申请永久删除" }));
      await screen.findByRole("dialog", { name: "申请永久删除店铺" });
      fireEvent.change(screen.getByLabelText("请逐字输入以下提示词"), {
        target: { value: getStorePurgeConfirmationPhrase(storeId, "request_purge") },
      });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "建立删除申请" }));
    } else if (kind === "cancel") {
      fireEvent.click(await screen.findByRole("button", { name: "取消永久删除" }));
    } else {
      fireEvent.click(await screen.findByRole("button", { name: "二次确认并永久删除" }));
      await screen.findByRole("dialog", { name: "最终确认永久删除" });
      fireEvent.change(screen.getByLabelText("请逐字输入以下提示词"), {
        target: { value: getStorePurgeConfirmationPhrase(storeId, "confirm_purge") },
      });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "确认永久删除" }));
    }

    await waitFor(() => expect(screen.getByTestId("purge-outcome-unknown")).toBeVisible());
    expect(screen.getByRole("button", { name: "重试状态核对" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "申请永久删除" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "取消永久删除" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "二次确认并永久删除" })).not.toBeInTheDocument();
    if (kind === "confirm") {
      expect(screen.queryByTestId("purge-confirmation-dialog")).not.toBeInTheDocument();
    }
    expect(remoteMutation).toHaveBeenCalledTimes(1);
  });

  it("uses a different exact final phrase and does not equate confirmation with execution", async () => {
    mocks.getPurge.mockResolvedValue(readyRequest());
    renderManager();

    await screen.findByRole("button", { name: "二次确认并永久删除" });
    fireEvent.click(screen.getByRole("button", { name: "二次确认并永久删除" }));
    expect(await screen.findByRole("dialog", { name: "最终确认永久删除" })).toBeVisible();

    const phrase = getStorePurgeConfirmationPhrase(storeId, "confirm_purge");
    expect(phrase).not.toBe(getStorePurgeConfirmationPhrase(storeId, "request_purge"));
    fireEvent.change(screen.getByLabelText("请逐字输入以下提示词"), {
      target: { value: phrase },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    const submit = screen.getByRole("button", { name: "确认永久删除" });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1));
    expect(mocks.confirm).toHaveBeenCalledWith({
      expectedStoreId: storeId,
      expectedRevision: 7,
      reauthChallengeId: "00000000-0000-4000-8000-000000000901",
      preflightSnapshotHash: "a".repeat(64),
      confirmationPhrase: phrase,
      requestId: readyRequest().request_id,
    });
    expect(screen.queryByText("后台将开始清除")).not.toBeInTheDocument();
  });

  it("refreshes lifecycle/context after cancellation and hides actions after completion", async () => {
    mocks.getPurge.mockResolvedValueOnce(coolingRequest()).mockResolvedValueOnce(null);
    const firstView = renderManager();
    await screen.findByRole("button", { name: "取消永久删除" });
    fireEvent.click(screen.getByRole("button", { name: "取消永久删除" }));

    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledTimes(1));
    expect(mocks.cancel).toHaveBeenCalledWith({
      expectedStoreId: storeId,
      requestId: coolingRequest().request_id,
    });
    await waitFor(() => expect(mocks.refreshStoreContext).toHaveBeenCalledTimes(1));

    firstView.unmount();
    mocks.getPurge.mockResolvedValue(completedRequest());
    const view = renderManager();
    expect(await screen.findByTestId("purge-status-completed")).toHaveTextContent("已完成");
    expect(screen.queryByRole("button", { name: "申请永久删除" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "二次确认并永久删除" })).not.toBeInTheDocument();
    view.unmount();
  });

  it.each([
    { mobile: true, testId: "purge-confirmation-sheet" },
    { mobile: false, testId: "purge-confirmation-dialog" },
  ])("uses the responsive confirmation surface ($testId)", async ({ mobile, testId }) => {
    mocks.isMobile = mobile;
    mocks.getPurge.mockResolvedValue(null);
    renderManager();
    await screen.findByRole("button", { name: "申请永久删除" });
    fireEvent.click(screen.getByRole("button", { name: "申请永久删除" }));
    expect(await screen.findByTestId(testId)).toBeVisible();
  });
});

function renderManager(locale: AppLocale = "zh-CN") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <LocaleProvider initialLocale={locale}>
      <QueryClientProvider client={queryClient}>
        <StorePurgeManager store={store} capability={{ allowed: true, code: "available" }} />
      </QueryClientProvider>
    </LocaleProvider>,
  );
}

function eligiblePreflight(): StoreLifecyclePreflight {
  return {
    id: "00000000-0000-4000-8000-000000000902",
    store_id: storeId,
    store_name: store.name,
    lifecycle: { store_id: storeId, phase: "archived", revision: 7 },
    state: "eligible",
    counts: {},
    blockers: [],
    automatic_effects: { pending_invitations: 0, open_kiosk_sessions: 0 },
    snapshot_hash: "a".repeat(64),
    expires_at: "2099-01-01T00:00:00.000Z",
  };
}

function coolingRequest(): StorePurgeRequest {
  return {
    request_id: "00000000-0000-4000-8000-000000000910",
    store_id: storeId,
    state: "cooling",
    requested_at: "2026-08-27T00:00:00.000Z",
    cooling_until: "2099-01-01T00:00:00.000Z",
    export_job_id: "00000000-0000-4000-8000-000000000911",
    export_state: "pending",
  };
}

function readyRequest(): StorePurgeRequest {
  return { ...coolingRequest(), state: "ready_for_confirmation", export_state: "restore_verified" };
}

function cancelledRequest(): StorePurgeRequest {
  return { ...coolingRequest(), state: "cancelled", cancelled_at: "2026-08-27T01:00:00.000Z" };
}

function scheduledRequest(): StorePurgeRequest {
  return {
    ...readyRequest(),
    state: "scheduled",
    purge_job_id: "00000000-0000-4000-8000-000000000912",
    purge_after: "2099-01-02T00:00:00.000Z",
  };
}

function completedRequest(): StorePurgeRequest {
  return { ...scheduledRequest(), state: "completed", destructive_step_started: true };
}
