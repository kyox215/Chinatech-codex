import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveStoreOutputIdentity } from "@/entities/store/model/store-output-identity";
import type { StoreSettingsDraftValues } from "@/features/settings/model/store-settings-draft";
import { getStoreSettingsReadiness } from "@/features/settings/model/store-settings-readiness";
import { StoreSettingsSectionContent } from "@/features/settings/sections/store-settings-section";
import type {
  ActorStoreMembership,
  StoreLifecycleCapability,
  StoreSettings,
} from "@/lib/repairdesk/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

afterEach(cleanup);

const store: ActorStoreMembership = {
  id: "store-a",
  membershipId: "membership-a",
  name: "Repair Lab",
  slug: "repair-lab",
  role: "owner",
  status: "active",
};

const completeSettings: StoreSettings = {
  id: "settings-a",
  store_id: "store-a",
  store_name: "Repair Lab",
  store_address: "Via Roma 12, Siracusa",
  store_phone: "+39 000 000000",
  store_whatsapp: "",
  store_email: "repair@example.test",
  public_base_url: "",
  default_order_warranty_text: "6个月",
  default_order_warranty_months: 6,
  default_inventory_warranty_months: 12,
  print_footer: "Grazie per aver scelto Repair Lab.",
  message_signature: "Repair Lab · Assistenza",
  created_at: "2026-07-12T00:00:00.000Z",
  updated_at: "2026-07-12T00:00:00.000Z",
};

describe("StoreSettingsSectionContent", () => {
  it("edits only the profile draft and keeps creation independently reachable", () => {
    const onDraftChange = vi.fn();
    const onCreateStore = vi.fn();
    const view = renderStore({ onDraftChange, onCreateStore });

    fireEvent.change(screen.getByLabelText("收据和客户消息显示名称"), {
      target: { value: "Repair Lab Due" },
    });
    expect(onDraftChange).toHaveBeenCalledWith({ store_name: "Repair Lab Due" });
    fireEvent.change(screen.getByLabelText("客户门户域名"), {
      target: { value: "https://repair.example.test" },
    });
    expect(onDraftChange).toHaveBeenCalledWith({
      public_base_url: "https://repair.example.test",
    });
    expect(screen.getByText("店主")).toBeInTheDocument();

    view.rerender(storeSection({ newStoreName: "A", onDraftChange, onCreateStore }));
    const createInput = screen.getByLabelText("新店铺名称");
    fireEvent.keyDown(createInput, { key: "Enter" });
    expect(onCreateStore).not.toHaveBeenCalled();

    view.rerender(
      storeSection({
        newStoreName: "Second Lab",
        newStoreAddress: "Via Etnea 24, Catania",
        onDraftChange,
        onCreateStore,
      }),
    );
    fireEvent.keyDown(screen.getByLabelText("新店铺名称"), { key: "Enter" });
    expect(onCreateStore).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "确认创建独立店铺？" })).toHaveTextContent(
      "Second Lab",
    );
    expect(screen.getByRole("alertdialog", { name: "确认创建独立店铺？" })).toHaveTextContent(
      "Via Etnea 24, Catania",
    );
    fireEvent.click(screen.getByRole("button", { name: "确认创建并切换" }));
    expect(onCreateStore).toHaveBeenCalledTimes(1);
  });

  it("uses semantic read-only values without hiding independent store creation", () => {
    const { container } = renderStore({ canUpdateSettings: false });
    const details = container.querySelector("dl");

    expect(screen.queryByLabelText("店铺名")).not.toBeInTheDocument();
    expect(details).not.toBeNull();
    expect(within(details as HTMLElement).getByText("店铺名").tagName).toBe("DT");
    expect(within(details as HTMLElement).getByText("Repair Lab").tagName).toBe("DD");
    expect(screen.getByLabelText("新店铺名称")).toBeEnabled();
    expect(screen.getByLabelText("默认打印地址（可选）")).toBeEnabled();
    expect(screen.getByText("当前账号可查看店铺资料；修改请联系店主或经理。")).toBeVisible();
  });

  it("keeps actual output blocked until a complete draft is saved", () => {
    const saved = { ...completeSettings, store_address: "" };
    renderStore({ saved, draft: toStoreDraft(completeSettings), isDraftDirty: true });

    expect(screen.getByText("当前已暂停")).toBeInTheDocument();
    expect(screen.getByText(/当前客户输出仍然阻断；保存这份草稿后预计解除阻断/)).toBeVisible();
    expect(screen.queryByText("当前已就绪")).not.toBeInTheDocument();
  });

  it("warns before a ready server profile would be degraded by the draft", () => {
    renderStore({
      saved: completeSettings,
      draft: toStoreDraft({ ...completeSettings, store_phone: "", store_email: "" }),
      isDraftDirty: true,
    });

    expect(screen.getByText("当前已就绪")).toBeInTheDocument();
    expect(screen.getByText(/保存这份草稿后将阻断客户消息、打印和票据/)).toBeVisible();
  });

  it("keeps switch and creation failures visible inside their own cards", () => {
    renderStore({
      newStoreName: "Second Lab",
      switchError: "network unavailable",
      createError: "name already exists",
    });

    expect(screen.getByText(/店铺切换失败：network unavailable/)).toBeVisible();
    expect(screen.getByText(/店铺创建失败：name already exists/)).toBeVisible();
    expect(screen.getByLabelText("新店铺名称")).toHaveValue("Second Lab");
  });

  it("shows the close-and-delete entry only for an explicitly selected active primary-owner store", () => {
    const activeStore: ActorStoreMembership = {
      ...store,
      lifecycle: { store_id: store.id, phase: "active", revision: 1 },
    };
    const lifecycleAccess = availableLifecycleAccess(store.id);

    const view = renderStore({ storeOverride: activeStore, lifecycleAccess });
    expect(screen.getByRole("heading", { name: "关闭与删除店铺" })).toBeVisible();
    expect(view.container.querySelector("[data-store-lifecycle-actions]")).not.toBeInTheDocument();

    view.rerender(
      <QueryClientProvider client={view.queryClient}>
        {storeSection({
          storeOverride: activeStore,
          lifecycleAccess,
          activeStoreExplicit: false,
        })}
      </QueryClientProvider>,
    );
    expect(screen.queryByRole("heading", { name: "关闭与删除店铺" })).not.toBeInTheDocument();
  });

  it("does not show an active delete entry for archived or unknown lifecycle states", () => {
    const lifecycleAccess = availableLifecycleAccess(store.id);

    const view = renderStore({
      storeOverride: {
        ...store,
        lifecycle: { store_id: store.id, phase: "archived", revision: 1 },
      },
      lifecycleAccess,
    });
    expect(screen.queryByRole("heading", { name: "关闭与删除店铺" })).not.toBeInTheDocument();

    view.rerender(
      <QueryClientProvider client={view.queryClient}>
        {storeSection({ storeOverride: store, lifecycleAccess })}
      </QueryClientProvider>,
    );
    expect(screen.queryByRole("heading", { name: "关闭与删除店铺" })).not.toBeInTheDocument();
  });
});

