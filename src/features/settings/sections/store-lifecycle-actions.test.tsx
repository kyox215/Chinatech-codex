import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActorStoreMembership, StoreLifecyclePreflight } from "@/lib/repairdesk/types";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

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
  mfaRequired: false,
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

vi.mock("@/features/settings/model/store-lifecycle-mfa", () => ({
  lifecycleMfaRequired: () => mocks.mfaRequired,
  verifyRecentLifecycleAal2: vi.fn().mockResolvedValue(undefined),
}));

describe("StoreLifecycleActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mfaRequired = false;
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

    await waitFor(() => expect(mocks.close).toHaveBeenCalledTimes(1));
    expect(mocks.close).toHaveBeenCalledWith({
      expectedStoreId: storeId,
      expectedRevision: 4,
      operationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      reauthChallengeId: "00000000-0000-4000-8000-000000000901",
      preflightSnapshotHash: "a".repeat(64),
      confirmationStoreName: store.name,
      confirmationStoreIdSuffix: "0000cafe",
      reasonCode: "business_closed",
    });
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

  it.each([
    ["zh-CN" as const, "只有系统登记的店铺主账号可以关闭店铺。"],
    ["it-IT" as const, "Solo il titolare principale registrato può chiudere il negozio."],
    ["en" as const, "Only the registered primary store owner can close it."],
  ])("localizes a stable denied capability in %s without domain IO", (locale, message) => {
    renderActions({
      locale,
      capability: { allowed: false, code: "primary_owner_required" },
      preflight: eligiblePreflight(),
    });
    expect(screen.getByText(message)).toBeVisible();
    expect(mocks.getState).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it("locks close before awaiting the lifecycle challenge", async () => {
    let resolveChallenge!: (value: { id: string }) => void;
    mocks.issueChallenge.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveChallenge = resolve;
        }),
    );
    renderActions({ preflight: eligiblePreflight() });
    fireEvent.click(await screen.findByRole("button", { name: "继续关闭" }));
    fireEvent.change(screen.getByLabelText("店铺识别码最后 8 位"), {
      target: { value: "0000cafe" },
    });
    fireEvent.click(
      screen.getByLabelText(
        "我明白这是可恢复关闭，不是永久删除；旧邀请和客户 iPad 权限不会自动恢复。",
      ),
    );
    const submit = screen.getByRole("button", { name: "确认关闭这家店（可恢复）" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.issueChallenge).toHaveBeenCalledTimes(1));
    await act(async () => resolveChallenge({ id: "challenge-close" }));
    await waitFor(() => expect(mocks.close).toHaveBeenCalledTimes(1));
  });

  it("preserves the close dialog, focused TOTP and canonical draft across locale changes without IO", async () => {
    mocks.mfaRequired = true;
    renderActions({ preflight: eligiblePreflight(), withLocaleSwitch: true });
    fireEvent.click(await screen.findByRole("button", { name: "继续关闭" }));
    fireEvent.change(screen.getByLabelText("店铺识别码最后 8 位"), {
      target: { value: "0000cafe" },
    });
    const totp = screen.getByLabelText("身份验证器中的 6 位安全验证码");
    fireEvent.change(totp, { target: { value: "123456" } });
    totp.focus();
    const lifecycleReads = mocks.getState.mock.calls.length;
    fireEvent.click(screen.getByTestId("switch-it"));

    expect(
      await screen.findByRole("dialog", { name: "Confermare la chiusura di Chinatech Siracusa?" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Ultime 8 cifre dell’identificativo")).toHaveValue("0000cafe");
    expect(screen.getByLabelText("Codice di sicurezza a 6 cifre dell’app di autenticazione")).toBe(
      totp,
    );
    expect(totp).toHaveValue("123456");
    expect(totp).toHaveFocus();
    expect(mocks.getState).toHaveBeenCalledTimes(lifecycleReads);
    expect(mocks.getOperation).not.toHaveBeenCalled();
    expect(mocks.issueChallenge).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });
});

function renderActions({
  capability = { allowed: true, code: "available" },
  preflight,
  onRunPreflight = vi.fn(),
  locale = "zh-CN",
  withLocaleSwitch = false,
}: {
  capability?: { allowed: boolean; code: "available" | "primary_owner_required" };
  preflight?: StoreLifecyclePreflight;
  onRunPreflight?: () => void;
  locale?: AppLocale;
  withLocaleSwitch?: boolean;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <LocaleProvider initialLocale={locale}>
      <QueryClientProvider client={queryClient}>
        {withLocaleSwitch ? <TestLocaleSwitch /> : null}
        <StoreLifecycleActions
          store={store}
          capability={capability}
          preflight={preflight}
          isPreflighting={false}
          onRunPreflight={onRunPreflight}
        />
      </QueryClientProvider>
    </LocaleProvider>,
  );
}

function TestLocaleSwitch() {
  const { setLocale } = useLocale();
  return (
    <button type="button" data-testid="switch-it" onClick={() => setLocale("it-IT")}>
      switch-it
    </button>
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
