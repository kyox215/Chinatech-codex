import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActorStoreMembership, StoreLifecyclePreflight } from "@/lib/repairdesk/types";

import { StoreLifecycleActions } from "./store-lifecycle-actions";

const storeId = "00000000-0000-4000-8000-00000000cafe";
const store: ActorStoreMembership = {
  id: storeId,
  name: "Chinatech Siracusa",
  slug: "chinatech-siracusa",
  role: "owner",
  status: "active",
};

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  issueChallenge: vi.fn(),
  rename: vi.fn(),
  close: vi.fn(),
  restore: vi.fn(),
  clearTenantCache: vi.fn(),
  refreshStoreContext: vi.fn(),
}));

vi.mock("@/lib/repairdesk/api", () => ({
  getStoreLifecycleState: mocks.getState,
  issueStoreLifecycleChallenge: mocks.issueChallenge,
  renameStoreWorkspace: mocks.rename,
  requestStoreClose: mocks.close,
  restoreStoreWorkspace: mocks.restore,
}));

vi.mock("@/features/stores/api/tenant-cache", () => ({
  clearTenantScopedQueryCache: mocks.clearTenantCache,
  refreshStoreContextQueries: mocks.refreshStoreContext,
}));

describe("StoreLifecycleActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getState.mockResolvedValue({ store_id: storeId, phase: "active", revision: 4 });
    mocks.issueChallenge.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000901",
      store_id: storeId,
      operation_kind: "rename",
      lifecycle_revision: 4,
      assurance_level: "aal2",
      expires_at: "2099-01-01T00:00:00.000Z",
    });
    mocks.rename.mockResolvedValue({
      operation_id: "00000000-0000-4000-8000-000000000902",
      replayed: false,
      lifecycle: { store_id: storeId, phase: "active", revision: 5 },
    });
    mocks.close.mockResolvedValue({
      operation_id: "00000000-0000-4000-8000-000000000903",
      replayed: false,
      lifecycle: { store_id: storeId, phase: "closing", revision: 5 },
    });
    mocks.restore.mockResolvedValue({
      operation_id: "00000000-0000-4000-8000-000000000904",
      replayed: false,
      lifecycle: { store_id: storeId, phase: "active", revision: 5 },
    });
    mocks.clearTenantCache.mockResolvedValue(undefined);
    mocks.refreshStoreContext.mockResolvedValue(undefined);
  });

  it("binds a full workspace rename to the current store UUID and lifecycle revision", async () => {
    renderActions();
    await screen.findByText("当前阶段：正常营业");

    fireEvent.change(screen.getByLabelText("新工作区名称"), {
      target: { value: "Chinatech Floridia" },
    });
    fireEvent.click(screen.getByRole("button", { name: "安全重命名" }));

    await waitFor(() =>
      expect(mocks.issueChallenge).toHaveBeenCalledWith({
        expectedStoreId: storeId,
        expectedRevision: 4,
        operationKind: "rename",
      }),
    );
    expect(mocks.rename).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedStoreId: storeId,
        expectedRevision: 4,
        reauthChallengeId: "00000000-0000-4000-8000-000000000901",
        name: "Chinatech Floridia",
        syncCustomerFacingName: true,
      }),
    );
  });

  it("keeps close disabled until both the exact name and UUID suffix match", async () => {
    renderActions(eligiblePreflight());
    await screen.findByText("当前阶段：正常营业");
    const closeButton = screen.getByRole("button", { name: "确认进入关闭流程" });
    expect(closeButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("输入当前工作区名称确认关闭"), {
      target: { value: store.name },
    });
    fireEvent.change(screen.getByLabelText("输入店铺 UUID 尾号确认关闭"), {
      target: { value: "0000cafe" },
    });
    expect(closeButton).toBeEnabled();
    fireEvent.click(closeButton);

    await waitFor(() =>
      expect(mocks.close).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedStoreId: storeId,
          expectedRevision: 4,
          preflightSnapshotHash: "a".repeat(64),
          confirmationStoreName: store.name,
          confirmationStoreIdSuffix: "0000cafe",
          reasonCode: "duplicate_store",
        }),
      ),
    );
    expect(mocks.clearTenantCache).toHaveBeenCalledTimes(1);
  });
});

function renderActions(preflight?: StoreLifecyclePreflight) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StoreLifecycleActions store={store} preflight={preflight} />
    </QueryClientProvider>,
  );
}

function eligiblePreflight(): StoreLifecyclePreflight {
  return {
    id: "00000000-0000-4000-8000-000000000905",
    store_id: storeId,
    store_name: store.name,
    lifecycle: { store_id: storeId, phase: "active", revision: 4 },
    state: "eligible",
    counts: {},
    blockers: [],
    snapshot_hash: "a".repeat(64),
    expires_at: "2099-01-01T00:00:00.000Z",
  };
}
