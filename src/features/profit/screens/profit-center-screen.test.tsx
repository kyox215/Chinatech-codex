import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProfitCenterResult } from "@/lib/repairdesk/types";
import { SidebarProvider } from "@/components/ui/sidebar";

const apiMocks = vi.hoisted(() => ({ getProfitCenter: vi.fn() }));
const shellMocks = vi.hoisted(() => ({
  value: {
    isLoading: false,
    activeStore: { id: "store-1" },
    permissions: { canReadRepairProfitReports: true },
  },
}));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  getProfitCenter: apiMocks.getProfitCenter,
}));
vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: () => shellMocks.value,
}));
vi.mock("recharts", () => ({
  CartesianGrid: () => null,
  Legend: () => null,
  Line: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

import { ProfitCenterScreen } from "./profit-center-screen";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  shellMocks.value = {
    isLoading: false,
    activeStore: { id: "store-1" },
    permissions: { canReadRepairProfitReports: true },
  };
  apiMocks.getProfitCenter.mockResolvedValue(fixture());
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

describe("ProfitCenterScreen", () => {
  it("renders no financial request or values without the capability", async () => {
    shellMocks.value.permissions.canReadRepairProfitReports = false;
    renderScreen();

    expect(screen.getByText("此页面仅对获授权人员开放")).toBeVisible();
    expect(screen.queryByText("预计维修毛利")).not.toBeInTheDocument();
    await waitFor(() => expect(apiMocks.getProfitCenter).not.toHaveBeenCalled());
  });

  it("distinguishes unknown from an explicit zero cost", async () => {
    const user = userEvent.setup();
    renderScreen();

    expect(await screen.findByText("预计维修毛利")).toBeVisible();
    expect(screen.getByText("待补成本")).toBeVisible();
    expect(screen.getAllByText("€0.00").length).toBeGreaterThan(0);
    expect(screen.getByText(/未知不按 0 计算/)).toBeVisible();
    expect(screen.getByText(/不是会计净利润/)).toBeVisible();
    expect(screen.getByText("维修类别与供应商毛利拆分")).toBeVisible();
    expect(screen.getByText("UTOPYA")).toBeVisible();
    expect(apiMocks.getProfitCenter).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "按月" }));
    expect(screen.getByText("每月毛利趋势")).toBeVisible();
  });
});

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <ProfitCenterScreen />
      </SidebarProvider>
    </QueryClientProvider>,
  );
}

function fixture(): ProfitCenterResult {
  const period = {
    order_count: 2,
    eligible_order_count: 2,
    quote_amount: 130,
    known_cost_amount: 15,
    exact_margin_amount: 40,
    exact_order_count: 1,
    incomplete_order_count: 1,
    estimated_order_count: 0,
    negative_margin_order_count: 0,
  };
  return {
    timezone: "Europe/Rome",
    start_date: "2026-07-01",
    end_date: "2026-07-18",
    definition: "final_quote_operational_gross_margin",
    summary: {
      expected: period,
      completed: { ...period, order_count: 0, eligible_order_count: 0 },
      data_quality: { unknown_line_count: 1, refunded_order_count: 0, rework_order_count: 0 },
      collection_reference: { amount: 0, entry_count: 0, non_eur_entry_count: 0 },
    },
    trend: [],
    breakdowns: {
      categories: [
        {
          key: "screen",
          label: "屏幕",
          order_count: 1,
          line_count: 1,
          quote_amount: 40,
          known_cost_amount: 0,
          exact_margin_amount: 40,
          exact_line_count: 1,
          incomplete_line_count: 0,
        },
      ],
      suppliers: [
        {
          key: "supplier-1",
          label: "UTOPYA",
          order_count: 1,
          line_count: 1,
          quote_amount: 40,
          known_cost_amount: 0,
          exact_margin_amount: 40,
          exact_line_count: 1,
          incomplete_line_count: 0,
        },
      ],
    },
    orders: [
      {
        order_id: "order-unknown",
        public_no: "R-UNKNOWN",
        status: "received",
        payment_status: "unpaid",
        created_at: "2026-07-18T08:00:00Z",
        quote_amount: 90,
        known_cost_amount: 15,
        quote_gross_margin: null,
        quote_gross_margin_percent: null,
        quote_line_count: 2,
        unknown_cost_line_count: 1,
        estimated_cost_line_count: 0,
        confirmed_cost_line_count: 1,
        cost_completeness: "incomplete",
        is_refunded: false,
        is_rework: false,
      },
      {
        order_id: "order-zero",
        public_no: "R-ZERO",
        status: "ready",
        payment_status: "unpaid",
        created_at: "2026-07-18T09:00:00Z",
        quote_amount: 40,
        known_cost_amount: 0,
        quote_gross_margin: 40,
        quote_gross_margin_percent: 100,
        quote_line_count: 1,
        unknown_cost_line_count: 0,
        estimated_cost_line_count: 0,
        confirmed_cost_line_count: 1,
        cost_completeness: "confirmed",
        is_refunded: false,
        is_rework: false,
      },
    ],
  };
}
