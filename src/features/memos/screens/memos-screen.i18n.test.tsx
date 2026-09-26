import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { NavigationGuardProvider } from "@/components/navigation-guard-provider";
import type { MemoListResult, StoreMemo } from "@/features/memos/model/contracts";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";

import { MemosScreen } from "./memos-screen";
import { memosKeys } from "@/features/memos/api";

const api = vi.hoisted(() => ({
  listMemos: vi.fn(),
  listMemoAssignees: vi.fn(),
  getMemo: vi.fn(),
  createMemo: vi.fn(),
  updateMemo: vi.fn(),
  transitionMemo: vi.fn(),
  archiveMemo: vi.fn(),
  restoreMemo: vi.fn(),
  updateMemoChecklistItem: vi.fn(),
}));
const shell = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(location.search),
}));
vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: () => shell.value,
}));
vi.mock("@/lib/repairdesk/api", async (original) => ({
  ...(await original<typeof import("@/lib/repairdesk/api")>()),
  ...api,
}));

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  shell.value = {
    isLoading: false,
    activeStore: { id: "store-a", role: "owner" },
    permissions: { canReadMemos: true, canCreateMemos: true, canManageMemos: true },
  };
  api.listMemos.mockResolvedValue(listFixture());
  api.listMemoAssignees.mockResolvedValue([
    { membershipId: "member-a", displayName: "Mario 北店", role: "owner" },
  ]);
  api.getMemo.mockResolvedValue(memoFixture());
});

afterEach(() => {
  cleanup();
  document.cookie = "repairdesk_locale=; Max-Age=0; path=/";
});

