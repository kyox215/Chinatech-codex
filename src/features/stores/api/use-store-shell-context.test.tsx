import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ordersKeys } from "@/features/orders/api/query-keys";
import { aiAssistantKeys } from "@/features/ai-assistant/api";
import { platformKeys } from "@/features/platform/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";

import { useStoreShellContext } from "./use-store-shell-context";

describe("useStoreShellContext authority monitoring", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hydrates onboarding and store context with one bootstrap request", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const activeStore = {
      id: "store_1",
      name: "ChinaTech",
      slug: "chinatech",
      role: "manager" as const,
      status: "active" as const,
      membershipId: "membership_manager",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (!path.endsWith("/shell/bootstrap")) {
        return new Response(JSON.stringify({ error: "unexpected legacy request" }), {
          status: 500,
        });
      }
      return new Response(
        JSON.stringify({
          data: {
            onboarding: {
              userId: "user_1",
              displayName: "Manager",
              isPlatformAdmin: false,
              activeStore,
              stores: [activeStore],
              requests: [],
              availableStores: [],
            },
            storeContext: {
              activeStore,
              stores: [activeStore],
              permissions: { canReadAggregateFinance: false },
            },
            aiCapabilities: {
              canUseOrderAssistant: false,
              canUseOrderInlineActions: false,
              canUseVisionIntake: false,
              canApplyInventoryDraft: false,
              reason: "feature_off",
            },
            generatedAt: "2026-07-23T16:00:00.000Z",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useStoreShellContext(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/shell/bootstrap");
    expect(result.current.activeStore?.id).toBe("store_1");

    unmount();
    queryClient.clear();
  });

  it.each([404, 405, 501])(
    "falls back to the legacy shell endpoints when bootstrap returns %s",
    async (status) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const activeStore = {
        id: "store_legacy",
        name: "Legacy Store",
        slug: "legacy-store",
        role: "manager" as const,
        status: "active" as const,
        membershipId: "membership_manager",
      };
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path.endsWith("/shell/bootstrap")) {
          return new Response(JSON.stringify({ error: "Not available" }), { status });
        }
        if (path.endsWith("/onboarding/status")) {
          return Response.json({
            data: {
              userId: "user_legacy",
              displayName: "Manager",
              isPlatformAdmin: false,
              activeStore,
              stores: [activeStore],
              requests: [],
              availableStores: [],
            },
          });
        }
        if (path.endsWith("/stores/context")) {
          return Response.json({
            data: {
              activeStore,
              stores: [activeStore],
              permissions: { canReadAggregateFinance: false },
            },
          });
        }
        if (path.endsWith("/ai/capabilities")) {
          return Response.json({
            data: {
              canUseOrderAssistant: false,
              canUseOrderInlineActions: false,
              canUseVisionIntake: false,
              canApplyInventoryDraft: false,
              reason: "feature_off",
            },
          });
        }
        return new Response(JSON.stringify({ error: "Unexpected request" }), { status: 500 });
      });
      vi.stubGlobal("fetch", fetchMock);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
      const { result, unmount } = renderHook(() => useStoreShellContext(), { wrapper });

      await waitFor(() => expect(result.current.status).toBe("ready"));
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(
        expect.arrayContaining([
          expect.stringContaining("/shell/bootstrap"),
          expect.stringContaining("/onboarding/status"),
          expect.stringContaining("/stores/context"),
          expect.stringContaining("/ai/capabilities"),
        ]),
      );

      unmount();
      queryClient.clear();
    },
  );

  it.each([401, 403])(
    "fails closed without legacy fallback when bootstrap returns %s",
    async (status) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      queryClient.setQueryData(storesKeys.context, { activeStore: { id: "store_old" } });
      queryClient.setQueryData(platformKeys.onboardingStatus, {
        activeStore: { id: "store_old" },
      });
      queryClient.setQueryData(aiAssistantKeys.capabilities("store_old"), { stale: true });
      queryClient.setQueryData(ordersKeys.detail("order_old", "store_old"), { id: "order_old" });
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Authority lost" }), {
            status,
            headers: { "content-type": "application/json" },
          }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
      const { result, unmount } = renderHook(() => useStoreShellContext(), { wrapper });

      await waitFor(() => expect(result.current.status).toBe("error"));
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(queryClient.getQueryData(storesKeys.bootstrap)).toBeUndefined();
      expect(queryClient.getQueryData(storesKeys.context)).toBeUndefined();
      expect(queryClient.getQueryData(platformKeys.onboardingStatus)).toBeUndefined();
      expect(queryClient.getQueryData(aiAssistantKeys.capabilities("store_old"))).toBeUndefined();
      expect(queryClient.getQueryData(ordersKeys.detail("order_old", "store_old"))).toBeUndefined();

      unmount();
      queryClient.clear();
    },
  );

  it("removes stale tenant data before paint when store access returns 403", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const activeStore = {
      id: "store_1",
      name: "ChinaTech",
      slug: "chinatech",
      role: "technician" as const,
      status: "active" as const,
      membershipId: "membership_technician",
    };
    const onboarding = {
      userId: "user_1",
      email: "tech@example.com",
      displayName: "Technician",
      isPlatformAdmin: false,
      activeStore,
      stores: [activeStore],
      requests: [],
      availableStores: [],
    };
    const context = {
      activeStore,
      stores: [activeStore],
      permissions: { canReadAggregateFinance: false },
    };

    queryClient.setQueryData(platformKeys.onboardingStatus, onboarding);
    queryClient.setQueryData(storesKeys.context, context);
    queryClient.setQueryData(ordersKeys.detail("order_1", "store_1"), {
      id: "order_1",
      customer_phone: "+39 333 000 0000",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path.endsWith("/onboarding/status")) {
          return new Response(JSON.stringify({ data: onboarding }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (path.endsWith("/stores/context")) {
          return new Response(JSON.stringify({ error: "Store access revoked" }), {
            status: 403,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
      }),
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useStoreShellContext({ monitorAuthority: true }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.activeStore).toBeUndefined();
    expect(result.current.permissions).toBeUndefined();
    expect(queryClient.getQueryData(ordersKeys.detail("order_1", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.context)).toBeUndefined();
    expect(queryClient.getQueryData(platformKeys.onboardingStatus)).toBeUndefined();

    unmount();
    queryClient.clear();
  });
});
