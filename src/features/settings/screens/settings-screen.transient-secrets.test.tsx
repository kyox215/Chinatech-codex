import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { storesKeys } from "@/features/stores/api/query-keys";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import type { StoreContext, StoreSettings } from "@/lib/repairdesk/types";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NavigationGuardProvider } from "@/components/navigation-guard-provider";

import { SettingsScreen } from "./settings-screen";

const apiMocks = vi.hoisted(() => ({
  createStore: vi.fn(),
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
  switchStore: vi.fn(),
  updateAccountProfile: vi.fn(),
  updateStoreSettings: vi.fn(),
}));

const navigationMocks = vi.hoisted(() => ({
  search: "section=members",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => ({ push: navigationMocks.push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navigationMocks.search),
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
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => undefined;
  }
});

describe("SettingsScreen store-bound transient secrets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigationMocks.search = "section=members";
    navigationMocks.push.mockReset();
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
    apiMocks.switchStore.mockResolvedValue(storeContext("store-b", "Etna Phone Lab"));
    apiMocks.createStore.mockResolvedValue(storeContext("store-b", "Etna Phone Lab"));
    apiMocks.updateAccountProfile.mockImplementation(async (input: { display_name: string }) => ({
      userId: "owner-1",
      displayName: input.display_name,
      activeStore: storeContext("store-a", "Ripara Subito").activeStore,
      stores: storeContext("store-a", "Ripara Subito").stores,
      isPlatformAdmin: false,
    }));
    apiMocks.updateStoreSettings.mockImplementation(async (request) => ({
      ...storeSettings(request.expectedStoreId, request.input.store_name ?? "Ripara Subito"),
      ...request.input,
      updated_at: "2026-07-12T00:01:00.000Z",
    }));
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
        <NavigationGuardProvider>
          <SidebarProvider>
            <SettingsScreen />
          </SidebarProvider>
        </NavigationGuardProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "员工管理" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /邀请码/ }));
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

  it("never renders a previous store draft while the new store settings are pending", async () => {
    navigationMocks.search = "section=store";
    const pendingStoreB = deferred<StoreSettings>();
    apiMocks.getStoreSettings
      .mockResolvedValueOnce(storeSettings("store-a", "Ripara Subito"))
      .mockReturnValueOnce(pendingStoreB.promise);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <NavigationGuardProvider>
          <SidebarProvider>
            <SettingsScreen />
          </SidebarProvider>
        </NavigationGuardProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByDisplayValue("Ripara Subito")).toBeInTheDocument();

    await act(async () => {
      queryClient.setQueryData(storesKeys.context, storeContext("store-b", "Etna Phone Lab"));
    });

    expect(screen.queryByRole("textbox", { name: "店铺名" })).not.toBeInTheDocument();
    expect(document.querySelector('[data-ui="settings-section-loading"]')).toBeInTheDocument();

    await act(async () => {
      pendingStoreB.resolve(storeSettings("store-b", "Etna Phone Lab"));
      await pendingStoreB.promise;
    });

    expect(await screen.findByRole("textbox", { name: "店铺名" })).toHaveValue("Etna Phone Lab");
    expect(screen.queryByRole("textbox", { name: "店铺名" })).not.toHaveValue("Ripara Subito");
  });

  it("keeps blocked member deep links from issuing member-domain requests", async () => {
    apiMocks.getStoreContext.mockResolvedValue(
      storeContext("store-a", "Ripara Subito", {
        canListMembers: false,
        canInviteMembers: false,
        canManageMembers: false,
        canRevokeMembers: false,
        canReviewAccessRequests: true,
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <NavigationGuardProvider>
          <SidebarProvider>
            <SettingsScreen />
          </SidebarProvider>
        </NavigationGuardProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("无法打开员工")).toBeInTheDocument();
    expect(apiMocks.getStoreMembers).not.toHaveBeenCalled();
    expect(apiMocks.listStoreAccessRequests).not.toHaveBeenCalled();
    expect(apiMocks.getOnboardingStatus).not.toHaveBeenCalled();
  });

  it("submits only the active section and ignores a rapid duplicate save", async () => {
    navigationMocks.search = "section=store";
    const pending = deferred<StoreSettings>();
    apiMocks.updateStoreSettings.mockReturnValueOnce(pending.promise);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <NavigationGuardProvider>
          <SidebarProvider>
            <SettingsScreen />
          </SidebarProvider>
        </NavigationGuardProvider>
      </QueryClientProvider>,
    );

    const nameInput = await screen.findByLabelText("店铺名");
    await user.clear(nameInput);
    await user.type(nameInput, "Etna Repair Lab");
    const saveBar = document.querySelector<HTMLElement>("[data-settings-save-bar]");
    expect(saveBar).not.toBeNull();
    const saveButton = within(saveBar!).getByRole("button", { name: "保存设置" });
    await waitFor(() => {
      expect(saveBar).toHaveAttribute("data-save-status", "dirty");
      expect(saveButton).toBeEnabled();
    });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    await waitFor(() => expect(apiMocks.updateStoreSettings).toHaveBeenCalledTimes(1));
    expect(apiMocks.updateStoreSettings).toHaveBeenCalledWith({
      section: "store",
      expectedStoreId: "store-a",
      expectedUpdatedAt: "2026-07-12T00:00:00.000Z",
      input: {
        store_name: "Etna Repair Lab",
        store_address: "Via Roma 12",
        store_phone: "",
        store_whatsapp: "",
        store_email: "",
      },
    });

    await act(async () => {
      pending.resolve({
        ...storeSettings("store-a", "Etna Repair Lab"),
        updated_at: "2026-07-12T00:01:00.000Z",
      });
      await pending.promise;
    });
    await waitFor(() => expect(saveBar).toHaveAttribute("data-save-status", "saved"));
  });

  it("preserves local input and exposes conflict recovery after a background update", async () => {
    navigationMocks.search = "section=store";
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <NavigationGuardProvider>
          <SidebarProvider>
            <SettingsScreen />
          </SidebarProvider>
        </NavigationGuardProvider>
      </QueryClientProvider>,
    );

    const nameInput = await screen.findByLabelText("店铺名");
    await user.clear(nameInput);
    await user.type(nameInput, "Local Draft");
    await act(async () => {
      queryClient.setQueryData(messageSettingsKeys.storeScoped("store-a"), {
        ...storeSettings("store-a", "Server Version"),
        updated_at: "2026-07-12T00:02:00.000Z",
      });
    });

    expect(screen.getByDisplayValue("Local Draft")).toBeInTheDocument();
    expect(await screen.findByText("检测到设置版本冲突")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "使用服务器版本" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "基于最新版继续编辑" })).toBeInTheDocument();
  });

  it("saves every dirty section in sequence before continuing navigation", async () => {
    navigationMocks.search = "section=store";
    let server = storeSettings("store-a", "Ripara Subito");
    let version = 0;
    apiMocks.updateStoreSettings.mockImplementation(async (request) => {
      version += 1;
      server = {
        ...server,
        ...request.input,
        updated_at: `2026-07-12T00:0${version}:00.000Z`,
      };
      return server;
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    const view = render(settingsTree(queryClient));

    const nameInput = await screen.findByLabelText("店铺名");
    await user.clear(nameInput);
    await user.type(nameInput, "Local Store Name");
    navigationMocks.search = "section=notifications";
    view.rerender(settingsTree(queryClient));
    const footer = await screen.findByLabelText("打印页脚");
    await user.clear(footer);
    await user.type(footer, "Local Footer");

    await user.click(
      within(screen.getByRole("navigation", { name: "设置导航" })).getByRole("link", {
        name: /默认规则|规则/,
      }),
    );
    const guard = await screen.findByRole("alertdialog", { name: "当前设置尚未保存" });
    expect(guard).toHaveTextContent("2 个设置分组");
    await user.click(within(guard).getByRole("button", { name: "保存并继续" }));

    await waitFor(() => expect(apiMocks.updateStoreSettings).toHaveBeenCalledTimes(2));
    expect(apiMocks.updateStoreSettings.mock.calls[0]?.[0]).toMatchObject({
      section: "notifications",
      expectedUpdatedAt: "2026-07-12T00:00:00.000Z",
      input: { print_footer: "Local Footer" },
    });
    expect(apiMocks.updateStoreSettings.mock.calls[1]?.[0]).toMatchObject({
      section: "store",
      expectedUpdatedAt: "2026-07-12T00:01:00.000Z",
      input: { store_name: "Local Store Name" },
    });
    await waitFor(() =>
      expect(navigationMocks.push).toHaveBeenCalledWith("/settings?section=rules", {
        scroll: false,
      }),
    );
  });

  it("keeps remaining dirty sections and blocks navigation when a later save fails", async () => {
    navigationMocks.search = "section=store";
    const firstResult = {
      ...storeSettings("store-a", "Ripara Subito"),
      print_footer: "Local Footer",
      updated_at: "2026-07-12T00:01:00.000Z",
    };
    apiMocks.updateStoreSettings
      .mockResolvedValueOnce(firstResult)
      .mockRejectedValueOnce(new Error("second section failed"));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    const view = render(settingsTree(queryClient));

    const nameInput = await screen.findByLabelText("店铺名");
    await user.clear(nameInput);
    await user.type(nameInput, "Still Dirty Store");
    navigationMocks.search = "section=notifications";
    view.rerender(settingsTree(queryClient));
    const footer = await screen.findByLabelText("打印页脚");
    await user.clear(footer);
    await user.type(footer, "Local Footer");
    await user.click(
      within(screen.getByRole("navigation", { name: "设置导航" })).getByRole("link", {
        name: /默认规则|规则/,
      }),
    );
    const guard = await screen.findByRole("alertdialog", { name: "当前设置尚未保存" });
    await user.click(within(guard).getByRole("button", { name: "保存并继续" }));

    await waitFor(() => expect(apiMocks.updateStoreSettings).toHaveBeenCalledTimes(2));
    expect(navigationMocks.push).not.toHaveBeenCalled();
    navigationMocks.search = "section=store";
    view.rerender(settingsTree(queryClient));
    expect(await screen.findByDisplayValue("Still Dirty Store")).toBeInTheDocument();
    expect(document.querySelector("[data-settings-save-bar]")).toHaveAttribute(
      "data-save-status",
      "error",
    );
  });

  it("discards every dirty section once before continuing navigation", async () => {
    navigationMocks.search = "section=store";
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    const view = render(settingsTree(queryClient));

    const nameInput = await screen.findByLabelText("店铺名");
    await user.clear(nameInput);
    await user.type(nameInput, "Discarded Store");
    navigationMocks.search = "section=notifications";
    view.rerender(settingsTree(queryClient));
    const footer = await screen.findByLabelText("打印页脚");
    await user.clear(footer);
    await user.type(footer, "Discarded Footer");
    await user.click(
      within(screen.getByRole("navigation", { name: "设置导航" })).getByRole("link", {
        name: /默认规则|规则/,
      }),
    );
    const guard = await screen.findByRole("alertdialog", { name: "当前设置尚未保存" });
    await user.click(within(guard).getByRole("button", { name: "放弃修改" }));

    expect(apiMocks.updateStoreSettings).not.toHaveBeenCalled();
    await waitFor(() => expect(navigationMocks.push).toHaveBeenCalledTimes(1));
    navigationMocks.search = "section=store";
    view.rerender(settingsTree(queryClient));
    expect(await screen.findByRole("textbox", { name: "店铺名" })).toHaveValue("Ripara Subito");
    navigationMocks.search = "section=notifications";
    view.rerender(settingsTree(queryClient));
    expect(
      await screen.findByDisplayValue("Grazie per aver scelto Ripara Subito."),
    ).toBeInTheDocument();
  });

  it("keeps the current settings draft mounted when store switch or creation fails", async () => {
    navigationMocks.search = "section=store";
    const context = storeContext("store-a", "Ripara Subito");
    const otherStore = storeContext("store-b", "Etna Phone Lab").activeStore!;
    context.stores = [context.activeStore!, otherStore];
    apiMocks.getStoreContext.mockResolvedValue(context);
    apiMocks.switchStore.mockRejectedValueOnce(new Error("switch failed"));
    apiMocks.createStore.mockRejectedValueOnce(new Error("create failed"));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    render(settingsTree(queryClient));

    const nameInput = await screen.findByLabelText("店铺名");
    await user.click(screen.getByLabelText("当前店铺"));
    await user.click(await screen.findByRole("option", { name: "Etna Phone Lab" }));
    await waitFor(() => expect(apiMocks.switchStore).toHaveBeenCalledTimes(1));
    expect(apiMocks.switchStore.mock.calls[0]?.[0]).toBe("store-b");
    expect(nameInput).toHaveValue("Ripara Subito");

    await user.type(screen.getByLabelText("新增店铺"), "Failed Store");
    await user.click(screen.getByRole("button", { name: "新建" }));
    await waitFor(() => expect(apiMocks.createStore).toHaveBeenCalledTimes(1));
    expect(apiMocks.createStore.mock.calls[0]?.[0]).toEqual({ name: "Failed Store" });
    expect(nameInput).toHaveValue("Ripara Subito");
  });

  it("guards the account display-name draft before settings navigation", async () => {
    navigationMocks.search = "section=account";
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    render(settingsTree(queryClient));

    const displayName = await screen.findByLabelText("显示名称");
    await user.clear(displayName);
    await user.type(displayName, "New Owner Name");
    await user.click(
      within(screen.getByRole("navigation", { name: "设置导航" })).getByRole("link", {
        name: /店铺/,
      }),
    );
    const guard = await screen.findByRole("alertdialog", { name: "当前设置尚未保存" });
    expect(guard).toHaveTextContent("账号显示名称");
    await user.click(within(guard).getByRole("button", { name: "保存并继续" }));

    await waitFor(() => expect(apiMocks.updateAccountProfile).toHaveBeenCalledTimes(1));
    expect(apiMocks.updateAccountProfile).toHaveBeenCalledWith({
      display_name: "New Owner Name",
    });
    await waitFor(() => expect(navigationMocks.push).toHaveBeenCalledTimes(1));
  });

  it("treats an empty account name as dirty but blocks invalid save-and-leave", async () => {
    navigationMocks.search = "section=account";
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    render(settingsTree(queryClient));

    const displayName = await screen.findByLabelText("显示名称");
    await user.clear(displayName);
    const storeLink = within(screen.getByRole("navigation", { name: "设置导航" })).getByRole(
      "link",
      { name: /店铺/ },
    );
    await user.click(storeLink);
    const guard = await screen.findByRole("alertdialog", { name: "当前设置尚未保存" });
    await user.click(within(guard).getByRole("button", { name: "保存并继续" }));

    await waitFor(() => expect(displayName).toHaveFocus());
    expect(apiMocks.updateAccountProfile).not.toHaveBeenCalled();
    expect(navigationMocks.push).not.toHaveBeenCalled();

    await user.click(storeLink);
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "放弃修改" }),
    );
    await waitFor(() => expect(navigationMocks.push).toHaveBeenCalledTimes(1));
  });
});

function settingsTree(queryClient: QueryClient) {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationGuardProvider>
        <SidebarProvider>
          <SettingsScreen />
        </SidebarProvider>
      </NavigationGuardProvider>
    </QueryClientProvider>
  );
}

function storeContext(
  id: string,
  name: string,
  permissionOverrides: Partial<NonNullable<StoreContext["permissions"]>> = {},
): StoreContext {
  const activeStore = {
    id,
    membershipId: `membership-${id}`,
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
      canReadStoreSettings: true,
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
      ...permissionOverrides,
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
