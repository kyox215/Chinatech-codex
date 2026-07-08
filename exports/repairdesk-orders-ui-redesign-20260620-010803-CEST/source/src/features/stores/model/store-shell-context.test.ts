import { describe, expect, it } from "vitest";

import type { ActorStoreMembership, OnboardingStatus, StoreContext } from "@/lib/repairdesk/types";

import { resolveStoreShellContext } from "./store-shell-context";

function makeStore(overrides: Partial<ActorStoreMembership> = {}): ActorStoreMembership {
  return {
    id: overrides.id ?? "store_1",
    name: overrides.name ?? "ChinaTech",
    slug: overrides.slug ?? "chinatech",
    role: overrides.role ?? "owner",
    status: overrides.status ?? "active",
  };
}

function makeOnboardingStatus(overrides: Partial<OnboardingStatus> = {}): OnboardingStatus {
  return {
    email: overrides.email ?? "owner@example.com",
    displayName: overrides.displayName ?? "最高管理员",
    isPlatformAdmin: overrides.isPlatformAdmin ?? false,
    activeStore: overrides.activeStore,
    stores: overrides.stores ?? [],
    requests: overrides.requests ?? [],
    availableStores: overrides.availableStores ?? [],
  };
}

describe("resolveStoreShellContext", () => {
  it("prefers the live store context and keeps the active store first", () => {
    const fallbackStore = makeStore({ id: "store_1", name: "Old ChinaTech" });
    const activeStore = makeStore({ id: "store_2", name: "Siracusa" });
    const storeContext: StoreContext = {
      activeStore,
      stores: [makeStore({ id: "store_3", name: "Floridia" }), activeStore],
    };

    const snapshot = resolveStoreShellContext({
      onboardingStatus: makeOnboardingStatus({
        activeStore: fallbackStore,
        stores: [fallbackStore],
      }),
      storeContext,
    });

    expect(snapshot).toMatchObject({
      activeStore,
      status: "ready",
      isLoading: false,
      isError: false,
      isDegraded: false,
      canSwitchStore: true,
    });
    expect(snapshot.stores.map((store) => store.id)).toEqual(["store_2", "store_3", "store_1"]);
  });

  it("uses onboarding store data as a safe fallback when live context fails", () => {
    const activeStore = makeStore();

    const snapshot = resolveStoreShellContext({
      onboardingStatus: makeOnboardingStatus({
        activeStore,
        stores: [activeStore],
      }),
      storeContextError: true,
    });

    expect(snapshot).toMatchObject({
      activeStore,
      status: "degraded",
      isLoading: false,
      isRefreshing: false,
      isError: false,
      isDegraded: true,
      statusLabel: "店铺已缓存",
    });
  });

  it("treats store context loading as a background refresh when onboarding has a store", () => {
    const activeStore = makeStore();

    const snapshot = resolveStoreShellContext({
      onboardingStatus: makeOnboardingStatus({
        activeStore,
        stores: [activeStore],
      }),
      storeContextLoading: true,
    });

    expect(snapshot).toMatchObject({
      activeStore,
      status: "ready",
      isLoading: false,
      isRefreshing: true,
      isError: false,
    });
  });

  it("supports platform-only admins without forcing onboarding", () => {
    const snapshot = resolveStoreShellContext({
      onboardingStatus: makeOnboardingStatus({ isPlatformAdmin: true }),
    });

    expect(snapshot).toMatchObject({
      activeStore: undefined,
      stores: [],
      isPlatformAdmin: true,
      status: "platform_admin",
      statusLabel: "平台管理员",
      isError: false,
    });
  });

  it("distinguishes users who need onboarding from hard loading failures", () => {
    expect(
      resolveStoreShellContext({
        onboardingStatus: makeOnboardingStatus(),
      }).status,
    ).toBe("onboarding_required");

    expect(
      resolveStoreShellContext({
        onboardingError: true,
      }),
    ).toMatchObject({
      status: "error",
      isError: true,
      statusLabel: "店铺读取失败",
    });
  });
});
