import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { storesKeys } from "@/features/stores/api/query-keys";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import type { ProfitCenterResult, StoreContext } from "@/lib/repairdesk/types";
import { SidebarProvider } from "@/components/ui/sidebar";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

const apiMocks = vi.hoisted(() => ({ getProfitCenter: vi.fn(), exportCostReport: vi.fn() }));
type ShellMockValue = {
  isLoading: boolean;
  authorityFingerprint: string;
  activeStore?: {
    id: string;
    membershipId: string;
    name: string;
    slug: string;
    role: "owner" | "viewer";
    status: "active" | "inactive";
  };
  permissions?: { canReadRepairProfitReports: boolean; canExportRepairCosts: boolean };
};
const shellMocks = vi.hoisted(() => ({
  value: {
    isLoading: false,
    authorityFingerprint: "user-1|store-1|membership-1|owner|profit:1|export:0",
    activeStore: {
      id: "store-1",
      membershipId: "membership-1",
      name: "Dynamic 北店",
      slug: "dynamic-north",
      role: "owner" as const,
      status: "active" as const,
    },
    permissions: { canReadRepairProfitReports: true, canExportRepairCosts: false },
  } as ShellMockValue,
}));
let viewportWidth = 1280;
const downloads: Array<{ href: string; fileName: string }> = [];

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  getProfitCenter: apiMocks.getProfitCenter,
  exportCostReport: apiMocks.exportCostReport,
}));
vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: () => shellMocks.value,
}));
vi.mock("recharts", () => ({
  CartesianGrid: () => null,
  Legend: ({ formatter }: { formatter: (value: string) => string }) => (
    <div data-testid="chart-legend">
      {formatter("expected")} · {formatter("completed")}
    </div>
  ),
  Line: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ formatter }: { formatter: (value: number, name: string) => [string, string] }) => {
    const [, label] = formatter(12, "expected");
    return <div data-testid="chart-tooltip">{label}</div>;
  },
  XAxis: () => null,
  YAxis: () => null,
}));

