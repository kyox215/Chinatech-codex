import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActorStoreMembership } from "@/lib/repairdesk/types";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

import { StoreRenameOverlay } from "./store-rename-overlay";

const store: ActorStoreMembership = {
  id: "00000000-0000-4000-8000-00000000cafe",
  name: "Officina Dinamica",
  slug: "officina-dinamica",
  role: "owner",
  status: "active",
};

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  issueChallenge: vi.fn(),
  rename: vi.fn(),
  refreshContext: vi.fn(),
}));

vi.mock("@/lib/repairdesk/api", () => ({
  getStoreLifecycleState: mocks.getState,
  issueStoreLifecycleChallenge: mocks.issueChallenge,
  renameStoreWorkspace: mocks.rename,
}));

vi.mock("@/features/settings/model/store-lifecycle-mfa", () => ({
  lifecycleMfaRequired: () => false,
  verifyRecentLifecycleAal2: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/stores/api/tenant-cache", () => ({
  refreshStoreContextQueries: mocks.refreshContext,
}));

describe("StoreRenameOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getState.mockResolvedValue({ store_id: store.id, phase: "active", revision: 4 });
    mocks.issueChallenge.mockResolvedValue({ id: "challenge-1" });
    mocks.rename.mockResolvedValue({
      operation_id: "operation-1",
      replayed: false,
      lifecycle: { store_id: store.id, phase: "active", revision: 5 },
    });
    mocks.refreshContext.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it.each([
    ["zh-CN" as const, "修改名称", "新名称", "确认修改名称"],
    ["it-IT" as const, "Modifica nome", "Nuovo nome", "Conferma nuovo nome"],
    ["en" as const, "Rename", "New name", "Confirm rename"],
  ])(
    "keeps the canonical rename body locale-free in %s",
    async (locale, openLabel, inputLabel, submitLabel) => {
      renderOverlay(locale);
      fireEvent.click(screen.getByRole("button", { name: openLabel }));
      const input = await screen.findByLabelText(inputLabel);
      expect(screen.getByText(store.name)).toBeVisible();
      fireEvent.change(input, { target: { value: "  Nuova Officina  " } });
      const submit = screen.getByRole("button", { name: submitLabel });
      await waitFor(() => expect(submit).toBeEnabled());
      fireEvent.click(submit);

      await waitFor(() => expect(mocks.rename).toHaveBeenCalledTimes(1));
      expect(mocks.rename).toHaveBeenCalledWith({
        expectedStoreId: store.id,
        expectedRevision: 4,
        operationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        reauthChallengeId: "challenge-1",
        name: "Nuova Officina",
        syncCustomerFacingName: true,
      });
    },
  );

  it("takes the same-tick lock before the asynchronous challenge and hides raw failures", async () => {
    let resolveChallenge!: (value: { id: string }) => void;
    mocks.issueChallenge.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveChallenge = resolve;
        }),
    );
    mocks.rename.mockRejectedValue(new Error("RAW_DATABASE_DIAGNOSTIC"));
    renderOverlay("en");
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(await screen.findByLabelText("New name"), {
      target: { value: "Nuova Officina" },
    });
    const submit = screen.getByRole("button", { name: "Confirm rename" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.issueChallenge).toHaveBeenCalledTimes(1));

    await act(async () => resolveChallenge({ id: "challenge-1" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not rename the store");
    expect(screen.queryByText("RAW_DATABASE_DIAGNOSTIC")).not.toBeInTheDocument();
    expect(mocks.rename).toHaveBeenCalledTimes(1);
  });
});

function renderOverlay(locale: AppLocale) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <LocaleProvider initialLocale={locale}>
      <QueryClientProvider client={queryClient}>
        <StoreRenameOverlay
          store={store}
          capability={{ allowed: true, code: "available" }}
          hasUnsavedProfileDraft={false}
        />
      </QueryClientProvider>
    </LocaleProvider>,
  );
}