function renderStore({
  saved = completeSettings,
  draft = toStoreDraft(completeSettings),
  isDraftDirty = false,
  canUpdateSettings = true,
  newStoreName = "",
  newStoreAddress = "",
  switchError,
  createError,
  onDraftChange = vi.fn(),
  onCreateStore = vi.fn(),
  storeOverride = store,
  activeStoreExplicit = true,
  lifecycleAccess,
}: {
  saved?: StoreSettings;
  draft?: StoreSettingsDraftValues["store"];
  isDraftDirty?: boolean;
  canUpdateSettings?: boolean;
  newStoreName?: string;
  newStoreAddress?: string;
  switchError?: string;
  createError?: string;
  onDraftChange?: (patch: Partial<StoreSettingsDraftValues["store"]>) => void;
  onCreateStore?: () => void;
  storeOverride?: ActorStoreMembership;
  activeStoreExplicit?: boolean;
  lifecycleAccess?: StoreLifecycleCapability;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      {storeSection({
        saved,
        draft,
        isDraftDirty,
        canUpdateSettings,
        newStoreName,
        newStoreAddress,
        switchError,
        createError,
        onDraftChange,
        onCreateStore,
        storeOverride,
        activeStoreExplicit,
        lifecycleAccess,
      })}
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

function storeSection({
  saved = completeSettings,
  draft = toStoreDraft(completeSettings),
  isDraftDirty = false,
  canUpdateSettings = true,
  newStoreName = "",
  newStoreAddress = "",
  switchError,
  createError,
  onDraftChange = vi.fn(),
  onCreateStore = vi.fn(),
  storeOverride = store,
  activeStoreExplicit = true,
  lifecycleAccess,
}: {
  saved?: StoreSettings;
  draft?: StoreSettingsDraftValues["store"];
  isDraftDirty?: boolean;
  canUpdateSettings?: boolean;
  newStoreName?: string;
  newStoreAddress?: string;
  switchError?: string;
  createError?: string;
  onDraftChange?: (patch: Partial<StoreSettingsDraftValues["store"]>) => void;
  onCreateStore?: () => void;
  storeOverride?: ActorStoreMembership;
  activeStoreExplicit?: boolean;
  lifecycleAccess?: StoreLifecycleCapability;
} = {}) {
  const draftSettings = { ...saved, ...draft };
  return (
    <StoreSettingsSectionContent
      activeStoreId={storeOverride.id}
      activeStoreExplicit={activeStoreExplicit}
      stores={[storeOverride]}
      isContextLoading={false}
      isSwitching={false}
      isCreating={false}
      switchError={switchError}
      createError={createError}
      newStoreName={newStoreName}
      newStoreAddress={newStoreAddress}
      onNewStoreNameChange={vi.fn()}
      onNewStoreAddressChange={vi.fn()}
      onSwitchStore={vi.fn()}
      onCreateStore={onCreateStore}
      draft={draft}
      savedReadiness={getStoreSettingsReadiness(saved)}
      draftReadiness={getStoreSettingsReadiness(draftSettings)}
      lifecycleAccess={lifecycleAccess}
      savedOutputIdentity={resolveStoreOutputIdentity({
        activeStore: storeOverride,
        settings: saved,
      })}
      draftOutputIdentity={resolveStoreOutputIdentity({
        activeStore: storeOverride,
        settings: draftSettings,
      })}
      isDraftDirty={isDraftDirty}
      canUpdateSettings={canUpdateSettings}
      fieldErrors={{}}
      onDraftChange={onDraftChange}
    />
  );
}

function availableLifecycleAccess(storeId: string): StoreLifecycleCapability {
  const available = { allowed: true, code: "available" as const };
  return {
    store_id: storeId,
    check: available,
    rename: available,
    close: available,
    restore: available,
    purge: available,
  };
}

function toStoreDraft(settings: StoreSettings): StoreSettingsDraftValues["store"] {
  return {
    store_name: settings.store_name,
    store_address: settings.store_address,
    store_phone: settings.store_phone,
    store_whatsapp: settings.store_whatsapp,
    store_email: settings.store_email,
    public_base_url: settings.public_base_url ?? "",
  };
}
