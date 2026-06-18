import type { ActorStoreMembership, OnboardingStatus, StoreContext } from "@/lib/repairdesk/types";

export type StoreShellStatus =
  | "loading"
  | "ready"
  | "degraded"
  | "platform_admin"
  | "onboarding_required"
  | "error";

export interface StoreShellContextSnapshot {
  activeStore?: ActorStoreMembership;
  stores: ActorStoreMembership[];
  isPlatformAdmin: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  isError: boolean;
  isDegraded: boolean;
  canSwitchStore: boolean;
  status: StoreShellStatus;
  statusLabel: string;
  statusDescription: string;
}

export interface ResolveStoreShellContextInput {
  onboardingStatus?: OnboardingStatus;
  storeContext?: StoreContext;
  onboardingLoading?: boolean;
  storeContextLoading?: boolean;
  onboardingError?: boolean;
  storeContextError?: boolean;
}

export function resolveStoreShellContext({
  onboardingStatus,
  storeContext,
  onboardingLoading = false,
  storeContextLoading = false,
  onboardingError = false,
  storeContextError = false,
}: ResolveStoreShellContextInput): StoreShellContextSnapshot {
  const activeStore = storeContext?.activeStore ?? onboardingStatus?.activeStore;
  const stores = normalizeStores(activeStore, storeContext?.stores, onboardingStatus?.stores);
  const isPlatformAdmin = Boolean(onboardingStatus?.isPlatformAdmin);
  const hasUsableIdentity = Boolean(activeStore || isPlatformAdmin);
  const isInitialLoading = onboardingLoading && !hasUsableIdentity;
  const isRefreshing = Boolean(
    hasUsableIdentity &&
    (onboardingLoading || (Boolean(onboardingStatus?.activeStore) && storeContextLoading)),
  );
  const isDegraded = Boolean(
    hasUsableIdentity && (onboardingError || (storeContextError && Boolean(activeStore))),
  );
  const isError = Boolean(!hasUsableIdentity && (onboardingError || storeContextError));
  const status = getStoreShellStatus({
    activeStore,
    isPlatformAdmin,
    isLoading: isInitialLoading,
    isError,
    isDegraded,
  });
  const copy = getStoreShellStatusCopy(status);

  return {
    activeStore,
    stores,
    isPlatformAdmin,
    isLoading: isInitialLoading,
    isRefreshing,
    isError,
    isDegraded,
    canSwitchStore: stores.length > 1,
    status,
    statusLabel: copy.label,
    statusDescription: copy.description,
  };
}

function normalizeStores(
  activeStore: ActorStoreMembership | undefined,
  primaryStores: ActorStoreMembership[] | undefined,
  fallbackStores: ActorStoreMembership[] | undefined,
): ActorStoreMembership[] {
  const seen = new Set<string>();
  const stores: ActorStoreMembership[] = [];

  const push = (store: ActorStoreMembership | undefined) => {
    if (!store || seen.has(store.id)) return;
    seen.add(store.id);
    stores.push(store);
  };

  push(activeStore);
  primaryStores?.forEach(push);
  fallbackStores?.forEach(push);

  return stores;
}

function getStoreShellStatus({
  activeStore,
  isPlatformAdmin,
  isLoading,
  isError,
  isDegraded,
}: {
  activeStore?: ActorStoreMembership;
  isPlatformAdmin: boolean;
  isLoading: boolean;
  isError: boolean;
  isDegraded: boolean;
}): StoreShellStatus {
  if (isLoading) return "loading";
  if (isError) return "error";
  if (activeStore) return isDegraded ? "degraded" : "ready";
  if (isPlatformAdmin) return "platform_admin";
  return "onboarding_required";
}

function getStoreShellStatusCopy(status: StoreShellStatus): {
  label: string;
  description: string;
} {
  switch (status) {
    case "loading":
      return {
        label: "读取店铺",
        description: "正在确认当前账号可访问的店铺。",
      };
    case "ready":
      return {
        label: "店铺在线",
        description: "当前店铺上下文已同步。",
      };
    case "degraded":
      return {
        label: "店铺已缓存",
        description: "正在使用已知店铺信息，后台同步失败后仍可继续操作。",
      };
    case "platform_admin":
      return {
        label: "平台管理员",
        description: "当前账号可进入平台审批，但尚未选择具体店铺。",
      };
    case "onboarding_required":
      return {
        label: "等待开通",
        description: "当前账号还没有可用店铺，需要申请加入或创建店铺。",
      };
    case "error":
      return {
        label: "店铺读取失败",
        description: "无法确认账号店铺权限，请重新登录或稍后重试。",
      };
  }
}
