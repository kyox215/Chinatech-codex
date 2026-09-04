import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { NavigationGuardProvider } from "@/components/navigation-guard-provider";
import type { MemoListResult, StoreMemo } from "@/features/memos/model/contracts";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";

import { MemosScreen } from "./memos-screen";

const api = vi.hoisted(() => ({
  listMemos: vi.fn(),
  listMemoAssignees: vi.fn(),
  getMemo: vi.fn(),
  createMemo: vi.fn(),
  updateMemo: vi.fn(),
  transitionMemo: vi.fn(),
  archiveMemo: vi.fn(),
  restoreMemo: vi.fn(),
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
      expect(await screen.findByText("DYNAMIC 北店 memo")).toBeVisible();
      expect(screen.getAllByPlaceholderText(search).length).toBeGreaterThan(0);
      expect(screen.getByText(today)).toBeVisible();
      expect(screen.getByText(status)).toBeVisible();
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
    await screen.findByText("DYNAMIC 北店 memo");
    const searchInput = screen.getAllByPlaceholderText("搜索备忘录")[0];
    fireEvent.change(searchInput, { target: { value: "DYNAMIC 北店" } });
    act(() => setTestLocale("it-IT"));
    expect(screen.getAllByPlaceholderText("Cerca promemoria")[0]).toHaveValue("DYNAMIC 北店");
    expect(api.createMemo).not.toHaveBeenCalled();
    expect(api.updateMemo).not.toHaveBeenCalled();
    expect(api.transitionMemo).not.toHaveBeenCalled();
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
});

function renderTree(locale: "zh-CN" | "it-IT" | "en", switches = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <LocaleProvider initialLocale={locale}>
      <QueryClientProvider client={client}>
        <SidebarProvider>
          <NavigationGuardProvider>
            {switches ? <LocaleCapture /> : null}
            <MemosScreen />
          </NavigationGuardProvider>
        </SidebarProvider>
      </QueryClientProvider>
    </LocaleProvider>,
  );
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
    capabilities: {
      canEdit: true,
      canClaim: false,
      canTransition: true,
      canArchive: true,
      canRestore: false,
    },
  };
}
