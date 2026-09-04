import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { NavigationGuardProvider } from "@/components/navigation-guard-provider";
import { SettingsStateCard } from "@/features/settings/components/settings-state-card";
import type { MembersSettingsSectionProps } from "@/features/settings/sections/members-settings-section";
import type {
  OrderDataAccessCode,
  StoreContext,
  StoreMember,
  StoreSettings,
} from "@/lib/repairdesk/types";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";

import { SettingsScreen } from "./settings-screen";

const apiMocks = vi.hoisted(() => ({
  approveStoreAccessRequest: vi.fn(),
  createStoreInviteLink: vi.fn(),
  disableStoreMember: vi.fn(),
  getOnboardingStatus: vi.fn(),
  getStoreContext: vi.fn(),
  getStoreMembers: vi.fn(),
  getStoreSettings: vi.fn(),
  inviteStoreMember: vi.fn(),
  listStoreAccessRequests: vi.fn(),
  rejectStoreAccessRequest: vi.fn(),
  restoreStoreMember: vi.fn(),
  revokeStoreInvitation: vi.fn(),
  revokeStoreInviteLink: vi.fn(),
  updateStoreMemberPermissions: vi.fn(),
  updateStoreMemberRole: vi.fn(),
}));

const navigationMocks = vi.hoisted(() => ({ search: "" }));
const memberSectionCapture = vi.hoisted(() => ({ props: undefined as unknown }));

