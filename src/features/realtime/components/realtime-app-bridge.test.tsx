import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RepairDeskRealtimeChannel, RepairDeskRealtimeClient } from "../api/realtime-client";
import type { StoreShellContextSnapshot } from "@/features/stores/model/store-shell-context";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";

import { RealtimeAppBridge, getRepairDeskForegroundReconcileDomains } from "./realtime-app-bridge";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/orders"),
}));

vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: vi.fn(),
}));

const storeId = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";

describe("RealtimeAppBridge", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue("/orders");
  });

  it("renders children without subscribing when there is no active store", () => {
    const client = createMockRealtimeClient();
    mockStoreShellContext(makeShellContext());

    renderBridge({ client, enabled: true });

    expect(screen.getByTestId("bridge-child")).toBeInTheDocument();
    expect(useStoreShellContext).toHaveBeenCalledWith({ monitorAuthority: true });
    expect(client.channel).not.toHaveBeenCalled();
  });

  it("keeps the app-shell bridge default-off", () => {
    const client = createMockRealtimeClient();
    mockStoreShellContext(makeShellContext({ id: storeId }));

    renderBridge({ client });

    expect(client.channel).not.toHaveBeenCalled();
  });

  it("subscribes with the active store id when explicitly enabled", () => {
    const client = createMockRealtimeClient();
    mockStoreShellContext(makeShellContext({ id: storeId }));

    renderBridge({ client, domains: ["orders"], enabled: true });

    expect(client.channel).toHaveBeenCalledWith(`repairdesk:v1:store:${storeId}:orders`, {
      config: { private: true },
    });
  });

  it("subscribes to memos only on the memo route with the read capability", () => {
    vi.mocked(usePathname).mockReturnValue("/memos");
    const client = createMockRealtimeClient();
    mockStoreShellContext(makeShellContext({ id: storeId }, { canReadMemos: true }));

    renderBridge({ client, enabled: true });

    expect(client.channel).toHaveBeenCalledWith(`repairdesk:v1:store:${storeId}:memos`, {
      config: { private: true },
    });
  });

  it("does not subscribe to memos when the capability is absent", () => {
    vi.mocked(usePathname).mockReturnValue("/memos");
    const client = createMockRealtimeClient();
    mockStoreShellContext(makeShellContext({ id: storeId }, { canReadMemos: false }));

    renderBridge({ client, enabled: true });

    expect(client.channel).not.toHaveBeenCalledWith(`repairdesk:v1:store:${storeId}:memos`, {
      config: { private: true },
    });
  });

  it("keeps shell children mounted when the initial store authority finishes loading", () => {
    const client = createMockRealtimeClient();
    const onMount = vi.fn();
    const onUnmount = vi.fn();
    let shellContext = {
      ...makeShellContext({ id: storeId }),
      authorityFingerprint: `user|${storeId}|membership|owner|no-permissions`,
      isRefreshing: true,
    };
    vi.mocked(useStoreShellContext).mockImplementation(() => shellContext);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const renderTree = () => (
      <QueryClientProvider client={queryClient}>
        <RealtimeAppBridge client={client} enabled={false}>
          <LifecycleProbe onMount={onMount} onUnmount={onUnmount} />
        </RealtimeAppBridge>
      </QueryClientProvider>
    );
    const view = render(renderTree());

    shellContext = {
      ...shellContext,
      authorityFingerprint: `user|${storeId}|membership|owner|orders.read:1`,
      isRefreshing: false,
    };
    view.rerender(renderTree());

    expect(onMount).toHaveBeenCalledOnce();
    expect(onUnmount).not.toHaveBeenCalled();
  });

  it("remounts shell children after a later stable authority change", async () => {
    const client = createMockRealtimeClient();
    const onMount = vi.fn();
    const onUnmount = vi.fn();
    let shellContext = {
      ...makeShellContext({ id: storeId }),
      authorityFingerprint: `user|${storeId}|membership|owner|orders.read:1`,
    };
    vi.mocked(useStoreShellContext).mockImplementation(() => shellContext);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const renderTree = () => (
      <QueryClientProvider client={queryClient}>
        <RealtimeAppBridge client={client} enabled={false}>
          <LifecycleProbe onMount={onMount} onUnmount={onUnmount} />
        </RealtimeAppBridge>
      </QueryClientProvider>
    );
    const view = render(renderTree());

    shellContext = {
      ...shellContext,
      authorityFingerprint: `user|${storeId}|membership|owner|orders.read:0`,
    };
    view.rerender(renderTree());

    await waitFor(() => expect(onMount).toHaveBeenCalledTimes(2));
    expect(onUnmount).toHaveBeenCalledOnce();
  });

  it("limits the 30-second foreground reconcile to order and memo routes", () => {
    expect(getRepairDeskForegroundReconcileDomains("/orders")).toEqual(["orders"]);
    expect(getRepairDeskForegroundReconcileDomains("/orders/order-id")).toEqual(["orders"]);
    expect(getRepairDeskForegroundReconcileDomains("/memos", true)).toEqual(["memos"]);
    expect(getRepairDeskForegroundReconcileDomains("/memos", false)).toEqual([]);
    expect(getRepairDeskForegroundReconcileDomains("/customers")).toEqual([]);
    expect(getRepairDeskForegroundReconcileDomains(null)).toEqual([]);
  });
});