import { defaultRange, localDate, ProfitCenterScreen } from "./profit-center-screen";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  shellMocks.value = {
    isLoading: false,
    authorityFingerprint: "user-1|store-1|membership-1|owner|profit:1|export:0",
    activeStore: {
      id: "store-1",
      membershipId: "membership-1",
      name: "Dynamic 北店",
      slug: "dynamic-north",
      role: "owner",
      status: "active",
    },
    permissions: { canReadRepairProfitReports: true, canExportRepairCosts: false },
  };
  viewportWidth = 1280;
  downloads.length = 0;
  apiMocks.getProfitCenter.mockResolvedValue(fixture());
  apiMocks.exportCostReport.mockResolvedValue({
    blob: new Blob(["csv"]),
    fileName: "repairdesk-cost-margin.csv",
  });
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:cost-export"),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push({ href: this.href, fileName: this.download });
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.startsWith("(min-width:")
        ? viewportWidth >= Number(query.match(/\d+/)?.[0] ?? 0)
        : query.startsWith("(max-width:")
          ? viewportWidth <= Number(query.match(/\d+/)?.[0] ?? 0)
          : false,
      media: query,
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
  it.each([
    ["zh-CN", "预计维修毛利", "导出成本 CSV", "订单级核对"],
    ["it-IT", "Margine riparazioni previsto", "Esporta costi CSV", "Verifica per ordine"],
    ["en", "Expected repair margin", "Export costs CSV", "Order-level review"],
  ] as const)(
    "localizes all staff presentation in %s without changing dynamic values",
    async (locale, metric, exportLabel, review) => {
      enableExport();
      const data = fixture();
      data.trend = [
        {
          date: "2026-07-18",
          expected_order_count: 1,
          expected_quote_amount: 40,
          expected_known_cost_amount: 0,
          expected_exact_margin_amount: 40,
          expected_incomplete_order_count: 0,
          completed_order_count: 1,
          completed_quote_amount: 40,
          completed_known_cost_amount: 0,
          completed_exact_margin_amount: 40,
          completed_incomplete_order_count: 0,
        },
      ];
      apiMocks.getProfitCenter.mockResolvedValue(data);
      renderScreen(locale);
      expect((await screen.findAllByText(metric))[0]).toBeVisible();
      expect(screen.getByRole("button", { name: exportLabel })).toBeVisible();
      expect(screen.getByText(review)).toBeVisible();
      expect(screen.getByText("UTOPYA")).toBeVisible();
      expect(screen.getAllByText("屏幕").length).toBeGreaterThan(0);
      expect(screen.getByText("R-UNKNOWN")).toHaveAttribute(
        "href",
        "/orders?workspace=order-detail&orderId=order-unknown&source=profit",
      );
      expect(screen.getByTestId("chart-legend")).toHaveTextContent(metric);
      expect(screen.getByTestId("chart-tooltip")).toHaveTextContent(metric);
    },
  );

  it.each([390, 430, 768])("renders only card drilldowns at %ipx", async (width) => {
    viewportWidth = width;
    renderScreen("en");
    await screen.findByText("Expected repair margin");
    expect(document.querySelectorAll('[data-layout="mobile-cards"]')).toHaveLength(3);
    expect(document.querySelectorAll('[data-layout="desktop-table"]')).toHaveLength(0);
    expect(screen.getByRole("link", { name: "R-UNKNOWN" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Apply dates" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveClass("min-h-11");
  });

  it.each([1024, 1280, 1440])("keeps the three desktop tables at %ipx", async (width) => {
    viewportWidth = width;
    renderScreen("en");
    await screen.findByText("Expected repair margin");
    expect(document.querySelectorAll('[data-layout="desktop-table"]')).toHaveLength(3);
    expect(document.querySelectorAll('[data-layout="mobile-cards"]')).toHaveLength(0);
  });

  it.each([
    ["zh-CN", ["成本不完整", "含估算", "已确认"], "已退款 · 汇总排除", "返修"],
    [
      "it-IT",
      ["Costo incompleto", "Include stime", "Confermato"],
      "Rimborsato · escluso dal riepilogo",
      "Rilavorazione",
    ],
    [
      "en",
      ["Incomplete cost", "Includes estimates", "Confirmed"],
      "Refunded · excluded from summary",
      "Rework",
    ],
  ] as const)(
    "maps canonical finance flags in %s without changing order values",
    async (locale, completeness, refunded, rework) => {
      const data = fixture();
      data.orders[0].is_refunded = true;
      data.orders[0].is_rework = true;
      data.orders.push({
        ...data.orders[1],
        order_id: "order-estimated",
        public_no: "R-ESTIMATED",
        cost_completeness: "estimated",
        estimated_cost_line_count: 1,
      });
      apiMocks.getProfitCenter.mockResolvedValue(data);
      renderScreen(locale);
      for (const label of completeness) expect(await screen.findByText(label)).toBeVisible();
      expect(screen.getByText(refunded)).toBeVisible();
      expect(screen.getByText(rework)).toBeVisible();
      expect(screen.getByText("R-ESTIMATED")).toHaveAttribute(
        "href",
        "/orders?workspace=order-detail&orderId=order-estimated&source=profit",
      );
    },
  );

  it("performs zero financial I/O without read permission", async () => {
    shellMocks.value.permissions!.canReadRepairProfitReports = false;
    shellMocks.value.permissions!.canExportRepairCosts = true;
    renderScreen("it-IT");
    expect(screen.getByText("Questa pagina è riservata agli utenti autorizzati")).toBeVisible();
    expect(screen.queryByText("R-UNKNOWN")).not.toBeInTheDocument();
    await waitFor(() => expect(apiMocks.getProfitCenter).not.toHaveBeenCalled());
    expect(apiMocks.exportCostReport).not.toHaveBeenCalled();
  });

  it("performs zero export I/O without the independent export permission", async () => {
    renderScreen("en");
    await screen.findByText("Expected repair margin");
    expect(screen.queryByRole("button", { name: "Export costs CSV" })).not.toBeInTheDocument();
    expect(apiMocks.exportCostReport).not.toHaveBeenCalled();
  });

  it.each(["desktop", "mobile", "retry"] as const)(
    "allows the %s refresh entry to issue exactly one GET",
    async (entry) => {
      if (entry === "mobile") viewportWidth = 768;
      if (entry === "retry") apiMocks.getProfitCenter.mockRejectedValue(new Error("SAFE_RETRY"));
      renderScreen("en");
      if (entry === "retry") {
        await screen.findByText("Could not load repair margin", undefined, { timeout: 4_000 });
        apiMocks.getProfitCenter.mockResolvedValue(fixture());
      } else {
        await screen.findByText("R-UNKNOWN");
      }
      apiMocks.getProfitCenter.mockClear();
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: entry === "retry" ? "Retry" : "Refresh" }));
      await waitFor(() => expect(apiMocks.getProfitCenter).toHaveBeenCalledTimes(1));
    },
  );

  it.each(["downgrade", "switch", "identity"] as const)(
    "blocks a stale refresh button after a no-rerender %s",
    async (change) => {
      const { queryClient } = renderScreen("en");
      await screen.findByText("R-UNKNOWN");
      const refresh = screen.getByRole("button", { name: "Refresh" });
      apiMocks.getProfitCenter.mockClear();
      setCachedAuthority(queryClient, change);
      fireEvent.click(refresh);
      await act(async () => Promise.resolve());
      expect(apiMocks.getProfitCenter).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["zh-CN", "请选择店铺", "选择当前店铺后才能读取财务汇总。"],
    [
      "it-IT",
      "Seleziona un negozio",
      "Seleziona il negozio attivo per caricare il riepilogo finanziario.",
    ],
    ["en", "Select a store", "Select the active store to load its financial summary."],
  ] as const)(
    "prioritizes the no-store state with undefined permissions in %s",
    (locale, title, description) => {
      shellMocks.value.activeStore = undefined;
      shellMocks.value.permissions = undefined;
      shellMocks.value.authorityFingerprint = "user-1|no-store";
      renderScreen(locale, false);
      expect(screen.getByText(title)).toBeVisible();
      expect(screen.getAllByText(description).length).toBeGreaterThan(0);
      expect(apiMocks.getProfitCenter).not.toHaveBeenCalled();
      expect(apiMocks.exportCostReport).not.toHaveBeenCalled();
    },
  );

  it("renders truthful loading, empty, and accessible invalid-range states", async () => {
    shellMocks.value.isLoading = true;
    const loading = renderScreen("en");
    expect(screen.getByRole("status", { name: "Loading repair margin" })).toBeVisible();
    loading.unmount();

    const empty = fixture();
    empty.trend = [];
    empty.orders = [];
    empty.breakdowns = { categories: [], suppliers: [] };
    shellMocks.value = shellValue();
    apiMocks.getProfitCenter.mockResolvedValue(empty);
    renderScreen("en");
    expect(
      await screen.findByText("No trend data is available for this date range."),
    ).toBeVisible();
    expect(screen.getByText("No repair orders are available for this date range.")).toBeVisible();
    expect(screen.getByText("No category data")).toBeVisible();
    expect(screen.getByText("No supplier-linked data")).toBeVisible();
    const readsBeforeInvalid = apiMocks.getProfitCenter.mock.calls.length;
    const [start, end] = screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.change(start, { target: { value: "2026-08-20" } });
    fireEvent.change(end, { target: { value: "2026-08-01" } });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The end date cannot be earlier than the start date.");
    expect(end).toHaveAttribute("aria-invalid", "true");
    expect(end).toHaveAttribute("aria-describedby", alert.id);
    expect(end).toHaveFocus();
    expect(screen.getByRole("button", { name: "Apply dates" })).toBeDisabled();
    expect(apiMocks.getProfitCenter).toHaveBeenCalledTimes(readsBeforeInvalid);
    expect(apiMocks.exportCostReport).not.toHaveBeenCalled();
  });

  it("fails closed for raw read errors and hides cached finance on authorization loss", async () => {
    apiMocks.getProfitCenter.mockRejectedValue(new Error("RAW_SQL_READ_SENTINEL"));
    const first = renderScreen("it-IT");
    expect(
      await screen.findByText("Impossibile caricare il margine riparazioni", undefined, {
        timeout: 4_000,
      }),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent("RAW_SQL_READ_SENTINEL");
    first.unmount();

    apiMocks.getProfitCenter.mockResolvedValue(fixture());
    renderScreen("en");
    expect(await screen.findByText("R-UNKNOWN")).toBeVisible();
    apiMocks.getProfitCenter.mockRejectedValue(
      new RepairDeskApiError("RAW_PROVIDER_AUTH_SENTINEL", 403, "RAW_CODE", { sql: "RAW_DETAILS" }),
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("Profit access has expired")).toBeVisible();
    expect(screen.queryByText("R-UNKNOWN")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /RAW_PROVIDER_AUTH_SENTINEL|RAW_CODE|RAW_DETAILS/,
    );
  });

  it.each([
    ["zh-CN", "导出成本 CSV"],
    ["it-IT", "Esporta costi CSV"],
    ["en", "Export costs CSV"],
  ] as const)("exports exact locale-free body and Blob bytes in %s", async (locale, buttonName) => {
    enableExport();
    const blob = new Blob(["order_no,cost\nR-DYNAMIC,12.34"], { type: "text/csv;charset=utf-8" });
    apiMocks.exportCostReport.mockResolvedValueOnce({ blob, fileName: "dynamic-finance.csv" });
    const { queryClient } = renderScreen(locale);
    const inputs = screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.change(inputs[0], { target: { value: "2026-03-01" } });
    fireEvent.change(inputs[1], { target: { value: "2026-03-30" } });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /应用日期|Applica date|Apply dates/ }));
    await waitFor(() => expect(apiMocks.getProfitCenter).toHaveBeenCalledTimes(2));
    expect(apiMocks.getProfitCenter.mock.calls[1][0]).toEqual({
      start_date: "2026-03-01",
      end_date: "2026-03-30",
    });
    apiMocks.exportCostReport.mockClear();
    await userEvent.setup().click(screen.getByRole("button", { name: buttonName }));
    await waitFor(() => expect(apiMocks.exportCostReport).toHaveBeenCalledTimes(1));
    expect(apiMocks.exportCostReport).toHaveBeenCalledWith({
      expected_store_id: "store-1",
      start_date: "2026-03-01",
      end_date: "2026-03-30",
    });
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(await blob.text()).toBe("order_no,cost\nR-DYNAMIC,12.34");
    expect(blob.type).toBe("text/csv;charset=utf-8");
    expect(downloads).toEqual([{ href: "blob:cost-export", fileName: "dynamic-finance.csv" }]);
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:cost-export"));
    expect(queryClient.getQueryData(storesKeys.context)).toBeDefined();
  });

  it.each([
    ["zh-CN", "导出成本 CSV", "生成成本导出失败，请稍后重试。"],
    [
      "it-IT",
      "Esporta costi CSV",
      "Impossibile generare l’esportazione dei costi. Riprova più tardi.",
    ],
    ["en", "Export costs CSV", "Could not generate the cost export. Try again later."],
  ] as const)(
    "contains raw structured export failures in %s",
    async (locale, buttonName, safeError) => {
      enableExport();
      apiMocks.exportCostReport.mockRejectedValue(
        new RepairDeskApiError("RAW_PROVIDER_EXPORT", 500, "RAW_DB_CODE", {
          sql: "RAW_SQL_DETAILS",
        }),
      );
      renderScreen(locale);
      await userEvent.setup().click(await screen.findByRole("button", { name: buttonName }));
      expect(await screen.findByText(safeError)).toBeVisible();
      expect(document.body.textContent).not.toMatch(
        /RAW_PROVIDER_EXPORT|RAW_DB_CODE|RAW_SQL_DETAILS/,
      );
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    },
  );

  it.each(["success", "failure"] as const)(
    "renders a stable %s export notice in the current locale without new I/O",
    async (kind) => {
      enableExport();
      history.replaceState(null, "", "/profit?source=finance-card");
      if (kind === "success") {
        apiMocks.exportCostReport.mockResolvedValueOnce({
          blob: new Blob(["stable"]),
          fileName: "动态-finance.csv",
        });
      } else {
        apiMocks.exportCostReport.mockRejectedValueOnce(new Error("RAW_NOTICE_SENTINEL"));
      }
      renderScreen("zh-CN");
      const exportButton = await screen.findByRole("button", { name: "导出成本 CSV" });
      await userEvent.setup().click(exportButton);
      if (kind === "success") {
        expect(await screen.findByText("动态-finance.csv 已生成并开始下载。")).toBeVisible();
      } else {
        expect(await screen.findByText("生成成本导出失败，请稍后重试。")).toBeVisible();
      }
      expect(exportButton).toHaveFocus();
      const reads = apiMocks.getProfitCenter.mock.calls.length;
      const writes = apiMocks.exportCostReport.mock.calls.length;
      fireEvent.click(screen.getByRole("button", { name: "switch-it" }));
      const expected =
        kind === "success"
          ? "动态-finance.csv è stato generato e il download è iniziato."
          : "Impossibile generare l’esportazione dei costi. Riprova più tardi.";
      expect(screen.getByText(expected)).toBeVisible();
      expect(screen.getByRole("button", { name: "Esporta costi CSV" })).toHaveFocus();
      expect(location.pathname + location.search).toBe("/profit?source=finance-card");
      expect(apiMocks.getProfitCenter).toHaveBeenCalledTimes(reads);
      expect(apiMocks.exportCostReport).toHaveBeenCalledTimes(writes);
      expect(document.body).not.toHaveTextContent("RAW_NOTICE_SENTINEL");
    },
  );

  it("blocks same-tick duplicate exports and retains the applied range for a safe retry", async () => {
    enableExport();
    const pending = deferred<{ blob: Blob; fileName: string }>();
    apiMocks.exportCostReport.mockReturnValueOnce(pending.promise);
    renderScreen("en");
    const button = await screen.findByRole("button", { name: "Export costs CSV" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(apiMocks.exportCostReport).toHaveBeenCalledTimes(1));
    await act(async () => pending.reject(new Error("RAW_EXPORT_SENTINEL")));
    expect(
      await screen.findByText("Could not generate the cost export. Try again later."),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent("RAW_EXPORT_SENTINEL");
    apiMocks.exportCostReport.mockResolvedValueOnce({
      blob: new Blob(["retry"]),
      fileName: "retry.csv",
    });
    await userEvent.setup().click(button);
    await waitFor(() => expect(apiMocks.exportCostReport).toHaveBeenCalledTimes(2));
    expect(apiMocks.exportCostReport.mock.calls[1][0]).toEqual(
      apiMocks.exportCostReport.mock.calls[0][0],
    );
  });

  it.each([
    ["downgrade", "resolve"],
    ["downgrade", "reject"],
    ["switch", "resolve"],
    ["switch", "reject"],
    ["identity", "resolve"],
    ["identity", "reject"],
  ] as const)(
    "drops late export side effects after a no-rerender %s on %s",
    async (change, outcome) => {
      enableExport();
      const pending = deferred<{ blob: Blob; fileName: string }>();
      apiMocks.exportCostReport.mockReturnValueOnce(pending.promise);
      const { queryClient } = renderScreen("en");
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      const button = await screen.findByRole("button", { name: "Export costs CSV" });
      fireEvent.click(button);
      await waitFor(() => expect(apiMocks.exportCostReport).toHaveBeenCalledTimes(1));
      setCachedAuthority(queryClient, change);
      await act(async () => {
        if (outcome === "resolve") {
          pending.resolve({ blob: new Blob(["STALE_BLOB"]), fileName: "STALE.csv" });
          await pending.promise;
        } else {
          pending.reject(new Error("RAW_LATE_EXPORT_SENTINEL"));
          await pending.promise.catch(() => undefined);
        }
      });
      expect(URL.createObjectURL).not.toHaveBeenCalled();
      expect(downloads).toHaveLength(0);
      expect(invalidate).not.toHaveBeenCalled();
      expect(document.body.textContent).not.toMatch(
        /STALE\.csv|STALE_BLOB|RAW_LATE_EXPORT_SENTINEL/,
      );
    },
  );

  it("preserves range, trend, focus, and URL across locale switch with zero domain I/O", async () => {
    viewportWidth = 768;
    history.replaceState(null, "", "/profit?source=dashboard");
    const { queryClient } = renderScreen("zh-CN");
    await screen.findByText("R-UNKNOWN");
    const [start, end] = screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.change(start, { target: { value: "2026-07-01" } });
    fireEvent.change(end, { target: { value: "2026-07-18" } });
    const apply = screen.getByRole("button", { name: "应用日期" });
    expect(apply).toBeEnabled();
    await userEvent.setup().click(apply);
    await waitFor(() =>
      expect(apiMocks.getProfitCenter).toHaveBeenCalledWith(
        { start_date: "2026-07-01", end_date: "2026-07-18" },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    await screen.findByText("2026-07-01 – 2026-07-18");
    await userEvent.setup().click(screen.getByRole("button", { name: "按月" }));
    fireEvent.change(start, { target: { value: "2026-07-02" } });
    end.focus();
    const reads = apiMocks.getProfitCenter.mock.calls.length;
    const writes = apiMocks.exportCostReport.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "switch-it" }));
    expect(screen.getByText("Tendenza mensile del margine")).toBeVisible();
    expect(screen.getByDisplayValue("2026-07-02")).toBeVisible();
    expect(screen.getByDisplayValue("2026-07-18")).toHaveFocus();
    expect(screen.getByText("2026-07-01 – 2026-07-18")).toBeVisible();
    expect(location.pathname + location.search).toBe("/profit?source=dashboard");
    expect(apiMocks.getProfitCenter).toHaveBeenCalledTimes(reads);
    expect(apiMocks.exportCostReport).toHaveBeenCalledTimes(writes);
    expect(queryClient.getQueryData(storesKeys.context)).toBeDefined();
  });

  it("does not show store A data while store B query is pending", async () => {
    const storeB = deferred<ProfitCenterResult>();
    apiMocks.getProfitCenter.mockResolvedValueOnce(fixture()).mockReturnValueOnce(storeB.promise);
    const view = renderScreen("en");
    expect(await screen.findByText("R-UNKNOWN")).toBeVisible();
    shellMocks.value = shellValue("store-2", "membership-2");
    view.queryClient.setQueryData(storesKeys.context, cachedContext("store-2", "membership-2"));
    view.rerender(ui("en", view.queryClient));
    expect(screen.queryByText("R-UNKNOWN")).not.toBeInTheDocument();
    await act(async () =>
      storeB.resolve({
        ...fixture(),
        orders: [{ ...fixture().orders[0], order_id: "order-b", public_no: "R-B" }],
      }),
    );
    expect(await screen.findByText("R-B")).toBeVisible();
  });

  it("drops a late profit GET result after a no-rerender read downgrade", async () => {
    const pending = deferred<ProfitCenterResult>();
    apiMocks.getProfitCenter.mockReturnValue(pending.promise);
    const { queryClient } = renderScreen("en");
    await waitFor(() => expect(apiMocks.getProfitCenter).toHaveBeenCalledTimes(1));
    const downgraded = cachedContext();
    if (downgraded.permissions) downgraded.permissions.canReadRepairProfitReports = false;
    queryClient.setQueryData(storesKeys.context, downgraded);
    await act(async () =>
      pending.resolve({
        ...fixture(),
        orders: [{ ...fixture().orders[0], order_id: "late-order", public_no: "STALE_FINANCE" }],
      }),
    );
    expect(
      await screen.findByText("This page is available only to authorized staff"),
    ).toBeVisible();
    expect(screen.queryByText("STALE_FINANCE")).not.toBeInTheDocument();
  });

  it("keeps last successful data with a localized safe refresh-failure state", async () => {
    renderScreen("en");
    expect(await screen.findByText("R-UNKNOWN")).toBeVisible();
    apiMocks.getProfitCenter.mockRejectedValue(new Error("RAW_REFRESH_SENTINEL"));
    await userEvent.setup().click(screen.getByRole("button", { name: "Refresh" }));
    expect(
      await screen.findByText(
        "Refresh failed. The last successfully loaded data remains visible.",
        undefined,
        { timeout: 4_000 },
      ),
    ).toBeVisible();
    expect(screen.getByText("R-UNKNOWN")).toBeVisible();
    expect(document.body).not.toHaveTextContent("RAW_REFRESH_SENTINEL");
  });

  it("computes Rome calendar defaults across UTC day and DST boundaries and is invalid-safe", () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "Pacific/Honolulu";
    expect(defaultRange(new Date("2026-03-29T22:30:00.000Z"))).toEqual({
      start_date: "2026-03-01",
      end_date: "2026-03-30",
    });
    expect(defaultRange(new Date("2026-10-25T23:30:00.000Z"))).toEqual({
      start_date: "2026-09-27",
      end_date: "2026-10-26",
    });
    expect(localDate(new Date("invalid"))).toBe("");
    process.env.TZ = originalTz;
  });
});