vi.mock("@/features/settings/sections/members-settings-section", () => ({
  MembersSettingsSection: (props: unknown) => {
    memberSectionCapture.props = props;
    return <div data-testid="members-settings-section-probe" />;
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
});

describe("SettingsScreen i18n shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigationMocks.search = "";
    apiMocks.getStoreContext.mockResolvedValue(storeContext());
    apiMocks.getStoreSettings.mockResolvedValue(storeSettings());
    const emptyMembers = { members: [], invitations: [], invite_links: [] };
    apiMocks.getStoreMembers.mockResolvedValue(emptyMembers);
    apiMocks.listStoreAccessRequests.mockResolvedValue([]);
    apiMocks.inviteStoreMember.mockResolvedValue(emptyMembers);
    apiMocks.createStoreInviteLink.mockResolvedValue({
      code: "SAFE-CODE",
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
    for (const mock of [
      apiMocks.disableStoreMember,
      apiMocks.restoreStoreMember,
      apiMocks.revokeStoreInvitation,
      apiMocks.revokeStoreInviteLink,
      apiMocks.updateStoreMemberPermissions,
      apiMocks.updateStoreMemberRole,
    ]) {
      mock.mockResolvedValue(emptyMembers);
    }
    apiMocks.approveStoreAccessRequest.mockResolvedValue({ id: "request-a", status: "approved" });
    apiMocks.rejectStoreAccessRequest.mockResolvedValue({ id: "request-a", status: "rejected" });
    memberSectionCapture.props = undefined;
    apiMocks.getOnboardingStatus.mockResolvedValue({
      userId: "owner-1",
      displayName: "Mario Rossi",
      email: "owner@example.test",
      emailVerified: true,
      activeStore: storeContext().activeStore,
      stores: storeContext().stores,
      isPlatformAdmin: false,
    });
  });

  it.each([
    ["zh-CN" as const, "常用设置", "店铺", "更多设置"],
    ["it-IT" as const, "Impostazioni frequenti", "Negozio", "Altre impostazioni"],
    ["en" as const, "Common settings", "Store", "More settings"],
  ])("renders the overview in %s with stable routes", async (locale, heading, store, more) => {
    renderSettings(locale);

    expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
    expect(
      document.querySelector(`[data-settings-overview] a[href="/settings?section=store"]`),
    ).toHaveAccessibleName(new RegExp(`^${store}`));
    expect(
      document.querySelector(`[data-settings-overview] a[href="/settings?section=store"]`),
    ).toHaveAttribute("href", "/settings?section=store");
    const moreToggle = document.querySelector<HTMLElement>(
      "[data-settings-overview] [data-settings-overview-more-toggle]",
    );
    expect(moreToggle).toHaveAccessibleName(new RegExp(more));
    expect(moreToggle).toHaveAttribute("aria-expanded", "false");
  });

  it("switches locale in place without refetching or changing dynamic values and input", async () => {
    navigationMocks.search = "section=store";
    renderSettings("zh-CN", true);

    const storeName = await screen.findByDisplayValue("Ripara Subito 北店");
    fireEvent.change(storeName, { target: { value: "Ripara Subito 北店 - bozza" } });
    const requestCounts = {
      context: apiMocks.getStoreContext.mock.calls.length,
      settings: apiMocks.getStoreSettings.mock.calls.length,
      account: apiMocks.getOnboardingStatus.mock.calls.length,
    };

    fireEvent.click(screen.getByRole("button", { name: "switch-it" }));

    expect(await screen.findByText("Negozio", { selector: "h1" })).toBeVisible();
    expect(screen.getByDisplayValue("Ripara Subito 北店 - bozza")).toBe(storeName);
    expect(screen.getByRole("button", { name: "Salva impostazioni" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Annulla modifiche" })).toBeVisible();
    for (const link of screen.getAllByRole("link", {
      name: "Torna alla panoramica impostazioni",
    })) {
      expect(link).toHaveAttribute("href", "/settings");
    }
    await waitFor(() => {
      expect(apiMocks.getStoreContext).toHaveBeenCalledTimes(requestCounts.context);
      expect(apiMocks.getStoreSettings).toHaveBeenCalledTimes(requestCounts.settings);
      expect(apiMocks.getOnboardingStatus).toHaveBeenCalledTimes(requestCounts.account);
    });

    fireEvent.click(screen.getByRole("button", { name: "switch-en" }));
    expect(await screen.findByText("Store", { selector: "h1" })).toBeVisible();
    expect(screen.getByDisplayValue("Ripara Subito 北店 - bozza")).toBe(storeName);
    expect(screen.getByRole("button", { name: "Save settings" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Discard changes" })).toBeVisible();
  });

  it("preserves a focused rules draft and deep link across locale switch with zero domain IO", async () => {
    navigationMocks.search = "section=rules";
    renderSettings("zh-CN", true);

    const warranty = await screen.findByLabelText("新库存商品默认保修月数");
    fireEvent.change(warranty, { target: { value: "24" } });
    warranty.focus();
    const requestCounts = {
      context: apiMocks.getStoreContext.mock.calls.length,
      settings: apiMocks.getStoreSettings.mock.calls.length,
    };
    fireEvent.click(screen.getByRole("button", { name: "switch-it" }));

    expect(await screen.findByLabelText("Mesi di garanzia predefiniti per nuovo inventario")).toBe(
      warranty,
    );
    expect(warranty).toHaveValue(24);
    expect(warranty).toHaveFocus();
    expect(navigationMocks.search).toBe("section=rules");
    expect(apiMocks.getStoreContext).toHaveBeenCalledTimes(requestCounts.context);
    expect(apiMocks.getStoreSettings).toHaveBeenCalledTimes(requestCounts.settings);
  });

  it("keeps notification drafts, dialogs, and canonical customer preview bytes across locale switch", async () => {
    navigationMocks.search = "section=notifications";
    renderSettings("zh-CN", true);

    const signature = await screen.findByLabelText("客户消息签名");
    fireEvent.change(signature, { target: { value: "Firma dinamica 客户" } });
    const requestsBefore = {
      context: apiMocks.getStoreContext.mock.calls.length,
      settings: apiMocks.getStoreSettings.mock.calls.length,
    };
    fireEvent.click(screen.getByRole("button", { name: "预览客户消息" }));
    const previewBefore = screen.getByRole("dialog").querySelector("pre")?.textContent;
    fireEvent.click(screen.getByText("switch-it"));

    expect(
      await screen.findByRole("dialog", { name: "Draft non salvato · Messaggio cliente" }),
    ).toBeVisible();
    expect(screen.getByRole("dialog").querySelector("pre")?.textContent).toBe(previewBefore);
    expect(screen.getByRole("dialog")).toHaveTextContent("Firma dinamica 客户");
    expect(navigationMocks.search).toBe("section=notifications");
    expect(apiMocks.getStoreContext).toHaveBeenCalledTimes(requestsBefore.context);
    expect(apiMocks.getStoreSettings).toHaveBeenCalledTimes(requestsBefore.settings);
  });

  it.each([
    ["zh-CN" as const, "我的账号", "显示名称", "打开个人中心"],
    ["it-IT" as const, "Il mio account", "Nome visualizzato", "Apri profilo personale"],
    ["en" as const, "My account", "Display name", "Open personal profile"],
  ])(
    "renders the personal-settings deep link in %s with stable account data and route",
    async (locale, title, displayName, openAccount) => {
      navigationMocks.search = "section=account";
      renderSettings(locale);

      expect(await screen.findByRole("heading", { name: title })).toBeVisible();
      expect(screen.getByLabelText(displayName)).toHaveValue("Mario Rossi");
      expect(screen.getByText("owner@example.test")).toBeVisible();
      expect(screen.getByRole("link", { name: openAccount })).toHaveAttribute("href", "/account");
      expect(apiMocks.getOnboardingStatus).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "keeps every Settings member mutation body locale-neutral in %s",
    async (locale) => {
      navigationMocks.search = "section=members";
      const context = storeContext();
      context.permissions!.memberInviteRoles = ["manager", "technician", "sales", "viewer"];
      apiMocks.getStoreContext.mockResolvedValue(context);
      renderSettings(locale);
      await screen.findByTestId("members-settings-section-probe");
      const props = memberSectionCapture.props as MembersSettingsSectionProps;
      const member = settingsMemberFixture();

      await act(async () => {
        await props.onInvite({ email: "Staff@Example.TEST", role: "manager" });
      });
      expect(apiMocks.inviteStoreMember).toHaveBeenCalledTimes(1);
      expect(apiMocks.inviteStoreMember).toHaveBeenLastCalledWith({
        email: "Staff@Example.TEST",
        role: "manager",
      });
      apiMocks.inviteStoreMember.mockClear();
      await act(async () => {
        await props.onInvite({ email: "existing@example.test", role: "viewer" });
      });
      expect(apiMocks.inviteStoreMember).toHaveBeenCalledTimes(1);
      expect(apiMocks.inviteStoreMember).toHaveBeenLastCalledWith({
        email: "existing@example.test",
        role: "viewer",
      });

      await act(async () => {
        await props.onCreateInviteLink({
          label: "Front desk",
          role: "viewer",
          expires_in_days: 7,
          max_uses: 1,
        });
      });
      expect(apiMocks.createStoreInviteLink).toHaveBeenCalledTimes(1);
      expect(apiMocks.createStoreInviteLink).toHaveBeenLastCalledWith({
        label: "Front desk",
        role: "viewer",
        expires_in_days: 7,
        max_uses: 1,
      });

      await act(async () => {
        await props.onSaveMember(member, { role: "manager", permissions: ["supplier:read"] });
      });
      expect(apiMocks.updateStoreMemberRole).toHaveBeenCalledTimes(1);
      expect(apiMocks.updateStoreMemberRole).toHaveBeenLastCalledWith({
        id: "member-a",
        role: "manager",
      });
      await act(async () => {
        await props.onSaveMember(member, {
          role: "technician",
          permissions: ["supplier:read", "supplier:assign"],
        });
      });
      expect(apiMocks.updateStoreMemberPermissions).toHaveBeenCalledTimes(1);
      expect(apiMocks.updateStoreMemberPermissions).toHaveBeenLastCalledWith({
        id: "member-a",
        permissions: ["supplier:read", "supplier:assign"],
      });

      await act(async () => {
        await props.onDisableMember("member-a");
        await props.onRestoreMember("member-a");
        await props.onRevokeInvitation("invitation-a");
        await props.onRevokeInviteLink("link-a");
        await props.onApproveAccessRequest("request-a", "sales");
        await props.onRejectAccessRequest("request-a");
      });
      expect(apiMocks.disableStoreMember).toHaveBeenCalledTimes(1);
      expect(apiMocks.disableStoreMember).toHaveBeenLastCalledWith({ id: "member-a" });
      expect(apiMocks.restoreStoreMember).toHaveBeenCalledTimes(1);
      expect(apiMocks.restoreStoreMember).toHaveBeenLastCalledWith({ id: "member-a" });
      expect(apiMocks.revokeStoreInvitation).toHaveBeenCalledTimes(1);
      expect(apiMocks.revokeStoreInvitation).toHaveBeenLastCalledWith({ id: "invitation-a" });
      expect(apiMocks.revokeStoreInviteLink).toHaveBeenCalledTimes(1);
      expect(apiMocks.revokeStoreInviteLink).toHaveBeenLastCalledWith({ id: "link-a" });
      expect(apiMocks.approveStoreAccessRequest).toHaveBeenCalledTimes(1);
      expect(apiMocks.approveStoreAccessRequest).toHaveBeenLastCalledWith({
        id: "request-a",
        approved_role: "sales",
      });
      expect(apiMocks.rejectStoreAccessRequest).toHaveBeenCalledTimes(1);
      expect(apiMocks.rejectStoreAccessRequest).toHaveBeenLastCalledWith({
        id: "request-a",
        note: "店铺负责人拒绝加入申请",
      });
      for (const mock of [
        apiMocks.inviteStoreMember,
        apiMocks.createStoreInviteLink,
        apiMocks.updateStoreMemberRole,
        apiMocks.updateStoreMemberPermissions,
        apiMocks.disableStoreMember,
        apiMocks.restoreStoreMember,
        apiMocks.revokeStoreInvitation,
        apiMocks.revokeStoreInviteLink,
        apiMocks.approveStoreAccessRequest,
        apiMocks.rejectStoreAccessRequest,
      ]) {
        expect(JSON.stringify(mock.mock.calls)).not.toContain("locale");
      }
    },
  );

  it.each([
    ["zh-CN" as const, "需要修正的字段：1 个。"],
    ["it-IT" as const, "Campi da correggere: 1."],
    ["en" as const, "Fields needing correction: 1."],
  ])("keeps raw validation diagnostics out of the mounted %s UI", (locale, summary) => {
    render(
      <LocaleProvider initialLocale={locale}>
        <SettingsStateCard
          status="validation-error"
          fieldErrors={{ storeName: ["SQLSTATE 23505: internal constraint detail"] }}
          onDiscard={vi.fn()}
          onRetry={vi.fn()}
          onRebase={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(screen.getByText(summary)).toBeVisible();
    expect(screen.queryByText(/SQLSTATE|internal constraint/i)).not.toBeInTheDocument();
  });

  it.each([
    ["zh-CN" as const, "无法打开工单数据", "返回设置总览"],
    ["it-IT" as const, "Impossibile aprire Dati ordini", "Torna alla panoramica impostazioni"],
    ["en" as const, "Unable to open Order data", "Back to settings overview"],
  ])(
    "localizes every order-data access code in the mounted %s deep link without fetching protected data",
    async (locale, accessTitle, backLabel) => {
      navigationMocks.search = "section=order-data";

      for (const { code, description } of orderDataAccessCases[locale]) {
        const context = storeContext();
        context.permissions!.canManageOrderData = false;
        context.permissions!.canApplyOrderData = false;
        context.orderDataAccess = code ? { code, can_export: false, can_apply: false } : undefined;
        apiMocks.getStoreContext.mockResolvedValueOnce(context);
        const contextRequestsBefore = apiMocks.getStoreContext.mock.calls.length;

        const view = renderSettings(locale);

        expect(await screen.findByRole("heading", { name: accessTitle })).toBeVisible();
        const accessState = document.querySelector('[data-ui="settings-order-data-no-permission"]');
        expect(accessState).toHaveTextContent(description);
        if (locale !== "zh-CN") {
          expect(accessState?.textContent).not.toMatch(/[\u3400-\u9fff]/u);
        }
        for (const link of screen.getAllByRole("link", { name: backLabel })) {
          expect(link).toHaveAttribute("href", "/settings");
        }
        expect(apiMocks.getStoreContext).toHaveBeenCalledTimes(contextRequestsBefore + 1);
        expect(apiMocks.getStoreSettings).not.toHaveBeenCalled();
        expect(apiMocks.getOnboardingStatus).not.toHaveBeenCalled();

        view.unmount();
      }
    },
  );
});

const orderDataAccessCases: Record<
  "zh-CN" | "it-IT" | "en",
  ReadonlyArray<{ code: OrderDataAccessCode | undefined; description: string }>
> = {
  "zh-CN": [
    { code: "available", description: "可导出并应用批量导入" },
    { code: "available_export_only", description: "可导出；批量应用暂未开放" },
    {
      code: "feature_disabled",
      description:
        "工单数据导入导出功能当前未开放。这只是功能开关状态，不代表工单丢失；订单列表和日常工单操作不受影响。",
    },
    {
      code: "store_context_required",
      description: "系统无法确认你明确选择了哪个店铺。请返回店铺设置重新选择，再刷新权限。",
    },
    {
      code: "owner_role_required",
      description: "整店工单导入导出仅允许当前店铺的店主使用，其他角色仍可按现有权限处理日常工单。",
    },
    {
      code: "primary_owner_required",
      description:
        "当前账号在成员列表中可以显示为店主，但不是 stores.owner_user_id 记录的主创建者，因此不能使用整店导入导出。",
    },
    {
      code: "store_unavailable",
      description: "当前店铺不可用，系统已停止加载整店数据工具。请先确认店铺状态。",
    },
    {
      code: undefined,
      description:
        "当前店铺的工单数据权限状态读取失败，请重新加载。系统不会因此删除或隐藏已有工单。",
    },
  ],
  "it-IT": [
    {
      code: "available",
      description: "Esportazione e applicazione delle importazioni in blocco disponibili",
    },
    {
      code: "available_export_only",
      description: "Esportazione disponibile; applicazione in blocco non ancora abilitata",
    },
    {
      code: "feature_disabled",
      description:
        "L'importazione e l'esportazione dei dati degli ordini non sono attualmente abilitate. È solo lo stato della funzione e non indica una perdita di ordini; l'elenco e le normali operazioni sugli ordini non sono interessati.",
    },
    {
      code: "store_context_required",
      description:
        "Il sistema non riesce a verificare quale negozio sia stato selezionato esplicitamente. Torna alle impostazioni del negozio, selezionalo di nuovo e aggiorna le autorizzazioni.",
    },
    {
      code: "owner_role_required",
      description:
        "L'importazione e l'esportazione dell'intero negozio sono disponibili solo per il titolare del negozio corrente. Gli altri ruoli possono continuare a gestire gli ordini quotidiani secondo le autorizzazioni esistenti.",
    },
    {
      code: "primary_owner_required",
      description:
        "L'account può apparire come titolare nell'elenco del personale, ma non è il creatore principale registrato in stores.owner_user_id e quindi non può usare l'importazione o l'esportazione dell'intero negozio.",
    },
    {
      code: "store_unavailable",
      description:
        "Il negozio corrente non è disponibile e il sistema ha interrotto il caricamento degli strumenti per i dati dell'intero negozio. Verifica prima lo stato del negozio.",
    },
    {
      code: undefined,
      description:
        "Impossibile leggere lo stato di accesso ai dati degli ordini per il negozio corrente. Ricarica la pagina. Il sistema non eliminerà né nasconderà gli ordini esistenti.",
    },
  ],
  en: [
    { code: "available", description: "Export and bulk import application available" },
    {
      code: "available_export_only",
      description: "Export available; bulk application is not yet enabled",
    },
    {
      code: "feature_disabled",
      description:
        "Order-data import and export are not currently enabled. This is only the feature state and does not mean orders were lost; the order list and routine order operations are unaffected.",
    },
    {
      code: "store_context_required",
      description:
        "The system cannot confirm which store you explicitly selected. Return to store settings, select it again, and refresh permissions.",
    },
    {
      code: "owner_role_required",
      description:
        "Whole-store order import and export are available only to the current store owner. Other roles can continue routine order work under their existing permissions.",
    },
    {
      code: "primary_owner_required",
      description:
        "This account may appear as an owner in the staff list, but it is not the primary creator recorded in stores.owner_user_id and therefore cannot use whole-store import or export.",
    },
    {
      code: "store_unavailable",
      description:
        "The current store is unavailable, so the system stopped loading whole-store data tools. Confirm the store status first.",
    },
    {
      code: undefined,
      description:
        "The order-data access status for the current store could not be read. Reload the page. The system will not delete or hide existing orders because of this.",
    },
  ],
};

function renderSettings(initialLocale: "zh-CN" | "it-IT" | "en", withSwitches = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <LocaleProvider initialLocale={initialLocale}>
      <QueryClientProvider client={queryClient}>
        <NavigationGuardProvider>
          {withSwitches ? <LocaleSwitches /> : null}
          <SettingsScreen />
        </NavigationGuardProvider>
      </QueryClientProvider>
    </LocaleProvider>,
  );
}

function LocaleSwitches() {
  const { setLocale } = useLocale();
  return (
    <>
      <button type="button" onClick={() => setLocale("it-IT")}>
        switch-it
      </button>
      <button type="button" onClick={() => setLocale("en")}>
        switch-en
      </button>
    </>
  );
}

function storeContext(): StoreContext {
  const activeStore = {
    id: "store-a",
    membershipId: "membership-store-a",
    name: "Ripara Subito 北店",
    slug: "ripara-subito",
    role: "owner" as const,
    status: "active" as const,
  };
  return {
    activeStore,
    stores: [activeStore],
    permissions: {
      canReadStoreSettings: true,
      canUpdateStoreSettings: true,
      canReadSuppliers: true,
      canAssignSuppliers: true,
      canManageSuppliers: true,
      canConfigureWorkflow: true,
      canReadMessageTemplates: true,
      canUpdateMessageTemplates: true,
      canListMembers: true,
      canInviteMembers: true,
      canManageMembers: true,
      canRevokeMembers: true,
      canGrantManager: true,
      canReviewAccessRequests: true,
      canManageKioskDevices: true,
      canReviewKioskSessions: true,
      canManageOrderData: true,
      canApplyOrderData: true,
    },
  };
}

function storeSettings(): StoreSettings {
  return {
    id: "settings-store-a",
    store_id: "store-a",
    store_name: "Ripara Subito 北店",
    store_address: "Via Roma 12",
    store_phone: "+39 06 0000 0000",
    store_whatsapp: "+39 333 000 0000",
    store_email: "store@example.test",
    default_order_warranty_text: "6 mesi",
    default_order_warranty_months: 6,
    default_inventory_warranty_months: 12,
    print_footer: "Grazie per averci scelto.",
    message_signature: "Ripara Subito 北店",
    created_at: "2026-09-03T08:00:00.000Z",
    updated_at: "2026-09-03T08:00:00.000Z",
  };
}

function settingsMemberFixture(): StoreMember {
  return {
    id: "member-a",
    user_id: "user-a",
    email: "staff@example.test",
    display_name: "Staff",
    role: "technician",
    status: "active",
    permission_grants: ["supplier:read"],
    management: {
      allowed_roles: ["manager", "technician", "sales", "viewer"],
      can_update_role: true,
      can_update_permissions: true,
      can_disable: true,
      can_restore: false,
    },
    created_at: "2026-07-12T00:00:00.000Z",
    updated_at: "2026-07-12T00:00:00.000Z",
  };
}
