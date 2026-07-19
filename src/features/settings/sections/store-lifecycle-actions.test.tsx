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
  getOperation: vi.fn(),
  issueChallenge: vi.fn(),
  close: vi.fn(),
  clearTenantCache: vi.fn(),
  refreshStoreContext: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

vi.mock("@/lib/repairdesk/api", () => ({
  getStoreLifecycleState: mocks.getState,
  getStoreLifecycleOperationStatus: mocks.getOperation,
  issueStoreLifecycleChallenge: mocks.issueChallenge,
  requestStoreClose: mocks.close,
}));

vi.mock("@/features/stores/api/tenant-cache", () => ({
  clearTenantScopedQueryCache: mocks.clearTenantCache,
  refreshStoreContextQueries: mocks.refreshStoreContext,
}));

describe("StoreLifecycleActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    mocks.getState.mockResolvedValue({ store_id: storeId, phase: "active", revision: 4 });
    mocks.issueChallenge.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000901",
      store_id: storeId,
      operation_kind: "request_close",
      lifecycle_revision: 4,
      assurance_level: "aal2",
      expires_at: "2099-01-01T00:00:00.000Z",
    });
    mocks.close.mockResolvedValue({
      operation_id: "00000000-0000-4000-8000-000000000903",
      replayed: false,
      lifecycle: { store_id: storeId, phase: "closing", revision: 5 },
      active_store_cleared: true,
    });
    mocks.clearTenantCache.mockResolvedValue(undefined);
    mocks.refreshStoreContext.mockResolvedValue(undefined);
  });

  it("starts with one beginner-safe check action and no permanent confirmation fields", () => {
    const onRunPreflight = vi.fn();
    renderActions({ onRunPreflight });

    expect(screen.getByRole("button", { name: "检查是否可以关闭" })).toBeInTheDocument();
    expect(screen.queryByLabelText("店铺识别码最后 8 位")).not.toBeInTheDocument();
    expect(screen.queryByText(/永久清除/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "检查是否可以关闭" }));
    expect(onRunPreflight).toHaveBeenCalledTimes(1);
  });

  it("uses the shown identifier suffix and sends the bound store name without asking to type it", async () => {
    renderActions({ preflight: eligiblePreflight() });
    expect(await screen.findByText("可以继续关闭")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "继续关闭" }));

    expect(screen.getByText(storeId)).toBeInTheDocument();
    const confirmButton = screen.getByRole("button", { name: "确认关闭这家店（可恢复）" });
    expect(confirmButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("店铺识别码最后 8 位"), {
      target: { value: "0000cafe" },
    });
    fireEvent.click(
      screen.getByLabelText(
        "我明白这是可恢复关闭，不是永久删除；旧邀请和客户 iPad 权限不会自动恢复。",
      ),
    );
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(mocks.close).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedStoreId: storeId,
          expectedRevision: 4,
          preflightSnapshotHash: "a".repeat(64),
          confirmationStoreName: store.name,
          confirmationStoreIdSuffix: "0000cafe",
          reasonCode: "business_closed",
          operationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        }),
      ),
    );
    expect(mocks.clearTenantCache).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith("/settings/closed-stores");
  });

  it("does not render confirmation identifiers when the server capability denies close", () => {
    renderActions({
      capability: { allowed: false, code: "primary_owner_required" },
      preflight: eligiblePreflight(),
    });
    expect(screen.getByText("只有系统登记的店铺主账号可以关闭店铺。")).toBeInTheDocument();
    expect(screen.queryByText(storeId)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "继续关闭" })).not.toBeInTheDocument();
  });
});

function renderActions({
  capability = { allowed: true, code: "available" },
  preflight,
  onRunPreflight = vi.fn(),
}: {
  capability?: { allowed: boolean; code: "available" | "primary_owner_required" };
  preflight?: StoreLifecyclePreflight;
  onRunPreflight?: () => void;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StoreLifecycleActions
        store={store}
        capability={capability}
        preflight={preflight}
        isPreflighting={false}
        onRunPreflight={onRunPreflight}
      />
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
    automatic_effects: { pending_invitations: 1, open_kiosk_sessions: 2 },
    snapshot_hash: "a".repeat(64),
    expires_at: "2099-01-01T00:00:00.000Z",
  };
}