function LocaleSwitch() {
  const { setLocale } = useLocale();
  return <button onClick={() => setLocale("it-IT")}>switch-it</button>;
}

function ui(locale: AppLocale, queryClient: QueryClient) {
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider initialLocale={locale}>
        <SidebarProvider>
          <LocaleSwitch />
          <ProfitCenterScreen />
        </SidebarProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}

function renderScreen(locale: AppLocale = "zh-CN", seedContext = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (seedContext) queryClient.setQueryData(storesKeys.context, cachedContext());
  return { ...render(ui(locale, queryClient)), queryClient };
}

function shellValue(storeId = "store-1", membershipId = "membership-1") {
  return {
    isLoading: false,
    authorityFingerprint: `user-1|${storeId}|${membershipId}|owner|profit:1|export:0`,
    activeStore: {
      id: storeId,
      membershipId,
      name: "Dynamic 北店",
      slug: "dynamic-north",
      role: "owner" as const,
      status: "active" as const,
    },
    permissions: { canReadRepairProfitReports: true, canExportRepairCosts: false },
  };
}

function enableExport() {
  shellMocks.value.permissions!.canExportRepairCosts = true;
  shellMocks.value.authorityFingerprint = shellMocks.value.authorityFingerprint.replace(
    "export:0",
    "export:1",
  );
}