describe("MemosScreen localization", () => {
  it.each([
    ["zh-CN" as const, "搜索备忘录", "今天", "待处理", "新建备忘", "关闭备忘录"],
    [
      "it-IT" as const,
      "Cerca promemoria",
      "Oggi",
      "Da fare",
      "Nuovo promemoria",
      "Chiudi promemoria",
    ],
    ["en" as const, "Search memos", "Today", "Pending", "New memo", "Close memo"],
  ])(
    "localizes fixed list UI in %s and preserves dynamic bytes",
    async (locale, search, today, status, newMemo, closeMemo) => {
      renderTree(locale);
      expect((await screen.findAllByText("DYNAMIC 北店 memo")).length).toBeGreaterThan(0);
      expect(screen.getAllByPlaceholderText(search).length).toBeGreaterThan(0);
      expect(screen.getByText(today)).toBeVisible();
      expect(screen.getAllByText(status).length).toBeGreaterThan(0);
      fireEvent.click(screen.getAllByRole("button", { name: newMemo })[0]);
      expect(screen.getByRole("button", { name: closeMemo })).toBeVisible();
      expect(api.listMemos.mock.calls[0]?.[0]).toEqual({
        view: "active",
        kind: "all",
        pageSize: 20,
        page: 1,
      });
    },
  );

  it("keeps search and filter state while switching locale without a business action", async () => {
    renderTree("zh-CN", true);
    await screen.findAllByText("DYNAMIC 北店 memo");
    const searchInput = screen.getAllByPlaceholderText("搜索备忘录")[0];
    fireEvent.change(searchInput, { target: { value: "DYNAMIC 北店" } });
    act(() => setTestLocale("it-IT"));
    expect(screen.getAllByPlaceholderText("Cerca promemoria")[0]).toHaveValue("DYNAMIC 北店");
    expect(api.createMemo).not.toHaveBeenCalled();
    expect(api.updateMemo).not.toHaveBeenCalled();
    expect(api.transitionMemo).not.toHaveBeenCalled();
  });

  it("puts the three frequent status scopes beside mobile search and requests the selected scope", async () => {
    renderTree("en");
    await screen.findAllByText("DYNAMIC 北店 memo");

    expect(screen.getByRole("button", { name: "Current" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Pending" }));

    await waitFor(() => {
      expect(
        api.listMemos.mock.calls.some(
          ([input]) => input.view === "pending" && input.kind === "all" && input.pageSize === 20,
        ),
      ).toBe(true);
    });
    expect(screen.getByRole("button", { name: "Pending" })).toHaveAttribute("aria-pressed", "true");
  });

  it("localizes loading, denied and empty states", async () => {
    shell.value = { isLoading: true };
    const loading = renderTree("en");
    expect(screen.getByText("Loading memos")).toBeVisible();
    loading.unmount();
    shell.value = { isLoading: false, permissions: {} };
    const denied = renderTree("it-IT");
    expect(screen.getByText("Nessun negozio selezionato")).toBeVisible();
    denied.unmount();
    shell.value = {
      isLoading: false,
      activeStore: { id: "store-a", role: "owner" },
      permissions: { canReadMemos: true, canCreateMemos: true },
    };
    api.listMemos.mockResolvedValueOnce({ ...listFixture(), items: [], total: 0 });
    renderTree("en");
    expect(await screen.findByText("No memos yet")).toBeVisible();
  });

  it("expands a checklist in the list and persists the desired item state without opening editor", async () => {
    const detail = {
      ...memoFixture(),
      checklist: [
        {
          id: "60000000-0000-4000-8000-000000000001",
          text: "Open shutters",
          completed: false,
        },
      ],
      checklist_total: 1,
      checklist_completed: 0,
    };
    api.listMemos.mockResolvedValue({ ...listFixture(), items: [detail] });
    api.getMemo.mockResolvedValue(detail);
    api.updateMemoChecklistItem.mockResolvedValue({
      memo: {
        ...detail,
        checklist: [{ ...detail.checklist[0], completed: true }],
        checklist_completed: 1,
        todo_status: "completed",
        version: 4,
      },
      replayed: false,
      appliedVersion: 4,
    });
    renderTree("en");

    fireEvent.click(
      await screen.findByRole("button", { name: "Checklist progress: 0 of 1 complete" }),
    );
    const checkbox = await screen.findByRole("checkbox", {
      name: "Toggle checklist item: Open shutters",
    });
    expect(screen.queryByRole("button", { name: "Close memo" })).toBeNull();
    fireEvent.click(checkbox);

    await waitFor(() =>
      expect(api.updateMemoChecklistItem).toHaveBeenCalledWith({
        operationId: expect.any(String),
        id: detail.id,
        expectedVersion: 3,
        itemId: detail.checklist[0].id,
        completed: true,
      }),
    );
  });

  it("closes the old store editor immediately when the active store changes", async () => {
    const view = renderTree("en");
    fireEvent.click(await screen.findByRole("button", { name: /Open memo: DYNAMIC/ }));
    expect(await screen.findByRole("dialog")).toBeVisible();
    shell.value = {
      ...shell.value,
      activeStore: { id: "store-b", role: "owner" },
    };
    api.listMemos.mockResolvedValue({ ...listFixture(), items: [], total: 0 });
    view.rerenderScreen();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByText("No memos yet")).toBeVisible();
    expect(screen.queryByText("DYNAMIC 北店 memo")).not.toBeInTheDocument();
  });

  it("discards an old store's in-flight checklist result after switching stores", async () => {
    const detail = {
      ...memoFixture(),
      checklist: [
        {
          id: "60000000-0000-4000-8000-000000000001",
          text: "Private store A model",
          completed: false,
        },
      ],
      checklist_total: 1,
    };
    api.listMemos.mockResolvedValue({ ...listFixture(), items: [detail] });
    api.getMemo.mockResolvedValue(detail);
    let resolveWrite!: (value: unknown) => void;
    api.updateMemoChecklistItem.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveWrite = resolve;
        }),
    );
    const view = renderTree("en");
    fireEvent.click(
      await screen.findByRole("button", { name: "Checklist progress: 0 of 1 complete" }),
    );
    fireEvent.click(await screen.findByRole("checkbox", { name: /Private store A model/ }));
    await waitFor(() => expect(api.updateMemoChecklistItem).toHaveBeenCalledOnce());
    shell.value = { ...shell.value, activeStore: { id: "store-b", role: "owner" } };
    api.listMemos.mockResolvedValue({ ...listFixture(), items: [], total: 0 });
    view.rerenderScreen();
    view.client.removeQueries({ queryKey: memosKeys.store("store-a") });
    expect(screen.queryByText("Private store A model")).not.toBeInTheDocument();
    await act(async () =>
      resolveWrite({
        memo: { ...detail, version: 4, checklist_completed: 1 },
        replayed: false,
        appliedVersion: 4,
      }),
    );
    expect(await screen.findByText("No memos yet")).toBeVisible();
    expect(view.client.getQueryData(memosKeys.detail("store-a", detail.id))).toBeUndefined();
    expect(screen.queryByText("DYNAMIC 北店 memo")).not.toBeInTheDocument();
  });

  it("retains newer cached details when an older checklist success arrives late", async () => {
    const detail = {
      ...memoFixture(),
      checklist: [
        {
          id: "60000000-0000-4000-8000-000000000001",
          text: "Private store A model",
          completed: false,
        },
      ],
      checklist_total: 1,
    };
    api.listMemos.mockResolvedValue({ ...listFixture(), items: [detail] });
    api.getMemo.mockResolvedValue(detail);
    let resolveWrite!: (value: unknown) => void;
    api.updateMemoChecklistItem.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveWrite = resolve;
        }),
    );
    const view = renderTree("en");
    fireEvent.click(
      await screen.findByRole("button", { name: "Checklist progress: 0 of 1 complete" }),
    );
    fireEvent.click(await screen.findByRole("checkbox", { name: /Private store A model/ }));
    await waitFor(() => expect(api.updateMemoChecklistItem).toHaveBeenCalledOnce());
    const newer = { ...detail, title: "Newer remote edit", version: 5 };
    api.getMemo.mockResolvedValue(newer);
    api.listMemos.mockResolvedValue({ ...listFixture(), items: [newer] });
    act(() => view.client.setQueryData(memosKeys.detail("store-a", detail.id), newer));
    await act(async () =>
      resolveWrite({
        memo: { ...detail, version: 4, checklist_completed: 1 },
        replayed: false,
        appliedVersion: 4,
      }),
    );
    await waitFor(() =>
      expect(
        view.client.getQueryData<StoreMemo>(memosKeys.detail("store-a", detail.id))?.version,
      ).toBe(5),
    );
    expect(await screen.findByText("Newer remote edit")).toBeVisible();
  });
});

