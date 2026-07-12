import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { storesKeys } from "@/features/stores/api/query-keys";
import type { StoreContext, StoreSettings } from "@/lib/repairdesk/types";
import { SidebarProvider } from "@/components/ui/sidebar";

import { SettingsScreen } from "./settings-screen";

const apiMocks = vi.hoisted(() => ({
  createStoreInviteLink: vi.fn(),
  getOnboardingStatus: vi.fn(),
  getStoreContext: vi.fn(),
  getStoreMembers: vi.fn(),
  getStoreSettings: vi.fn(),
  listKioskDevices: vi.fn(),
  listKioskSessions: vi.fn(),
  listOrderWorkflow: vi.fn(),
  listStoreAccessRequests: vi.fn(),
  listSuppliers: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("section=members"),
}));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  ...apiMocks,
}));

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("SettingsScreen store-bound transient secrets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getStoreContext.mockResolvedValue(storeContext("store-a", "Ripara Subito"));
    apiMocks.getStoreSettings.mockResolvedValue(storeSettings("store-a", "Ripara Subito"));
    apiMocks.getStoreMembers.mockResolvedValue({
      members: [],
      invitations: [],
      invite_links: [],
    });
    apiMocks.listStoreAccessRequests.mockResolvedValue([]);
    apiMocks.listOrderWorkflow.mockResolvedValue({ statuses: [], transitions: [] });
    apiMocks.listKioskDevices.mockResolvedValue([]);
    apiMocks.listKioskSessions.mockResolvedValue([]);
    apiMocks.listSuppliers.mockResolvedValue([]);
    apiMocks.getOnboardingStatus.mockResolvedValue({
      userId: "owner-1",
      displayName: "Owner",
      activeStore: storeContext("store-a", "Ripara Subito").activeStore,
      stores: storeContext("store-a", "Ripara Subito").stores,
      isPlatformAdmin: false,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn() },
    });
  });

  it("drops a delayed invite code after the active store changes", async () => {
    const pending = deferred<Awaited<ReturnType<typeof apiMocks.createStoreInviteLink>>>();
    apiMocks.createStoreInviteLink.mockReturnValueOnce(pending.promise);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    const clipboardWrite = vi.spyOn(navigator.clipboard, "writeText");

    render(
      <QueryClientProvider client={queryClient}>
        <SidebarProvider>
          <SettingsScreen />
        </SidebarProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "员工管理" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /邀请码/ }));
    await user.click(screen.getByRole("button", { name: "生成" }));
    expect(apiMocks.createStoreInviteLink).toHaveBeenCalledTimes(1);

    await act(async () => {
      queryClient.setQueryData(storesKeys.context, storeContext("store-b", "Etna Phone Lab"));
    });
    await act(async () => {
      pending.resolve({
        code: "STORE-A-SECRET",
        link: {
          id: "link-a",
          store_id: "store-a",
          role: "viewer",
          status: "active",
          expires_at: "2099-07-13T00:00:00.000Z",
          used_count: 0,
          created_at: "2026-07-12T00:00:00.000Z",
          updated_at: "2026-07-12T00:00:00.000Z",
        },
      });
      await pending.promise;
    });

    await waitFor(() => {
      expect(screen.queryByText("STORE-A-SECRET")).not.toBeInTheDocument();
    });
    expect(clipboardWrite).not.toHaveBeenCalled();
  });
});

function storeContext(id: string, name: string): StoreContext {
  const activeStore = {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    role: "owner" as const,
    status: "active" as const,
  };
  return {
    activeStore,
    stores: [activeStore],
    permissions: {
      canReadSuppliers: true,
      canAssignSuppliers: true,
      canManageSuppliers: true,
      canManageOrderData: true,
      canApplyOrderData: true,
      canUpdateStoreSettings: true,
      canConfigureWorkflow: true,
      canUpdateMessageTemplates: true,
      canListMembers: true,
      canInviteMembers: true,
      canManageMembers: true,
      canRevokeMembers: true,
      canGrantManager: true,
      canReviewAccessRequests: true,
      canManageKioskDevices: true,
      canReviewKioskSessions: true,
    },
  };
}

function storeSettings(storeId: string, storeName: string): StoreSettings {
  return {
    id: `settings-${storeId}`,
    store_id: storeId,
    store_name: storeName,
    store_address: "Via Roma 12",
    store_phone: "",
    store_whatsapp: "",
    store_email: "",
    default_order_warranty_text: "6个月",
    default_order_warranty_months: 6,
    default_inventory_warranty_months: 12,
    print_footer: `Grazie per aver scelto ${storeName}.`,
    message_signature: storeName,
    created_at: "2026-07-12T00:00:00.000Z",
    updated_at: "2026-07-12T00:00:00.000Z",
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}
