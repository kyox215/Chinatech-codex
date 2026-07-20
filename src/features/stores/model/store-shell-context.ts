import type { ActorStoreMembership, OnboardingStatus, StoreContext } from "@/lib/repairdesk/types";

export type StoreShellStatus =
  | "loading"
  | "ready"
  | "degraded"
  | "platform_admin"
  | "recovery_only"
  | "onboarding_required"
  | "error";

export interface StoreShellContextSnapshot {
  userId?: string;
  email?: string;
  displayName?: string;
  activeStore?: ActorStoreMembership;
  permissions?: StoreContext["permissions"];
  authorityFingerprint: string;
  stores: ActorStoreMembership[];
  recoveryStores?: ActorStoreMembership[];
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
  authorityLost?: boolean;
}

export function resolveStoreShellContext({
  onboardingStatus,
  storeContext,
  onboardingLoading = false,
  storeContextLoading = false,
  onboardingError = false,
  storeContextError = false,
  authorityLost = false,
}: ResolveStoreShellContextInput): StoreShellContextSnapshot {
  const activeStore = authorityLost
    ? undefined
    : (storeContext?.activeStore ?? onboardingStatus?.activeStore);
  const stores = authorityLost
    ? []
    : normalizeStores(activeStore, storeContext?.stores, onboardingStatus?.stores);
  const recoveryStores = authorityLost ? [] : (storeContext?.recoveryStores ?? []);
  const isPlatformAdmin = Boolean(onboardingStatus?.isPlatformAdmin);
  const hasUsableIdentity = Boolean(activeStore || isPlatformAdmin || recoveryStores.length > 0);
  const isInitialLoading = !authorityLost && onboardingLoading && !hasUsableIdentity;
  const isRefreshing = Boolean(
    !authorityLost &&
    hasUsableIdentity &&
    (onboardingLoading || (Boolean(onboardingStatus?.activeStore) && storeContextLoading)),
  );
  const isDegraded = Boolean(
    !authorityLost &&
    hasUsableIdentity &&
    (onboardingError || (storeContextError && Boolean(activeStore))),
  );
  const isError = Boolean(
    authorityLost || (!hasUsableIdentity && (onboardingError || storeContextError)),
  );
  const status = getStoreShellStatus({
    activeStore,
    isPlatformAdmin,
    isLoading: isInitialLoading,
    isError,
    isDegraded,
    hasRecoveryStores: recoveryStores.length > 0,
  });
  const copy = getStoreShellStatusCopy(status);
  const authorityFingerprint = createAuthorityFingerprint({
    userId: onboardingStatus?.userId,
    activeStore,
    permissions: authorityLost ? undefined : storeContext?.permissions,
    recoveryStores,
  });

  return {
    userId: onboardingStatus?.userId,
    email: onboardingStatus?.email,
    displayName: onboardingStatus?.displayName,
    activeStore,
    permissions: authorityLost ? undefined : storeContext?.permissions,
    authorityFingerprint,
    stores,
    recoveryStores,
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

export function createAuthorityFingerprint({
  userId,
  activeStore,
  permissions,
  recoveryStores = [],
}: {
  userId?: string;
  activeStore?: ActorStoreMembership;
  permissions?: StoreContext["permissions"];
  recoveryStores?: ActorStoreMembership[];
}) {
  const permissionBits = Object.entries(permissions ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([action, allowed]) => `${action}:${allowed ? 1 : 0}`)
    .join(",");
  return [
    userId ?? "anonymous",
    activeStore?.id ?? "no-store",
    activeStore?.membershipId ?? "no-membership",
    activeStore?.role ?? "no-role",
    ...(recoveryStores.length > 0
      ? [
          recoveryStores
            .map(
              (store) =>
                `${store.id}:${store.lifecycle?.phase ?? "unknown"}:${store.lifecycle?.revision ?? 0}`,
            )
            .sort()
            .join(","),
        ]
      : []),
    permissionBits || "no-permissions",
  ].join("|");
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
  hasRecoveryStores,
}: {
  activeStore?: ActorStoreMembership;
  isPlatformAdmin: boolean;
  isLoading: boolean;
  isError: boolean;
  isDegraded: boolean;
  hasRecoveryStores: boolean;
}): StoreShellStatus {
  if (isLoading) return "loading";
  if (isError) return "error";
  if (activeStore) return isDegraded ? "degraded" : "ready";
  if (hasRecoveryStores) return "recovery_only";
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
    case "recovery_only":
      return {
        label: "店铺已关闭",
        description: "当前没有营业中的店铺，可前往已关闭店铺恢复。",
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
