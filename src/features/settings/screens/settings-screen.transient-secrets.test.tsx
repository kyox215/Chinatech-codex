import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { storesKeys } from "@/features/stores/api/query-keys";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import type { KioskSession, StoreContext, StoreSettings, Supplier } from "@/lib/repairdesk/types";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NavigationGuardProvider } from "@/components/navigation-guard-provider";
import { getMockAiAssistantUsageSummary } from "@/features/ai-assistant/testing/mock-usage";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

import { SettingsScreen } from "./settings-screen";

const apiMocks = vi.hoisted(() => ({
  approveStoreAccessRequest: vi.fn(),
  acceptKioskSession: vi.fn(),
  archiveSupplier: vi.fn(),
  createKioskDevicePairing: vi.fn(),
  createSupplier: vi.fn(),
  createStoreLifecyclePreflight: vi.fn(),
  createStore: vi.fn(),
  createStoreInviteLink: vi.fn(),
  disableStoreMember: vi.fn(),
  getOnboardingStatus: vi.fn(),
  getAiAssistantUsageSummary: vi.fn(),
  getStoreContext: vi.fn(),
  getStoreMembers: vi.fn(),
  getStoreSettings: vi.fn(),
  inviteStoreMember: vi.fn(),
  listKioskDevices: vi.fn(),
  listKioskSessions: vi.fn(),
  listOrderWorkflow: vi.fn(),
  listStoreAccessRequests: vi.fn(),
  listSuppliers: vi.fn(),
  rejectStoreAccessRequest: vi.fn(),
  returnKioskSession: vi.fn(),
  revokeKioskDevice: vi.fn(),
  restoreStoreMember: vi.fn(),
  revokeStoreInvitation: vi.fn(),
  revokeStoreInviteLink: vi.fn(),
  switchStore: vi.fn(),
  updateAccountProfile: vi.fn(),
  updateSupplier: vi.fn(),
  updateStoreMemberPermissions: vi.fn(),
  updateStoreMemberRole: vi.fn(),
  updateStoreSettings: vi.fn(),
}));