function renderTree(locale: "zh-CN" | "it-IT" | "en", switches = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <LocaleProvider initialLocale={locale}>
      <QueryClientProvider client={client}>
        <SidebarProvider>
          <NavigationGuardProvider>
            {switches ? <LocaleCapture /> : null}
            <MemosScreen />
          </NavigationGuardProvider>
        </SidebarProvider>
      </QueryClientProvider>
    </LocaleProvider>
  );
  const rendered = render(tree());
  return { ...rendered, client, rerenderScreen: () => rendered.rerender(tree()) };
}

let setTestLocale: (locale: "zh-CN" | "it-IT" | "en") => void = () => undefined;

function LocaleCapture() {
  const { setLocale } = useLocale();
  setTestLocale = setLocale;
  return null;
}

function listFixture(): MemoListResult {
  return {
    items: [memoFixture()],
    total: 1,
    page: 1,
    pageSize: 20,
    pageCount: 1,
    capabilities: {
      canRead: true,
      canCreate: true,
      canEditAny: true,
      canArchive: true,
      canAssignAny: true,
      membershipId: "member-a",
      role: "owner",
    },
  };
}

function memoFixture(): StoreMemo {
  return {
    id: "memo-a",
    store_id: "store-a",
    kind: "todo",
    title: "DYNAMIC 北店 memo",
    content: "DYNAMIC content 不翻译",
    checklist: [],
    todo_status: "pending",
    due_at: "2099-09-03T08:00:00.000Z",
    assignee_membership_id: "member-a",
    assignee_name: "Mario 北店",
    created_by_membership_id: "member-a",
    created_by_name_snapshot: "Mario 北店",
    updated_by_name_snapshot: "Mario 北店",
    completed_at: null,
    archived_at: null,
    version: 3,
    created_at: "2026-09-03T08:00:00.000Z",
    updated_at: "2026-09-03T08:00:00.000Z",
    checklist_total: 0,
    checklist_completed: 0,
    capabilities: {
      canEdit: true,
      canClaim: false,
      canTransition: true,
      canArchive: true,
      canRestore: false,
    },
  };
}