function cachedContext(storeId = "store-1", membershipId = "membership-1"): StoreContext {
  return {
    activeStore: {
      id: storeId,
      membershipId,
      name: "Dynamic 北店",
      slug: "dynamic-north",
      role: "owner",
      status: "active",
    },
    stores: [],
    permissions: {
      canReadSuppliers: false,
      canAssignSuppliers: false,
      canManageSuppliers: false,
      canReadRepairProfitReports: true,
      canExportRepairCosts: shellMocks.value.permissions?.canExportRepairCosts ?? false,
    },
  };
}

function setCachedAuthority(queryClient: QueryClient, change: "downgrade" | "switch" | "identity") {
  if (change === "switch") {
    queryClient.setQueryData(storesKeys.context, cachedContext("store-2", "membership-2"));
    return;
  }
  const context = cachedContext();
  if (change === "downgrade" && context.permissions) {
    context.permissions.canReadRepairProfitReports = false;
    context.permissions.canExportRepairCosts = false;
  }
  if (change === "identity" && context.activeStore) {
    context.activeStore.membershipId = "replacement-membership";
    context.activeStore.role = "viewer";
    context.activeStore.status = "inactive";
  }
  queryClient.setQueryData(storesKeys.context, context);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  void promise.catch(() => undefined);
  return { promise, resolve, reject };
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
        currency_costs: [
          {
            line_id: "line-usd",
            line_name: "屏幕",
            cost_amount_eur: 9,
            original_amount: 10,
            original_currency_code: "USD",
            fx_rate_to_eur: 0.9,
            fx_rate_at: "2026-07-18T10:00:00.000Z",
            fx_rate_source: "owner_manual",
            cost_source: "purchase_lot",
            evidence_status: "confirmed",
          },
        ],
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