function LifecycleProbe({ onMount, onUnmount }: { onMount: () => void; onUnmount: () => void }) {
  useEffect(() => {
    onMount();
    return onUnmount;
  }, [onMount, onUnmount]);

  return <div data-testid="bridge-child" />;
}

function renderBridge({
  client,
  domains,
  enabled,
}: {
  client: RepairDeskRealtimeClient;
  domains?: Parameters<typeof RealtimeAppBridge>[0]["domains"];
  enabled?: boolean;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RealtimeAppBridge client={client} domains={domains} enabled={enabled}>
        <div data-testid="bridge-child" />
      </RealtimeAppBridge>
    </QueryClientProvider>,
  );
}

function mockStoreShellContext(context: StoreShellContextSnapshot) {
  vi.mocked(useStoreShellContext).mockReturnValue(context);
}

function makeShellContext(
  activeStore?: Partial<StoreShellContextSnapshot["activeStore"]>,
  permissions?: Partial<NonNullable<StoreShellContextSnapshot["permissions"]>>,
): StoreShellContextSnapshot {
  const resolvedActiveStore = activeStore
    ? {
        id: activeStore.id ?? storeId,
        name: activeStore.name ?? "Chinatech",
        slug: activeStore.slug ?? "chinatech",
        role: activeStore.role ?? "owner",
        status: activeStore.status ?? "active",
      }
    : undefined;

  return {
    authorityFingerprint: "test-authority",
    activeStore: resolvedActiveStore,
    stores: resolvedActiveStore ? [resolvedActiveStore] : [],
    isPlatformAdmin: false,
    isLoading: false,
    isRefreshing: false,
    isError: false,
    isDegraded: false,
    canSwitchStore: false,
    status: resolvedActiveStore ? "ready" : "onboarding_required",
    statusLabel: "店铺在线",
    statusDescription: "当前店铺上下文已同步。",
    permissions: permissions as StoreShellContextSnapshot["permissions"],
  };
}

function createMockRealtimeClient() {
  const channel = vi.fn((_topic: string, _options: { config: { private: true } }) => {
    const channelInstance: RepairDeskRealtimeChannel = {
      on: vi.fn(() => channelInstance),
      subscribe: vi.fn(() => channelInstance),
      unsubscribe: vi.fn(),
    };
    return channelInstance;
  });
  const removeChannel = vi.fn((_channel: RepairDeskRealtimeChannel) => undefined);
  const client: RepairDeskRealtimeClient & {
    channel: typeof channel;
    removeChannel: typeof removeChannel;
  } = {
    channel,
    removeChannel,
  };

  return client;
}
