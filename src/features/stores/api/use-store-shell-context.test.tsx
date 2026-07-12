import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ordersKeys } from "@/features/orders/api/query-keys";
import { platformKeys } from "@/features/platform/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";

import { useStoreShellContext } from "./use-store-shell-context";

describe("useStoreShellContext authority monitoring", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