const navigationMocks = vi.hoisted(() => ({
  search: "section=members",
  push: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastMocks }));

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
    window.sessionStorage.clear();
    navigationMocks.search = "section=members";
    navigationMocks.push.mockReset();
    apiMocks.getStoreContext.mockResolvedValue(storeContext("store-a", "Ripara Subito"));
    apiMocks.getAiAssistantUsageSummary.mockResolvedValue(getMockAiAssistantUsageSummary());
    apiMocks.getStoreSettings.mockResolvedValue(storeSettings("store-a", "Ripara Subito"));
    apiMocks.getStoreMembers.mockResolvedValue({
      members: [],
      invitations: [],
      invite_links: [],
    });
    const emptyMembersResult = { members: [], invitations: [], invite_links: [] };
    apiMocks.inviteStoreMember.mockResolvedValue(emptyMembersResult);
    apiMocks.disableStoreMember.mockResolvedValue(emptyMembersResult);
    apiMocks.restoreStoreMember.mockResolvedValue(emptyMembersResult);
    apiMocks.revokeStoreInvitation.mockResolvedValue(emptyMembersResult);
    apiMocks.revokeStoreInviteLink.mockResolvedValue(emptyMembersResult);
    apiMocks.updateStoreMemberPermissions.mockResolvedValue(emptyMembersResult);
    apiMocks.updateStoreMemberRole.mockResolvedValue(emptyMembersResult);
    apiMocks.approveStoreAccessRequest.mockResolvedValue({
      id: "request-a",
      status: "approved",
    });
    apiMocks.rejectStoreAccessRequest.mockResolvedValue({
      id: "request-a",
      status: "rejected",
    });
    apiMocks.listStoreAccessRequests.mockResolvedValue([]);
    apiMocks.listOrderWorkflow.mockResolvedValue({ statuses: [], transitions: [] });
    apiMocks.listKioskDevices.mockResolvedValue([]);
    apiMocks.listKioskSessions.mockResolvedValue([]);
    apiMocks.revokeKioskDevice.mockResolvedValue({ id: "device-a", status: "revoked" });
    apiMocks.acceptKioskSession.mockResolvedValue({ id: "session-a", status: "accepted" });
    apiMocks.returnKioskSession.mockResolvedValue({ id: "session-a", status: "returned" });
    apiMocks.listSuppliers.mockResolvedValue([]);
    apiMocks.createSupplier.mockResolvedValue(supplierFixture());
    apiMocks.updateSupplier.mockResolvedValue(supplierFixture());
    apiMocks.archiveSupplier.mockResolvedValue({
      ...supplierFixture(),
      archived_at: "2026-07-13T00:00:00.000Z",
    });
    apiMocks.switchStore.mockResolvedValue(storeContext("store-b", "Etna Phone Lab"));
    apiMocks.createStore.mockResolvedValue(storeContext("store-b", "Etna Phone Lab"));
    apiMocks.createStoreLifecyclePreflight.mockResolvedValue({
      id: "preflight-a",
      store_id: "store-a",
      store_name: "Ripara Subito",
      lifecycle: { store_id: "store-a", phase: "active", revision: 2 },
      state: "eligible",
      counts: {},
      blockers: [],
      automatic_effects: { pending_invitations: 0, open_kiosk_sessions: 0 },
      snapshot_hash: "a".repeat(64),
      expires_at: "2099-01-01T00:00:00.000Z",
    });
    apiMocks.createKioskDevicePairing.mockResolvedValue({
      device: {
        id: "device-a",
        store_id: "store-a",
        label: "前台 iPad",
        status: "pairing",
        created_at: "2026-07-12T00:00:00.000Z",
        updated_at: "2026-07-12T00:00:00.000Z",
      },
      pairing_code: "STORE-A-CODE",
      expires_at: "2099-07-13T00:00:00.000Z",
    });
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

    expect(await screen.findByRole("heading", { name: "员工与权限" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /邀请码/ }));
    await user.click(screen.getByRole("button", { name: "生成当前店铺邀请码" }));
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
  }, 15_000);

  it("drops a delayed kiosk pairing response after the active store changes", async () => {
    navigationMocks.search = "section=kiosk";
    const pending = deferred<Awaited<ReturnType<typeof apiMocks.createKioskDevicePairing>>>();
    apiMocks.createKioskDevicePairing.mockReturnValueOnce(pending.promise);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    render(settingsTree(queryClient));

    await waitFor(() => expect(document.querySelector("#settings-kiosk")).not.toBeNull());
    const kioskSection = document.querySelector("#settings-kiosk");
    expect(kioskSection).not.toBeNull();
    expect(
      within(kioskSection as HTMLElement).getByRole("heading", { name: "客户 iPad" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: /生成配对码/ }));
    expect(apiMocks.createKioskDevicePairing).toHaveBeenCalledWith({ label: "前台 iPad" });

    await act(async () => {
      queryClient.setQueryData(storesKeys.context, storeContext("store-b", "Etna Phone Lab"));
    });
    await act(async () => {
      pending.resolve({
        device: {
          id: "device-a",
          store_id: "store-a",
          label: "前台 iPad",
          status: "pairing",
          created_at: "2026-07-12T00:00:00.000Z",
          updated_at: "2026-07-12T00:00:00.000Z",
        },
        pairing_code: "STORE-A-CODE",
        expires_at: "2099-07-13T00:00:00.000Z",
      });
      await pending.promise;
    });

    await waitFor(() => expect(screen.queryByText("STORE-A-CODE")).not.toBeInTheDocument());
    expect(screen.getAllByText(/Etna Phone Lab/).length).toBeGreaterThan(0);
  }, 15_000);

  it("guards and restores a kiosk return-reason draft across settings navigation", async () => {
    navigationMocks.search = "section=kiosk";
    apiMocks.listKioskSessions.mockResolvedValue([submittedKioskSession()]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    const view = render(settingsTree(queryClient));

    const reason = await screen.findByLabelText("给客户的退回原因");
    await user.type(reason, "请重新确认电话号码");
    const storeLink = within(screen.getByRole("navigation", { name: "设置导航" })).getByRole(
      "link",
      { name: "店铺" },
    );
    await user.click(storeLink);

    let guard = await screen.findByRole("alertdialog", { name: "当前设置尚未保存" });
    expect(guard).toHaveTextContent("客户 iPad 退回原因草稿");
    await user.click(within(guard).getByRole("button", { name: "取消" }));
    expect(reason).toHaveValue("请重新确认电话号码");

    await user.click(storeLink);
    guard = await screen.findByRole("alertdialog", { name: "当前设置尚未保存" });
    await user.click(within(guard).getByRole("button", { name: "保存并继续" }));

    await waitFor(() =>
      expect(navigationMocks.push).toHaveBeenCalledWith("/settings?section=store", {
        scroll: false,
      }),
    );
    expect(
      window.sessionStorage.getItem("repairdesk:settings:kiosk-return-drafts:store-a"),
    ).toContain("请重新确认电话号码");

    view.unmount();
    navigationMocks.search = "section=kiosk";
    const restoredClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(settingsTree(restoredClient));
    await waitFor(() =>
      expect(screen.getByLabelText("给客户的退回原因")).toHaveValue("请重新确认电话号码"),
    );
  }, 15_000);

  it("clears kiosk customer drafts and secret surfaces on same-store authority downgrade", async () => {
    navigationMocks.search = "section=kiosk";
    apiMocks.listKioskSessions.mockResolvedValue([submittedKioskSession()]);
    window.sessionStorage.setItem(
      "repairdesk:settings:kiosk-return-drafts:store-a",
      JSON.stringify({ "session-a:1": "PII_RETURN_DRAFT" }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(settingsTree(queryClient));

    expect(await screen.findByDisplayValue("PII_RETURN_DRAFT")).toBeVisible();
    expect(screen.getByText("Cliente Test")).toBeVisible();
    const reads = {
      devices: apiMocks.listKioskDevices.mock.calls.length,
      sessions: apiMocks.listKioskSessions.mock.calls.length,
    };
    const downgraded = storeContext("store-a", "Ripara Subito", {
      canManageKioskDevices: false,
      canReviewKioskSessions: false,
    });
    await act(async () => {
      queryClient.setQueryData(storesKeys.context, downgraded);
    });

    await waitFor(() => {
      expect(screen.queryByText("Cliente Test")).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue("PII_RETURN_DRAFT")).not.toBeInTheDocument();
      expect(
        window.sessionStorage.getItem("repairdesk:settings:kiosk-return-drafts:store-a"),
      ).toBeNull();
    });
    expect(apiMocks.listKioskDevices).toHaveBeenCalledTimes(reads.devices);
    expect(apiMocks.listKioskSessions).toHaveBeenCalledTimes(reads.sessions);
    expect(apiMocks.createKioskDevicePairing).not.toHaveBeenCalled();
  });

  it("routes all four kiosk production actions with exact locale-free payloads once", async () => {
    navigationMocks.search = "section=kiosk";
    const currentSession = submittedKioskSession();
    apiMocks.listKioskDevices.mockResolvedValue([currentSession.device]);
    apiMocks.listKioskSessions.mockResolvedValue([currentSession]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(settingsTree(queryClient));

    const pair = await screen.findByRole("button", { name: "生成配对码" });
    fireEvent.click(pair);
    fireEvent.click(pair);
    await waitFor(() => expect(apiMocks.createKioskDevicePairing).toHaveBeenCalledTimes(1));
    expect(apiMocks.createKioskDevicePairing).toHaveBeenCalledWith({ label: "前台 iPad" });

    fireEvent.click(screen.getByRole("button", { name: "撤销设备" }));
    let dialog = screen.getByRole("alertdialog", { name: "撤销这台客户 iPad？" });
    const revoke = within(dialog).getByRole("button", { name: "确认撤销" });
    fireEvent.click(revoke);
    fireEvent.click(revoke);
    await waitFor(() => expect(apiMocks.revokeKioskDevice).toHaveBeenCalledTimes(1));
    expect(apiMocks.revokeKioskDevice).toHaveBeenCalledWith("device-a");

    fireEvent.click(screen.getByRole("button", { name: "接受并更新" }));
    dialog = screen.getByRole("alertdialog", { name: "确认接受客户提交？" });
    const accept = within(dialog).getByRole("button", { name: "确认提交" });
    fireEvent.click(accept);
    fireEvent.click(accept);
    await waitFor(() => expect(apiMocks.acceptKioskSession).toHaveBeenCalledTimes(1));
    expect(apiMocks.acceptKioskSession).toHaveBeenCalledWith({
      id: "session-a",
      expected_submission_version: 1,
    });

    fireEvent.change(screen.getByLabelText("给客户的退回原因"), {
      target: { value: "请重新确认电话号码" },
    });
    fireEvent.click(screen.getByRole("button", { name: "退回重填" }));
    dialog = screen.getByRole("alertdialog", { name: "确认退回给客户重填？" });
    const returnAction = within(dialog).getByRole("button", { name: "确认提交" });
    fireEvent.click(returnAction);
    fireEvent.click(returnAction);
    await waitFor(() => expect(apiMocks.returnKioskSession).toHaveBeenCalledTimes(1));
    expect(apiMocks.returnKioskSession).toHaveBeenCalledWith({
      id: "session-a",
      expected_submission_version: 1,
      reason: "请重新确认电话号码",
    });
  });

  it.each([
    [
      "zh-CN",
      {
        add: "添加供应商",
        edit: "编辑",
        archive: "归档",
        confirmArchive: "确认归档",
        save: "保存供应商",
        name: "名称",
        shortName: "简称",
        contact: "联系人",
        phone: "电话",
        email: "邮箱",
        website: "网站",
        notes: "内部备注",
      },
    ],
    [
      "it-IT",
      {
        add: "Aggiungi fornitore",
        edit: "Modifica",
        archive: "Archivia",
        confirmArchive: "Conferma archiviazione",
        save: "Salva fornitore",
        name: "Nome",
        shortName: "Nome breve",
        contact: "Referente",
        phone: "Telefono",
        email: "Email",
        website: "Sito web",
        notes: "Note interne",
      },
    ],
    [
      "en",
      {
        add: "Add supplier",
        edit: "Edit",
        archive: "Archive",
        confirmArchive: "Confirm archive",
        save: "Save supplier",
        name: "Name",
        shortName: "Short name",
        contact: "Contact",
        phone: "Phone",
        email: "Email",
        website: "Website",
        notes: "Internal notes",
      },
    ],
  ] as const)(
    "routes all three supplier API consumers with exact locale-free payloads once in %s",
    async (locale, labels) => {
      navigationMocks.search = "section=suppliers";
      apiMocks.listSuppliers.mockResolvedValue([supplierFixture()]);
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      render(settingsTree(queryClient, locale));

      fireEvent.click(await screen.findByRole("button", { name: labels.add }));
      fireEvent.change(screen.getByLabelText(labels.name), {
        target: { value: "  Supplier API  " },
      });
      fireEvent.change(screen.getByLabelText(labels.shortName), { target: { value: " SUP " } });
      fireEvent.change(screen.getByLabelText(labels.contact), { target: { value: " Mario " } });
      fireEvent.change(screen.getByLabelText(labels.phone), { target: { value: " +39 333 " } });
      fireEvent.change(screen.getByLabelText(labels.email), {
        target: { value: " api@example.test " },
      });
      fireEvent.change(screen.getByLabelText(labels.website), {
        target: { value: " https://example.test " },
      });
      fireEvent.change(screen.getByLabelText(labels.notes), {
        target: { value: " Dynamic supplier note " },
      });
      let save = screen.getByRole("button", { name: labels.save });
      fireEvent.click(save);
      fireEvent.click(save);
      await waitFor(() => expect(apiMocks.createSupplier).toHaveBeenCalledTimes(1));
      expect(apiMocks.createSupplier).toHaveBeenCalledWith({
        name: "Supplier API",
        short_name: "SUP",
        color: "#2563eb",
        contact_name: "Mario",
        phone: "+39 333",
        email: "api@example.test",
        website: "https://example.test",
        notes: "Dynamic supplier note",
      });
      expect(apiMocks.createSupplier.mock.calls[0]?.[0]).not.toHaveProperty("locale");
      expect(apiMocks.updateSupplier).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByLabelText(labels.name)).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole("button", { name: labels.edit }));
      fireEvent.change(screen.getByLabelText(labels.name), {
        target: { value: "  MOBILAX API  " },
      });
      save = screen.getByRole("button", { name: labels.save });
      fireEvent.click(save);
      fireEvent.click(save);
      await waitFor(() => expect(apiMocks.updateSupplier).toHaveBeenCalledTimes(1));
      expect(apiMocks.updateSupplier).toHaveBeenCalledWith("supplier-1", {
        name: "MOBILAX API",
        short_name: "MOB",
        color: "#2563eb",
        contact_name: "Support",
        phone: "+39 0931 000000",
        email: "support@example.com",
        website: "https://example.com",
        notes: "Current store only",
      });
      expect(apiMocks.updateSupplier.mock.calls[0]?.[1]).not.toHaveProperty("locale");
      await waitFor(() => expect(screen.queryByLabelText(labels.name)).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole("button", { name: labels.archive }));
      const confirm = screen.getByRole("button", { name: labels.confirmArchive });
      fireEvent.click(confirm);
      fireEvent.click(confirm);
      await waitFor(() => expect(apiMocks.archiveSupplier).toHaveBeenCalledTimes(1));
      expect(apiMocks.archiveSupplier).toHaveBeenCalledWith("supplier-1");
    },
  );

  it.each([
    ["zh-CN", "添加供应商", "名称", "保存供应商", "供应商操作失败，请重试"],
    [
      "it-IT",
      "Aggiungi fornitore",
      "Nome",
      "Salva fornitore",
      "Operazione fornitore non riuscita. Riprova",
    ],
    ["en", "Add supplier", "Name", "Save supplier", "Supplier action failed. Try again"],
  ] as const)(
    "keeps a rejected supplier create draft safe and retryable in %s",
    async (locale, add, nameLabel, saveLabel, safeError) => {
      navigationMocks.search = "section=suppliers";
      apiMocks.createSupplier
        .mockRejectedValueOnce(new Error("RAW_SUPPLIER_CREATE_SENTINEL"))
        .mockResolvedValueOnce(supplierFixture());
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      render(settingsTree(queryClient, locale));

      fireEvent.click(await screen.findByRole("button", { name: add }));
      const name = screen.getByLabelText(nameLabel);
      fireEvent.change(name, { target: { value: "Retry Supplier" } });
      const save = screen.getByRole("button", { name: saveLabel });
      fireEvent.click(save);
      fireEvent.click(save);
      await waitFor(() => expect(apiMocks.createSupplier).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(document.body).toHaveTextContent(safeError));
      expect(document.body).not.toHaveTextContent("RAW_SUPPLIER_CREATE_SENTINEL");
      expect(name).toHaveValue("Retry Supplier");

      fireEvent.click(save);
      await waitFor(() => expect(apiMocks.createSupplier).toHaveBeenCalledTimes(2));
      expect(apiMocks.createSupplier.mock.calls[1]?.[0]).toEqual(
        apiMocks.createSupplier.mock.calls[0]?.[0],
      );
      await waitFor(() => expect(screen.queryByLabelText(nameLabel)).not.toBeInTheDocument());
    },
  );

  it("keeps rejected supplier update/archive dialogs safe and retryable", async () => {
    navigationMocks.search = "section=suppliers";
    apiMocks.listSuppliers.mockResolvedValue([supplierFixture()]);
    apiMocks.updateSupplier
      .mockRejectedValueOnce(new Error("RAW_SUPPLIER_UPDATE_SENTINEL"))
      .mockResolvedValueOnce(supplierFixture());
    apiMocks.archiveSupplier
      .mockRejectedValueOnce(new Error("RAW_SUPPLIER_ARCHIVE_SENTINEL"))
      .mockResolvedValueOnce({ ...supplierFixture(), archived_at: "2026-07-13T00:00:00.000Z" });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(settingsTree(queryClient, "en"));

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const name = screen.getByLabelText("Name");
    fireEvent.change(name, { target: { value: "MOBILAX Retry" } });
    const save = screen.getByRole("button", { name: "Save supplier" });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(apiMocks.updateSupplier).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(document.body).toHaveTextContent("Supplier action failed. Try again"),
    );
    expect(document.body).not.toHaveTextContent("RAW_SUPPLIER_UPDATE_SENTINEL");
    expect(name).toHaveValue("MOBILAX Retry");
    fireEvent.click(save);
    await waitFor(() => expect(apiMocks.updateSupplier).toHaveBeenCalledTimes(2));
    expect(apiMocks.updateSupplier.mock.calls[1]).toEqual(apiMocks.updateSupplier.mock.calls[0]);
    await waitFor(() => expect(screen.queryByLabelText("Name")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    let confirm = screen.getByRole("button", { name: "Confirm archive" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(apiMocks.archiveSupplier).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(document.body).toHaveTextContent("Supplier action failed. Try again"),
    );
    expect(document.body).not.toHaveTextContent("RAW_SUPPLIER_ARCHIVE_SENTINEL");
    expect(screen.getByRole("alertdialog", { name: "Archive MOBILAX?" })).toBeVisible();
    confirm = screen.getByRole("button", { name: "Confirm archive" });
    fireEvent.click(confirm);
    await waitFor(() => expect(apiMocks.archiveSupplier).toHaveBeenCalledTimes(2));
    expect(apiMocks.archiveSupplier.mock.calls[1]).toEqual(apiMocks.archiveSupplier.mock.calls[0]);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("closes supplier editor/archive surfaces on same-store authority downgrade without writes", async () => {
    navigationMocks.search = "section=suppliers";
    apiMocks.listSuppliers.mockResolvedValue([supplierFixture()]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(settingsTree(queryClient, "en"));

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "STALE SUPPLIER PII" } });
    await act(async () => {
      queryClient.setQueryData(
        storesKeys.context,
        storeContext("store-a", "Ripara Subito", { canManageSuppliers: false }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue("STALE SUPPLIER PII")).not.toBeInTheDocument();
    });
    expect(apiMocks.createSupplier).not.toHaveBeenCalled();
    expect(apiMocks.updateSupplier).not.toHaveBeenCalled();

    await act(async () => {
      queryClient.setQueryData(storesKeys.context, storeContext("store-a", "Ripara Subito"));
    });
    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));
    expect(screen.getByRole("alertdialog", { name: "Archive MOBILAX?" })).toBeVisible();
    await act(async () => {
      queryClient.setQueryData(
        storesKeys.context,
        storeContext("store-a", "Ripara Subito", { canManageSuppliers: false }),
      );
    });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(apiMocks.archiveSupplier).not.toHaveBeenCalled();
  });

  it("preserves the focused supplier draft across locale changes without domain IO", async () => {
    navigationMocks.search = "section=suppliers";
    apiMocks.listSuppliers.mockResolvedValue([supplierFixture()]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(settingsTree(queryClient, "zh-CN", true));

    fireEvent.click(await screen.findByRole("button", { name: "编辑" }));
    const draft = screen.getByLabelText("名称");
    fireEvent.change(draft, { target: { value: "MOBILAX Locale Draft" } });
    draft.focus();
    const reads = apiMocks.listSuppliers.mock.calls.length;
    fireEvent.click(screen.getByTestId("switch-it"));

    expect(await screen.findByRole("button", { name: "Salva fornitore" })).toBeVisible();
    expect(screen.getByDisplayValue("MOBILAX Locale Draft")).toBe(draft);
    expect(draft).toHaveFocus();
    expect(apiMocks.listSuppliers).toHaveBeenCalledTimes(reads);
    expect(apiMocks.createSupplier).not.toHaveBeenCalled();
    expect(apiMocks.updateSupplier).not.toHaveBeenCalled();
    expect(apiMocks.archiveSupplier).not.toHaveBeenCalled();
  });

  it("does not read supplier data when the mounted deep link lacks read permission", async () => {
    navigationMocks.search = "section=suppliers";
    apiMocks.getStoreContext.mockResolvedValue(
      storeContext("store-a", "Ripara Subito", {
        canReadSuppliers: false,
        canAssignSuppliers: false,
        canManageSuppliers: false,
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(settingsTree(queryClient));

    expect(await screen.findByRole("heading", { name: "无法打开供应商" })).toBeVisible();
    expect(apiMocks.listSuppliers).not.toHaveBeenCalled();
    expect(apiMocks.createSupplier).not.toHaveBeenCalled();
    expect(apiMocks.updateSupplier).not.toHaveBeenCalled();
    expect(apiMocks.archiveSupplier).not.toHaveBeenCalled();
  });

  it("preserves kiosk draft, pairing secret, dialog and focus across locale changes without IO", async () => {
    navigationMocks.search = "section=kiosk";
    const session = submittedKioskSession();
    apiMocks.listKioskDevices.mockResolvedValue([session.device]);
    apiMocks.listKioskSessions.mockResolvedValue([session]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(settingsTree(queryClient, "zh-CN", true));

    fireEvent.change(await screen.findByLabelText("给客户的退回原因"), {
      target: { value: "DYNAMIC KIOSK DRAFT" },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成配对码" }));
    expect(await screen.findByText("STORE-A-CODE")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "撤销设备" }));
    const confirm = screen.getByRole("button", { name: "确认撤销" });
    confirm.focus();
    const reads = {
      devices: apiMocks.listKioskDevices.mock.calls.length,
      sessions: apiMocks.listKioskSessions.mock.calls.length,
    };
    const writes = {
      pairing: apiMocks.createKioskDevicePairing.mock.calls.length,
      revoke: apiMocks.revokeKioskDevice.mock.calls.length,
      accept: apiMocks.acceptKioskSession.mock.calls.length,
      return: apiMocks.returnKioskSession.mock.calls.length,
    };
    fireEvent.click(screen.getByTestId("switch-it"));

    expect(
      await screen.findByRole("alertdialog", { name: "Revocare questo iPad cliente?" }),
    ).toBeVisible();
    expect(screen.getByDisplayValue("DYNAMIC KIOSK DRAFT")).toBeVisible();
    expect(screen.getByText("STORE-A-CODE")).toBeVisible();
    expect(confirm).toHaveFocus();
    expect(apiMocks.listKioskDevices).toHaveBeenCalledTimes(reads.devices);
    expect(apiMocks.listKioskSessions).toHaveBeenCalledTimes(reads.sessions);
    expect(apiMocks.createKioskDevicePairing).toHaveBeenCalledTimes(writes.pairing);
    expect(apiMocks.revokeKioskDevice).toHaveBeenCalledTimes(writes.revoke);
    expect(apiMocks.acceptKioskSession).toHaveBeenCalledTimes(writes.accept);
    expect(apiMocks.returnKioskSession).toHaveBeenCalledTimes(writes.return);
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

    await waitFor(() => {
      expect(
        screen.queryByRole("textbox", { name: "收据和客户消息显示名称" }),
      ).not.toBeInTheDocument();
      expect(document.querySelector('[data-ui="settings-section-loading"]')).toBeInTheDocument();
    });

    await act(async () => {
      pendingStoreB.resolve(storeSettings("store-b", "Etna Phone Lab"));
      await pendingStoreB.promise;
    });

    expect(await screen.findByRole("textbox", { name: "收据和客户消息显示名称" })).toHaveValue(
      "Etna Phone Lab",
    );
    expect(screen.queryByRole("textbox", { name: "收据和客户消息显示名称" })).not.toHaveValue(
      "Ripara Subito",
    );
  }, 15_000);

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

    const nameInput = await screen.findByLabelText("收据和客户消息显示名称");
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
        public_base_url: "",
      },
    });

    await act(async () => {
      pending.resolve({
        ...storeSettings("store-a", "Etna Repair Lab"),
        updated_at: "2026-07-12T00:01:00.000Z",
      });
      await pending.promise;
    });
    await waitFor(() => expect(document.querySelector("[data-settings-save-bar]")).toBeNull());
    expect(document.querySelector("[data-settings-save-state]")).toBeNull();
  });

  it("blocks invalid store input locally and focuses the field without calling the API", async () => {
    navigationMocks.search = "section=store";
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    render(settingsTree(queryClient));

    const phoneInput = await screen.findByLabelText("电话");
    await user.type(phoneInput, "invalid phone!");
    const saveBar = document.querySelector<HTMLElement>("[data-settings-save-bar]");
    expect(saveBar).not.toBeNull();
    await user.click(within(saveBar!).getByRole("button", { name: "保存设置" }));

    expect((await screen.findAllByText("请检查此字段"))[0]).toBeVisible();
    expect(screen.queryByText("联系方式格式无效")).not.toBeInTheDocument();
    expect(apiMocks.updateStoreSettings).not.toHaveBeenCalled();
    await waitFor(() => expect(phoneInput).toHaveFocus());
    const stateCard = document.querySelector<HTMLElement>("[data-settings-save-state]");
    expect(stateCard).toHaveAttribute("data-save-status", "validation-error");
    expect(document.querySelector("[data-settings-save-bar]")).toBeNull();
    expect(within(stateCard!).getByRole("button", { name: "重新保存" })).toBeVisible();
    expect(within(stateCard!).getByRole("button", { name: "放弃修改" })).toBeVisible();
  });

  it("reopens and focuses the collapsed public portal URL field after validation", async () => {
    navigationMocks.search = "section=store";
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    render(settingsTree(queryClient));

    const more = await screen.findByRole("button", { name: "更多选项" });
    await user.click(more);
    const publicBaseUrl = screen.getByLabelText("客户门户域名");
    await user.clear(publicBaseUrl);
    await user.type(publicBaseUrl, "http://example.com");
    await user.click(more);
    expect(screen.queryByLabelText("客户门户域名")).not.toBeInTheDocument();

    const saveBar = document.querySelector<HTMLElement>("[data-settings-save-bar]");
    expect(saveBar).not.toBeNull();
    await user.click(within(saveBar!).getByRole("button", { name: "保存设置" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "更多选项" })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      expect(screen.getByLabelText("客户门户域名")).toHaveFocus();
    });
    expect(screen.getAllByText(/请检查此字段/)[0]).toBeVisible();
    expect(screen.queryByText(/客户门户域名必须使用 HTTPS/)).not.toBeInTheDocument();
    expect(apiMocks.updateStoreSettings).not.toHaveBeenCalled();
  });

  it("keeps a ready saved identity ready after a harmless unsaved profile change", async () => {
    navigationMocks.search = "section=store";
    apiMocks.getStoreSettings.mockResolvedValue({
      ...storeSettings("store-a", "Ripara Subito"),
      store_phone: "+39 0931 000000",
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    render(settingsTree(queryClient));

    const nameInput = await screen.findByRole("textbox", {
      name: "收据和客户消息显示名称",
    });
    await user.type(nameInput, " Due");

    expect(screen.queryByText("当前已就绪")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("projects recovery from a blocked saved identity without marking the draft active", async () => {
    navigationMocks.search = "section=store";
    apiMocks.getStoreSettings.mockResolvedValue({
      ...storeSettings("store-a", "Ripara Subito"),
      store_address: "",
      store_phone: "+39 0931 000000",
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    render(settingsTree(queryClient));

    expect(await screen.findByText("客户输出当前保持关闭")).toBeVisible();
    await user.type(screen.getByLabelText("门店默认地址（用于打印）"), "Via Roma 12");

    expect(screen.getByText(/当前客户输出仍然阻断；保存这份草稿后预计解除阻断/)).toBeVisible();
    expect(screen.queryByText("当前已就绪")).not.toBeInTheDocument();
  });

  it("builds notification previews from saved settings plus only the notification draft", async () => {
    navigationMocks.search = "section=store";
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    const view = render(settingsTree(queryClient));

    const storeName = await screen.findByLabelText("收据和客户消息显示名称");
    await user.clear(storeName);
    await user.type(storeName, "Hidden Store Draft");

    navigationMocks.search = "section=rules";
    view.rerender(settingsTree(queryClient));
    const inventoryWarranty = await screen.findByLabelText("新库存商品默认保修月数");
    await user.clear(inventoryWarranty);
    await user.type(inventoryWarranty, "24");

    navigationMocks.search = "section=notifications";
    view.rerender(settingsTree(queryClient));
    await user.click(await screen.findByRole("button", { name: "预览客户消息" }));
    const messageDialog = await screen.findByRole("dialog", { name: "客户消息预览" });
    expect(messageDialog).toHaveTextContent("Ripara Subito");
    expect(messageDialog).not.toHaveTextContent("Hidden Store Draft");
    await user.click(screen.getByRole("button", { name: "关闭" }));
    await user.click(screen.getByRole("button", { name: "预览打印资料" }));
    const printPreview = await screen.findByRole("dialog", { name: "打印资料预览" });
    expect(printPreview).toHaveTextContent("Garanzia usato: 12 mesi");
    expect(printPreview).not.toHaveTextContent("Garanzia usato: 24 mesi");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("link", { name: /打开消息模板/ })).toHaveAttribute("href", "/messages");
  });

  it("restores rule defaults into the draft and saves only the rules section", async () => {
    navigationMocks.search = "section=rules";
    apiMocks.getStoreSettings.mockResolvedValue({
      ...storeSettings("store-a", "Ripara Subito"),
      default_order_warranty_text: "两年",
      default_order_warranty_months: 24,
      default_inventory_warranty_months: 36,
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    render(settingsTree(queryClient));

    await user.click(await screen.findByRole("button", { name: "恢复系统默认" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "把系统默认值应用到草稿？",
    });
    expect(dialog).toHaveTextContent("两年");
    expect(dialog).toHaveTextContent("36 个月");
    await user.click(within(dialog).getByRole("button", { name: "应用默认值到草稿" }));

    expect(apiMocks.updateStoreSettings).not.toHaveBeenCalled();
    expect(screen.getByText(/默认值已应用到草稿，仍需点击“保存”才会生效/)).toBeVisible();
    const saveBar = document.querySelector<HTMLElement>("[data-settings-save-bar]");
    expect(saveBar).not.toBeNull();
    await user.click(within(saveBar!).getByRole("button", { name: "保存设置" }));

    await waitFor(() => expect(apiMocks.updateStoreSettings).toHaveBeenCalledTimes(1));
    expect(apiMocks.updateStoreSettings).toHaveBeenCalledWith({
      section: "rules",
      expectedStoreId: "store-a",
      expectedUpdatedAt: "2026-07-12T00:00:00.000Z",
      input: {
        default_order_warranty_months: 6,
        default_inventory_warranty_months: 12,
        new_order_entry_mode: "professional",
      },
    });
    await waitFor(() => expect(document.querySelector("[data-settings-save-bar]")).toBeNull(), {
      timeout: 5_000,
    });
    expect(document.querySelector("[data-settings-save-state]")).toBeNull();
    expect(
      screen.queryByText("默认值已应用到草稿，仍需点击“保存”才会生效。"),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["zh-CN", "新库存商品默认保修月数", "保存设置"],
    ["it-IT", "Mesi di garanzia predefiniti per nuovo inventario", "Salva impostazioni"],
    ["en", "Default warranty months for new inventory", "Save settings"],
  ] as const)(
    "keeps the real rules save exact, locale-free, same-tick safe, and retryable in %s",
    async (locale, inventoryLabel, saveLabel) => {
      navigationMocks.search = "section=rules";
      const pending = deferred<StoreSettings>();
      apiMocks.updateStoreSettings.mockReturnValueOnce(pending.promise);
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      render(settingsTree(queryClient, locale));

      const inventoryWarranty = await screen.findByLabelText(inventoryLabel);
      fireEvent.change(inventoryWarranty, { target: { value: "24" } });
      const saveBar = document.querySelector<HTMLElement>("[data-settings-save-bar]");
      const save = within(saveBar!).getByRole("button", { name: saveLabel });
      fireEvent.click(save);
      fireEvent.click(save);

      await waitFor(() => expect(apiMocks.updateStoreSettings).toHaveBeenCalledTimes(1));
      expect(apiMocks.updateStoreSettings).toHaveBeenCalledWith({
        section: "rules",
        expectedStoreId: "store-a",
        expectedUpdatedAt: "2026-07-12T00:00:00.000Z",
        input: {
          default_order_warranty_months: 6,
          default_inventory_warranty_months: 24,
          new_order_entry_mode: "professional",
        },
      });
      expect(JSON.stringify(apiMocks.updateStoreSettings.mock.calls[0]?.[0])).not.toContain(
        "locale",
      );

      pending.reject(new Error("RAW_RULES_SAVE_SENTINEL"));
      await waitFor(() =>
        expect(document.querySelector("[data-settings-save-state]")).not.toBeNull(),
      );
      expect(document.body).not.toHaveTextContent("RAW_RULES_SAVE_SENTINEL");
      expect(inventoryWarranty).toHaveValue(24);
    },
  );

  it.each([
    ["zh-CN", "客户消息签名", "打印页脚", "保存设置"],
    ["it-IT", "Firma messaggi cliente", "Piè di pagina stampa", "Salva impostazioni"],
    ["en", "Customer message signature", "Print footer", "Save settings"],
  ] as const)(
    "keeps the real notifications save exact, locale-free, same-tick safe, and retryable in %s",
    async (locale, signatureLabel, footerLabel, saveLabel) => {
      navigationMocks.search = "section=notifications";
      const pending = deferred<StoreSettings>();
      apiMocks.updateStoreSettings.mockReturnValueOnce(pending.promise);
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      render(settingsTree(queryClient, locale));

      const signature = await screen.findByLabelText(signatureLabel);
      const footer = screen.getByLabelText(footerLabel);
      fireEvent.change(signature, { target: { value: "Firma dinamica 客户" } });
      fireEvent.change(footer, { target: { value: "Footer dinamico 客户" } });
      const saveBar = document.querySelector<HTMLElement>("[data-settings-save-bar]");
      const save = within(saveBar!).getByRole("button", { name: saveLabel });
      fireEvent.click(save);
      fireEvent.click(save);

      await waitFor(() => expect(apiMocks.updateStoreSettings).toHaveBeenCalledTimes(1));
      expect(apiMocks.updateStoreSettings).toHaveBeenCalledWith({
        section: "notifications",
        expectedStoreId: "store-a",
        expectedUpdatedAt: "2026-07-12T00:00:00.000Z",
        input: {
          message_signature: "Firma dinamica 客户",
          print_footer: "Footer dinamico 客户",
        },
      });
      expect(JSON.stringify(apiMocks.updateStoreSettings.mock.calls[0]?.[0])).not.toContain(
        "locale",
      );

      pending.reject(new Error("RAW_NOTIFICATIONS_SAVE_SENTINEL"));
      await waitFor(() =>
        expect(document.querySelector("[data-settings-save-state]")).not.toBeNull(),
      );
      expect(document.body).not.toHaveTextContent("RAW_NOTIFICATIONS_SAVE_SENTINEL");
      expect(signature).toHaveValue("Firma dinamica 客户");
      expect(footer).toHaveValue("Footer dinamico 客户");
    },
  );

  it.each([
    ["rules", "readonly", "resolve"],
    ["rules", "readonly", "reject"],
    ["rules", "blocked", "resolve"],
    ["rules", "blocked", "reject"],
    ["notifications", "readonly", "resolve"],
    ["notifications", "readonly", "reject"],
    ["notifications", "blocked", "resolve"],
    ["notifications", "blocked", "reject"],
  ] as const)(
    "drops a late %s save after a same-store %s authority change (%s)",
    async (section, access, outcome) => {
      navigationMocks.search = `section=${section}`;
      const pending = deferred<StoreSettings>();
      apiMocks.updateStoreSettings.mockReturnValueOnce(pending.promise);
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const setQueryData = vi.spyOn(queryClient, "setQueryData");
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      render(settingsTree(queryClient));

      const fieldLabel = section === "rules" ? "新库存商品默认保修月数" : "客户消息签名";
      const input = await screen.findByLabelText(fieldLabel);
      fireEvent.change(input, {
        target: { value: section === "rules" ? "24" : "AUTHORITY_PII_SENTINEL" },
      });
      const saveBar = document.querySelector<HTMLElement>("[data-settings-save-bar]");
      fireEvent.click(within(saveBar!).getByRole("button", { name: "保存设置" }));
      await waitFor(() => expect(apiMocks.updateStoreSettings).toHaveBeenCalledTimes(1));

      await act(async () => {
        queryClient.setQueryData(
          storesKeys.context,
          storeContext("store-a", "Ripara Subito", {
            canReadStoreSettings: access === "readonly",
            canUpdateStoreSettings: false,
          }),
        );
      });
      await waitFor(() => expect(screen.queryByLabelText(fieldLabel)).toBeNull());
      if (access === "readonly") expect(screen.getAllByText("只读").length).toBeGreaterThan(0);
      setQueryData.mockClear();
      invalidate.mockClear();
      for (const mock of Object.values(toastMocks)) mock.mockClear();
      if (outcome === "resolve") {
        await act(async () => {
          pending.resolve(storeSettings("store-a", "STALE_SAVE_SENTINEL"));
          await pending.promise;
        });
      } else {
        await act(async () => {
          pending.reject(
            new RepairDeskApiError(
              "RAW_AUTHORITY_ERROR_SENTINEL",
              422,
              "RAW_AUTHORITY_CODE_SENTINEL",
              { diagnostic: "RAW_AUTHORITY_DETAILS_SENTINEL" },
            ),
          );
          await pending.promise.catch(() => undefined);
        });
      }

      expect(apiMocks.updateStoreSettings).toHaveBeenCalledTimes(1);
      expect(setQueryData).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
      expect(toastMocks.success).not.toHaveBeenCalled();
      expect(toastMocks.error).not.toHaveBeenCalled();
      expect(document.body.textContent).not.toMatch(
        /AUTHORITY_PII_SENTINEL|STALE_SAVE_SENTINEL|RAW_AUTHORITY/,
      );
    },
  );

  it.each([
    ["rules", "resolve"],
    ["rules", "reject"],
    ["notifications", "resolve"],
    ["notifications", "reject"],
  ] as const)(
    "drops a late %s save across the A-to-none-to-B authority sequence (%s)",
    async (section, outcome) => {
      navigationMocks.search = `section=${section}`;
      const pending = deferred<StoreSettings>();
      apiMocks.updateStoreSettings.mockReturnValueOnce(pending.promise);
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const setQueryData = vi.spyOn(queryClient, "setQueryData");
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      render(settingsTree(queryClient));
      const input = await screen.findByLabelText(
        section === "rules" ? "新库存商品默认保修月数" : "客户消息签名",
      );
      fireEvent.change(input, {
        target: { value: section === "rules" ? "24" : "STORE_SWITCH_PII_SENTINEL" },
      });
      fireEvent.click(
        within(document.querySelector<HTMLElement>("[data-settings-save-bar]")!).getByRole(
          "button",
          { name: "保存设置" },
        ),
      );
      await waitFor(() => expect(apiMocks.updateStoreSettings).toHaveBeenCalledTimes(1));

      await act(async () => {
        queryClient.setQueryData(storesKeys.context, {
          activeStore: undefined,
          stores: [],
          permissions: undefined,
        } satisfies StoreContext);
      });
      await waitFor(() => expect(document.body).not.toHaveTextContent("STORE_SWITCH_PII_SENTINEL"));
      await act(async () => {
        queryClient.setQueryData(storesKeys.context, storeContext("store-b", "Etna Phone Lab"));
      });
      setQueryData.mockClear();
      invalidate.mockClear();
      for (const mock of Object.values(toastMocks)) mock.mockClear();
      if (outcome === "resolve") {
        await act(async () => {
          pending.resolve(storeSettings("store-a", "STALE_STORE_SAVE_SENTINEL"));
          await pending.promise;
        });
      } else {
        await act(async () => {
          pending.reject(new Error("RAW_STORE_AUTHORITY_SENTINEL"));
          await pending.promise.catch(() => undefined);
        });
      }

      expect(apiMocks.updateStoreSettings).toHaveBeenCalledTimes(1);
      expect(setQueryData).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
      expect(toastMocks.success).not.toHaveBeenCalled();
      expect(toastMocks.error).not.toHaveBeenCalled();
      expect(document.body.textContent).not.toMatch(
        /STORE_SWITCH_PII_SENTINEL|STALE_STORE_SAVE_SENTINEL|RAW_STORE_AUTHORITY/,
      );
    },
  );

  it.each(["section=rules", "section=notifications"])(
    "does not read settings for a blocked %s deep link",
    async (search) => {
      navigationMocks.search = search;
      apiMocks.getStoreContext.mockResolvedValue(
        storeContext("store-a", "Ripara Subito", {
          canReadStoreSettings: false,
          canUpdateStoreSettings: false,
        }),
      );
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      render(settingsTree(queryClient));

      expect(await screen.findByText(/无法打开|Unable to open|Impossibile aprire/)).toBeVisible();
      expect(apiMocks.getStoreSettings).not.toHaveBeenCalled();
      expect(apiMocks.updateStoreSettings).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["rules", "新库存商品默认保修月数", "input.default_inventory_warranty_months"],
    ["notifications", "客户消息签名", "input.message_signature"],
  ] as const)(
    "sanitizes known and unknown server field diagnostics for the real %s consumer",
    async (section, fieldLabel, fieldKey) => {
      navigationMocks.search = `section=${section}`;
      apiMocks.updateStoreSettings.mockRejectedValueOnce(
        new RepairDeskApiError(
          "RAW_PROVIDER_MESSAGE_SENTINEL",
          422,
          "SETTINGS_VALIDATION_FAILED",
          { diagnostic: "RAW_SQL_DETAILS_SENTINEL" },
          "request-sensitive",
          {
            [fieldKey]: ["RAW_FIELD_ERROR_SENTINEL"],
            "input.unknown_server_field": ["RAW_UNKNOWN_FIELD_SENTINEL"],
          },
        ),
      );
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      render(settingsTree(queryClient));

      const input = await screen.findByLabelText(fieldLabel);
      fireEvent.change(input, { target: { value: section === "rules" ? "24" : "Draft value" } });
      const saveBar = document.querySelector<HTMLElement>("[data-settings-save-bar]");
      fireEvent.click(within(saveBar!).getByRole("button", { name: "保存设置" }));

      await waitFor(() => expect(apiMocks.updateStoreSettings).toHaveBeenCalledTimes(1));
      expect((await screen.findAllByText("请修正标记字段后重试。"))[0]).toBeVisible();
      expect(document.body.textContent).not.toMatch(/RAW_|request-sensitive|SQL_DETAILS/);
      expect(input).toHaveValue(section === "rules" ? 24 : "Draft value");
    },
  );

  it("mounts the real workflow GET once and keeps the locale switch request-free", async () => {
    navigationMocks.search = "section=workflow";
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(settingsTree(queryClient, "en", true));

    expect(await screen.findByText("No workflow records for the current store")).toBeVisible();
    expect(apiMocks.listOrderWorkflow).toHaveBeenCalledTimes(1);
    expect(Object.keys(apiMocks.listOrderWorkflow.mock.calls[0]?.[0] ?? {})).toEqual(["signal"]);
    expect(JSON.stringify(apiMocks.listOrderWorkflow.mock.calls[0]?.[0])).not.toContain("locale");
    fireEvent.click(screen.getByTestId("switch-it"));

    expect(await screen.findByText("Nessun flusso per il negozio corrente")).toBeVisible();
    expect(apiMocks.listOrderWorkflow).toHaveBeenCalledTimes(1);
    expect(navigationMocks.search).toBe("section=workflow");
  });

  it("mounts the real AI usage GET once and blocks it without aggregate-finance permission", async () => {
    navigationMocks.search = "section=ai-usage";
    apiMocks.getStoreContext.mockResolvedValue(
      storeContext("store-a", "Ripara Subito", { canReadAggregateFinance: true }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const view = render(settingsTree(queryClient, "en", true));

    expect(await screen.findByRole("heading", { name: "AI usage", level: 1 })).toBeVisible();
    expect(apiMocks.getAiAssistantUsageSummary).toHaveBeenCalledTimes(1);
    expect(Object.keys(apiMocks.getAiAssistantUsageSummary.mock.calls[0]?.[0] ?? {})).toEqual([
      "signal",
    ]);
    expect(JSON.stringify(apiMocks.getAiAssistantUsageSummary.mock.calls[0]?.[0])).not.toContain(
      "locale",
    );
    fireEvent.click(screen.getByTestId("switch-it"));
    expect(await screen.findByRole("heading", { name: "Utilizzo AI", level: 1 })).toBeVisible();
    expect(apiMocks.getAiAssistantUsageSummary).toHaveBeenCalledTimes(1);

    view.unmount();
    vi.clearAllMocks();
    apiMocks.getStoreContext.mockResolvedValue(
      storeContext("store-a", "Ripara Subito", { canReadAggregateFinance: false }),
    );
    const blockedClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(settingsTree(blockedClient));
    expect(await screen.findByText(/无法打开/)).toBeVisible();
    expect(apiMocks.getAiAssistantUsageSummary).not.toHaveBeenCalled();
  });

  it("guards the real messages link while the notification draft is dirty", async () => {
    navigationMocks.search = "section=notifications";
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    render(settingsTree(queryClient));

    const signature = await screen.findByLabelText("客户消息签名");
    await user.clear(signature);
    await user.type(signature, "Pending message signature");
    await user.click(screen.getByRole("link", { name: /打开消息模板/ }));

    const guard = await screen.findByRole("alertdialog", { name: "当前设置尚未保存" });
    expect(guard).toHaveTextContent("通知与打印分组");
    expect(apiMocks.updateStoreSettings).not.toHaveBeenCalled();
    expect(navigationMocks.push).not.toHaveBeenCalled();
    await user.click(within(guard).getByRole("button", { name: "取消" }));
    expect(signature).toHaveValue("Pending message signature");
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

    const nameInput = await screen.findByLabelText("收据和客户消息显示名称");
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
    expect(document.querySelector("[data-settings-save-bar]")).toBeNull();
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

    const nameInput = await screen.findByLabelText("收据和客户消息显示名称");
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

    const nameInput = await screen.findByLabelText("收据和客户消息显示名称");
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
    const stateCard = document.querySelector<HTMLElement>("[data-settings-save-state]");
    expect(stateCard).toHaveAttribute("data-save-status", "error");
    expect(within(stateCard!).getByRole("button", { name: "重新保存" })).toBeVisible();
    expect(within(stateCard!).getByRole("button", { name: "放弃修改" })).toBeVisible();
  });

  it("discards every dirty section once before continuing navigation", async () => {
    navigationMocks.search = "section=store";
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    const view = render(settingsTree(queryClient));

    const nameInput = await screen.findByLabelText("收据和客户消息显示名称");
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
    expect(await screen.findByRole("textbox", { name: "收据和客户消息显示名称" })).toHaveValue(
      "Ripara Subito",
    );
    navigationMocks.search = "section=notifications";
    view.rerender(settingsTree(queryClient));
    expect(
      await screen.findByDisplayValue("Grazie per aver scelto Ripara Subito."),
    ).toBeInTheDocument();
  });

  it("keeps the current settings draft mounted when store switch or creation fails", async () => {
    const originalConsoleError = console.error.bind(console);
    const consoleError = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      if (args.length === 1 && args[0] === "[navigation-guard] transition failed") return;
      originalConsoleError(...args);
    });
    navigationMocks.search = "section=store";
    const context = storeContext("store-a", "Ripara Subito");
    apiMocks.getStoreContext.mockResolvedValue(context);
    apiMocks.createStore
      .mockRejectedValueOnce(new Error("RAW_CREATE_UNKNOWN"))
      .mockRejectedValueOnce(new Error("RAW_CREATE_UNKNOWN_AGAIN"));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    render(settingsTree(queryClient));

    const nameInput = await screen.findByLabelText("收据和客户消息显示名称");
    await user.click(screen.getByRole("button", { name: /管理店铺与安全/ }));
    expect(nameInput).toHaveValue("Ripara Subito");

    await user.type(screen.getByLabelText("新店铺名称"), "Failed Store");
    await user.type(screen.getByLabelText("默认打印地址（可选）"), "Via Etnea 24");
    await user.click(screen.getByRole("button", { name: "创建并切换" }));
    await user.click(
      within(screen.getByRole("alertdialog", { name: "确认创建独立店铺？" })).getByRole("button", {
        name: "确认创建并切换",
      }),
    );
    await waitFor(() => expect(apiMocks.createStore).toHaveBeenCalledTimes(1));
    expect(apiMocks.createStore.mock.calls[0]?.[0]).toEqual({
      request_id: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
      name: "Failed Store",
      address: "Via Etnea 24",
    });
    expect(nameInput).toHaveValue("Ripara Subito");

    await user.click(screen.getByRole("button", { name: "创建并切换" }));
    await user.click(
      within(screen.getByRole("alertdialog", { name: "确认创建独立店铺？" })).getByRole("button", {
        name: "确认创建并切换",
      }),
    );
    await waitFor(() => expect(apiMocks.createStore).toHaveBeenCalledTimes(2));
    expect(apiMocks.createStore.mock.calls[1]?.[0].request_id).toBe(
      apiMocks.createStore.mock.calls[0]?.[0].request_id,
    );
    expect(screen.queryByText(/RAW_CREATE_UNKNOWN/)).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("新店铺名称"));
    await user.type(screen.getByLabelText("新店铺名称"), "Changed Store");
    await user.click(screen.getByRole("button", { name: "创建并切换" }));
    await user.click(
      within(screen.getByRole("alertdialog", { name: "确认创建独立店铺？" })).getByRole("button", {
        name: "确认创建并切换",
      }),
    );
    await waitFor(() => expect(apiMocks.createStore).toHaveBeenCalledTimes(3));
    expect(apiMocks.createStore.mock.calls[2]?.[0].request_id).not.toBe(
      apiMocks.createStore.mock.calls[1]?.[0].request_id,
    );
    expect(consoleError).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenNthCalledWith(1, "[navigation-guard] transition failed");
    expect(consoleError).toHaveBeenNthCalledWith(2, "[navigation-guard] transition failed");
    consoleError.mockRestore();
  });

  it("takes the create-store lock before the guarded transition settles", async () => {
    navigationMocks.search = "section=store";
    const pending = deferred<Awaited<ReturnType<typeof apiMocks.createStore>>>();
    apiMocks.createStore.mockReturnValueOnce(pending.promise);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    render(settingsTree(queryClient));

    await screen.findByLabelText("收据和客户消息显示名称");
    await user.click(screen.getByRole("button", { name: /管理店铺与安全/ }));
    await user.type(screen.getByLabelText("新店铺名称"), "Locked Store");
    await user.click(screen.getByRole("button", { name: "创建并切换" }));
    const confirm = within(
      screen.getByRole("alertdialog", { name: "确认创建独立店铺？" }),
    ).getByRole("button", { name: "确认创建并切换" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(apiMocks.createStore).toHaveBeenCalledTimes(1));

    await act(async () => {
      pending.resolve(storeContext("store-b", "Locked Store"));
      await pending.promise;
    });
  });

  it("calls the real lifecycle preflight consumer once for a rapid duplicate", async () => {
    navigationMocks.search = "section=store";
    const context = storeContext("store-a", "Ripara Subito");
    context.activeStoreExplicit = true;
    context.activeStore = {
      ...context.activeStore!,
      lifecycle: { store_id: "store-a", phase: "active", revision: 2 },
    };
    context.lifecycleAccess = {
      store_id: "store-a",
      check: { allowed: true, code: "available" },
      rename: { allowed: true, code: "available" },
      close: { allowed: true, code: "available" },
      restore: { allowed: false, code: "store_unavailable" },
      purge: { allowed: false, code: "store_unavailable" },
    };
    apiMocks.getStoreContext.mockResolvedValue(context);
    const pending = deferred<Awaited<ReturnType<typeof apiMocks.createStoreLifecyclePreflight>>>();
    apiMocks.createStoreLifecyclePreflight.mockReturnValueOnce(pending.promise);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    render(settingsTree(queryClient));

    await screen.findByLabelText("收据和客户消息显示名称");
    await user.click(screen.getByRole("button", { name: /管理店铺与安全/ }));
    const check = screen.getByRole("button", { name: "检查是否可以关闭" });
    fireEvent.click(check);
    fireEvent.click(check);
    await waitFor(() => expect(apiMocks.createStoreLifecyclePreflight).toHaveBeenCalledTimes(1));
    expect(apiMocks.createStoreLifecyclePreflight).toHaveBeenCalledWith("store-a");

    await act(async () => {
      pending.resolve({
        id: "preflight-a",
        store_id: "store-a",
        store_name: "Ripara Subito",
        lifecycle: { store_id: "store-a", phase: "active", revision: 2 },
        state: "eligible",
        counts: {},
        blockers: [],
        automatic_effects: { pending_invitations: 0, open_kiosk_sessions: 0 },
        snapshot_hash: "a".repeat(64),
        expires_at: "2099-01-01T00:00:00.000Z",
      });
      await pending.promise;
    });
  });

  it("does not create an independent store before a dirty settings decision", async () => {
    navigationMocks.search = "section=store";
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    render(settingsTree(queryClient));

    const nameInput = await screen.findByRole("textbox", {
      name: "收据和客户消息显示名称",
    });
    await user.clear(nameInput);
    await user.type(nameInput, "Unsaved Current Store");
    await user.click(screen.getByRole("button", { name: /管理店铺与安全/ }));
    await user.type(screen.getByLabelText("新店铺名称"), "Second Store");
    await user.type(screen.getByLabelText("默认打印地址（可选）"), "Via Roma 99");
    await user.click(screen.getByRole("button", { name: "创建并切换" }));
    await user.click(
      within(screen.getByRole("alertdialog", { name: "确认创建独立店铺？" })).getByRole("button", {
        name: "确认创建并切换",
      }),
    );

    const guard = await screen.findByRole("alertdialog", { name: "当前设置尚未保存" });
    expect(apiMocks.createStore).not.toHaveBeenCalled();
    await user.click(within(guard).getByRole("button", { name: "取消" }));
    expect(nameInput).toHaveValue("Unsaved Current Store");
    expect(screen.getByLabelText("新店铺名称")).toHaveValue("Second Store");
    expect(screen.getByLabelText("默认打印地址（可选）")).toHaveValue("Via Roma 99");
  }, 10_000);

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

  it.each([
    ["zh-CN", "显示名称", "保存名称", "名称保存失败。草稿仍保留，可再次点击“保存名称”重试。"],
    [
      "it-IT",
      "Nome visualizzato",
      "Salva nome",
      "Impossibile salvare il nome. La bozza è ancora disponibile: premi di nuovo “Salva nome” per riprovare.",
    ],
    [
      "en",
      "Display name",
      "Save name",
      "The name could not be saved. Your draft is still available; select “Save name” to try again.",
    ],
  ] as const)(
    "keeps the exact account-name body locale-neutral and same-tick safe in %s",
    async (locale, fieldLabel, saveLabel, errorMessage) => {
      navigationMocks.search = "section=account";
      const pending = deferred<never>();
      apiMocks.updateAccountProfile.mockReturnValueOnce(pending.promise);
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      render(settingsTree(queryClient, locale));

      const displayName = await screen.findByLabelText(fieldLabel);
      fireEvent.change(displayName, { target: { value: "  Exact Owner  " } });
      const save = screen.getByRole("button", { name: saveLabel });
      fireEvent.click(save);
      fireEvent.click(save);

      await waitFor(() => expect(apiMocks.updateAccountProfile).toHaveBeenCalledTimes(1));
      expect(apiMocks.updateAccountProfile).toHaveBeenCalledWith({ display_name: "Exact Owner" });
      expect(apiMocks.updateAccountProfile.mock.calls[0]?.[0]).not.toHaveProperty("locale");
      expect(displayName).toHaveValue("  Exact Owner  ");

      pending.reject(new Error("RAW_ACCOUNT_SENTINEL"));
      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(errorMessage));
      expect(document.body).not.toHaveTextContent("RAW_ACCOUNT_SENTINEL");
      expect(displayName).toHaveValue("  Exact Owner  ");
    },
  );

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

function settingsTree(
  queryClient: QueryClient,
  locale: AppLocale = "zh-CN",
  withLocaleSwitches = false,
) {
  return (
    <LocaleProvider initialLocale={locale}>
      <QueryClientProvider client={queryClient}>
        <NavigationGuardProvider>
          <SidebarProvider>
            {withLocaleSwitches ? <TestLocaleSwitches /> : null}
            <SettingsScreen />
          </SidebarProvider>
        </NavigationGuardProvider>
      </QueryClientProvider>
    </LocaleProvider>
  );
}

function TestLocaleSwitches() {
  const { setLocale } = useLocale();
  return (
    <>
      <button type="button" data-testid="switch-it" onClick={() => setLocale("it-IT")}>
        switch-it
      </button>
      <button type="button" data-testid="switch-en" onClick={() => setLocale("en")}>
        switch-en
      </button>
    </>
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
      canReadMessageTemplates: true,
      canUpdateMessageTemplates: true,
      canListMembers: true,
      canInviteMembers: true,
      canManageMembers: true,
      canRevokeMembers: true,
      canGrantManager: true,
      memberInviteRoles: ["manager", "technician", "sales", "viewer"],
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

function supplierFixture(): Supplier {
  return {
    id: "supplier-1",
    name: "MOBILAX",
    short_name: "MOB",
    color: "#2563eb",
    contact_name: "Support",
    phone: "+39 0931 000000",
    email: "support@example.com",
    website: "https://example.com",
    notes: "Current store only",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  };
}

function submittedKioskSession(): KioskSession {
  return {
    id: "session-a",
    store_id: "store-a",
    device_id: "device-a",
    order_id: "order-a",
    customer_id: "customer-a",
    session_type: "order_contact_signature",
    status: "submitted",
    request_payload: { order_public_no: "TEST-001", device_label: "Test Phone" },
    submission_payload: {
      customer_name: "Cliente Test",
      customer_phone: "+39 333 000 0000",
      confirmation_checked: true,
      has_signature: false,
    },
    submission_version: 1,
    expires_at: "2099-07-13T00:00:00.000Z",
    submitted_at: "2026-07-13T00:10:00.000Z",
    created_at: "2026-07-13T00:00:00.000Z",
    updated_at: "2026-07-13T00:10:00.000Z",
    device: {
      id: "device-a",
      store_id: "store-a",
      label: "Front iPad",
      status: "active",
      created_at: "2026-07-13T00:00:00.000Z",
      updated_at: "2026-07-13T00:10:00.000Z",
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}
