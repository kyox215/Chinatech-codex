import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActorStoreMembership } from "@/lib/repairdesk/types";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

import { ClosedStoresScreen, formatClosedStoreTimestamp } from "./closed-stores-screen";

const store: ActorStoreMembership = {
  id: "00000000-0000-4000-8000-00000000cafe",
  name: "Archivio Cliente",
  slug: "archivio-cliente",
  role: "owner",
  status: "inactive",
  lifecycle: {
    store_id: "00000000-0000-4000-8000-00000000cafe",
    phase: "closing",
    revision: 7,
    close_requested_at: "2026-10-25T01:30:00.000Z",
  },
  lifecycleAccess: {
    store_id: "00000000-0000-4000-8000-00000000cafe",
    check: { allowed: true, code: "available" },
    rename: { allowed: false, code: "store_unavailable" },
    close: { allowed: false, code: "store_unavailable" },
    restore: { allowed: true, code: "available" },
    purge: { allowed: false, code: "store_unavailable" },
  },
};

const mocks = vi.hoisted(() => ({
  getContext: vi.fn(),
  getState: vi.fn(),
  getOperation: vi.fn(),
  issueChallenge: vi.fn(),
  restore: vi.fn(),
  clearTenantCache: vi.fn(),
  refreshContext: vi.fn(),
  routerRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
  useViewportMode: () => "desktop",
  useIsCompactWorkspace: () => false,
}));

vi.mock("@/features/settings/model/store-lifecycle-mfa", () => ({
  lifecycleMfaRequired: () => false,
  verifyRecentLifecycleAal2: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/settings/sections/store-purge-manager", () => ({
  StorePurgeManager: () => null,
}));

vi.mock("@/lib/repairdesk/api", () => ({
  getStoreContext: mocks.getContext,
  getStoreLifecycleState: mocks.getState,
  getStoreLifecycleOperationStatus: mocks.getOperation,
  issueStoreLifecycleChallenge: mocks.issueChallenge,
  restoreStoreWorkspace: mocks.restore,
}));

vi.mock("@/features/stores/api/tenant-cache", () => ({
  clearTenantScopedQueryCache: mocks.clearTenantCache,
  refreshStoreContextQueries: mocks.refreshContext,
}));

describe("ClosedStoresScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getContext.mockResolvedValue({ stores: [], recoveryStores: [store] });
    mocks.getState.mockResolvedValue(store.lifecycle);
    mocks.issueChallenge.mockResolvedValue({ id: "challenge-restore" });
    mocks.restore.mockResolvedValue({
      operation_id: "operation-restore",
      replayed: false,
      lifecycle: { store_id: store.id, phase: "active", revision: 8 },
      next_active_store_id: store.id,
    });
    mocks.clearTenantCache.mockResolvedValue(undefined);
    mocks.refreshContext.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it.each([
    ["zh-CN" as const, "已关闭与删除", "查看与恢复"],
    ["it-IT" as const, "Chiusi ed eliminati", "Visualizza e ripristina"],
    ["en" as const, "Closed and deleted", "View and restore"],
  ])(
    "renders fixed staff copy in %s while preserving dynamic store data",
    async (locale, title, action) => {
      renderScreen(locale);
      expect(await screen.findByText(title)).toBeVisible();
      expect(await screen.findByText(store.name)).toBeVisible();
      expect(screen.getByRole("button", { name: action })).toBeEnabled();
      expect(document.body).not.toHaveTextContent("RAW_DATABASE_DIAGNOSTIC");
    },
  );

  it("locks restore before the asynchronous challenge and preserves the exact canonical body", async () => {
    let resolveChallenge!: (value: { id: string }) => void;
    mocks.issueChallenge.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveChallenge = resolve;
        }),
    );
    renderScreen("en");
    fireEvent.click(await screen.findByRole("button", { name: "View and restore" }));
    const submit = await screen.findByRole("button", { name: "Confirm restoration" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.issueChallenge).toHaveBeenCalledTimes(1));

    await act(async () => resolveChallenge({ id: "challenge-restore" }));
    await waitFor(() => expect(mocks.restore).toHaveBeenCalledTimes(1));
    expect(mocks.restore).toHaveBeenCalledWith({
      expectedStoreId: store.id,
      expectedRevision: 7,
      operationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      reauthChallengeId: "challenge-restore",
    });
  });

  it("uses Rome time for valid instants and never echoes invalid timestamps", () => {
    const hostTimezone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    const valid = "2026-03-29T01:30:00.000Z";
    try {
      expect(formatClosedStoreTimestamp(valid, "zh-CN")).toBe("2026年3月29日 03:30");
      expect(formatClosedStoreTimestamp(valid, "it-IT")).toBe("29 mar 2026, 03:30");
      expect(formatClosedStoreTimestamp(valid, "en")).toBe("Mar 29, 2026, 3:30 AM");
      expect(formatClosedStoreTimestamp("RAW_INVALID_TIMESTAMP", "zh-CN")).toBe("时间不可用");
      expect(formatClosedStoreTimestamp("RAW_INVALID_TIMESTAMP", "it-IT")).toBe(
        "Data non disponibile",
      );
      expect(formatClosedStoreTimestamp("RAW_INVALID_TIMESTAMP", "en")).toBe("Date unavailable");
    } finally {
      if (hostTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = hostTimezone;
    }
  });
});

function renderScreen(locale: AppLocale) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <LocaleProvider initialLocale={locale}>
      <QueryClientProvider client={queryClient}>
        <ClosedStoresScreen />
      </QueryClientProvider>
    </LocaleProvider>,
  );
}
