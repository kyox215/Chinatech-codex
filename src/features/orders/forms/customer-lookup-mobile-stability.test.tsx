import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { StoreShellContextSnapshot } from "@/features/stores/model/store-shell-context";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";

import { CustomerIntakeLookup } from "./customer-intake-lookup";
import { CustomerPhoneLookup } from "./customer-phone-lookup";

const apiMocks = vi.hoisted(() => ({
  searchCustomerIntakeCandidates: vi.fn(),
  searchCustomers: vi.fn(),
}));

vi.mock("@/lib/repairdesk/api", () => apiMocks);

vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: vi.fn(),
}));

const storeId = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

describe("customer lookup mobile stability", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    apiMocks.searchCustomerIntakeCandidates.mockReset();
    apiMocks.searchCustomers.mockReset();
    apiMocks.searchCustomerIntakeCandidates.mockResolvedValue([]);
    apiMocks.searchCustomers.mockResolvedValue([]);
    vi.mocked(useStoreShellContext).mockReturnValue(makeShellContext());
  });

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  });

  it("keeps the new-order intake popover closed until phone input reaches 3 digits", async () => {
    const user = userEvent.setup();

    renderWithClient(<CustomerIntakeLookupHarness />);

    await user.click(screen.getByRole("button", { name: "客户电话号码" }));
    await user.click(screen.getByRole("button", { name: "3" }));

    expect(screen.queryByRole("listbox", { name: "客户电话搜索结果" })).not.toBeInTheDocument();
    expect(apiMocks.searchCustomerIntakeCandidates).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "4" }));
    await user.click(screen.getByRole("button", { name: "5" }));

    expect(await screen.findByRole("listbox", { name: "客户电话搜索结果" })).toBeInTheDocument();
    await waitFor(() => {
      expect(apiMocks.searchCustomerIntakeCandidates).toHaveBeenCalledWith("345", 8, 4);
    });
  });

  it("keeps the reusable phone lookup popover closed until phone input reaches 3 digits", async () => {
    const user = userEvent.setup();

    renderWithClient(<CustomerPhoneLookupHarness />);

    const input = screen.getByRole("combobox");
    await user.type(input, "12");

    expect(screen.queryByRole("listbox", { name: "客户搜索结果" })).not.toBeInTheDocument();
    expect(apiMocks.searchCustomers).not.toHaveBeenCalled();

    await user.type(input, "3");

    expect(await screen.findByRole("listbox", { name: "客户搜索结果" })).toBeInTheDocument();
    await waitFor(() => {
      expect(apiMocks.searchCustomers).toHaveBeenCalledWith("123", 8);
    });
  });

  it("still opens lookup results for 2 text characters", async () => {
    const user = userEvent.setup();

    renderWithClient(<CustomerIntakeLookupHarness mode="name" />);

    await user.type(screen.getByRole("combobox"), "Al");

    expect(await screen.findByRole("listbox", { name: "客户姓名搜索结果" })).toBeInTheDocument();
    await waitFor(() => {
      expect(apiMocks.searchCustomerIntakeCandidates).toHaveBeenCalledWith("Al", 8, 4);
    });
  });
});

function CustomerIntakeLookupHarness({ mode = "phone" }: { mode?: "phone" | "name" }) {
  const [value, setValue] = useState("");

  return (
    <CustomerIntakeLookup
      mode={mode}
      value={value}
      onChange={setValue}
      onPickCustomer={() => undefined}
      onPickHistoryDevice={() => undefined}
    />
  );
}

function CustomerPhoneLookupHarness() {
  const [value, setValue] = useState("");

  return <CustomerPhoneLookup value={value} onChange={setValue} onPick={() => undefined} />;
}

function renderWithClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
}

function makeShellContext(): StoreShellContextSnapshot {
  const activeStore = {
    id: storeId,
    name: "Chinatech",
    slug: "chinatech",
    role: "owner",
    status: "active",
  } as const;

  return {
    authorityFingerprint: "test-authority",
    activeStore,
    stores: [activeStore],
    isPlatformAdmin: false,
    isLoading: false,
    isRefreshing: false,
    isError: false,
    isDegraded: false,
    canSwitchStore: false,
    status: "ready",
    statusLabel: "店铺在线",
    statusDescription: "当前店铺上下文已同步。",
  };
}
