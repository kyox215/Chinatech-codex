import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderDataBatchHistory, OrderDataImportPreview } from "@/lib/repairdesk/types";

const mocks = vi.hoisted(() => ({
  previewOrderDataImport: vi.fn(),
  applyOrderDataImport: vi.fn(),
  downloadOrderDataTemplate: vi.fn(),
  exportCustomerStats: vi.fn(),
  exportOrderData: vi.fn(),
  listOrderDataBatchHistory: vi.fn(),
}));

vi.mock("@/features/settings/components/unsaved-settings-guard", () => ({
  UnsavedSettingsGuard: () => null,
}));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  previewOrderDataImport: mocks.previewOrderDataImport,
  applyOrderDataImport: mocks.applyOrderDataImport,
  downloadOrderDataTemplate: mocks.downloadOrderDataTemplate,
  exportCustomerStats: mocks.exportCustomerStats,
  exportOrderData: mocks.exportOrderData,
  listOrderDataBatchHistory: mocks.listOrderDataBatchHistory,
}));

import { OrderDataSection } from "./order-data-section";

describe("order data settings section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listOrderDataBatchHistory.mockResolvedValue(batchHistoryFixture());
  });

  it("shows store-bound preview context, explicit truncation, and a locked apply reason", async () => {
    const user = userEvent.setup();
    const preview = previewFixture({
      rows: Array.from({ length: 101 }, (_value, index) => ({
        rowNumber: index + 2,
        action: "update" as const,
        status: "ready" as const,
        publicNo: `R${String(index + 1).padStart(7, "0")}`,
        changedFields: ["故障描述"],
        warnings: [],
        errors: [],
      })),
      summary: { total: 101, ready: 101, create: 0, update: 101, invalid: 0, skipped: 0 },
    });
    mocks.previewOrderDataImport.mockResolvedValue(preview);
    const onDirtyChange = vi.fn();
    renderSection({ applyEnabled: false, onDirtyChange });

    await user.upload(
      screen.getByLabelText("XLSX 文件（最大 4 MB）"),
      new File(["xlsx"], "orders.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    await user.click(screen.getByRole("button", { name: "生成预览" }));

    expect(await screen.findByRole("region", { name: "导入预览" })).toBeVisible();
    expect(screen.getByText("ChinaTech Test")).toBeVisible();
    expect(screen.getByText("只更新已有工单", { selector: "dd" })).toBeVisible();
    expect(screen.getByText("预览明细：当前显示 10 / 101")).toBeVisible();
    expect(screen.getByText(/页面最多展开前 100 行/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "展开前 100 行" }));
    expect(screen.getByText("预览明细：当前显示 100 / 101")).toBeVisible();
    expect(screen.getByText(/最终应用当前保持关闭/)).toBeVisible();
    expect(screen.getByRole("button", { name: "检查并应用" })).toBeDisabled();
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
  });

  it("locks an expired preview and gives a persistent recovery message", async () => {
    const user = userEvent.setup();
    mocks.previewOrderDataImport.mockResolvedValue(
      previewFixture({ expiresAt: "2020-01-01T00:00:00.000Z" }),
    );
    renderSection({ applyEnabled: true });

    await user.upload(
      screen.getByLabelText("XLSX 文件（最大 4 MB）"),
      new File(["xlsx"], "old.xlsx"),
    );
    await user.click(screen.getByRole("button", { name: "生成预览" }));

    expect(await screen.findByRole("alert", { name: "" })).toHaveTextContent(/预览已过期/);
    expect(screen.getByText("预览已过期，请重新生成。")).toBeVisible();
    expect(screen.getByRole("button", { name: "检查并应用" })).toBeDisabled();
  });

  it("keeps preview failures visible instead of relying on a toast", async () => {
    const user = userEvent.setup();
    mocks.previewOrderDataImport.mockRejectedValue(new Error("文件字段不匹配"));
    renderSection({ applyEnabled: false });

    await user.upload(
      screen.getByLabelText("XLSX 文件（最大 4 MB）"),
      new File(["xlsx"], "bad.xlsx"),
    );
    await user.click(screen.getByRole("button", { name: "生成预览" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("文件字段不匹配");
    expect(screen.getByRole("button", { name: "生成预览" })).toBeEnabled();
  });

  it("loads only sanitized store-bound batch summaries after explicit consent", async () => {
    const user = userEvent.setup();
    renderSection({ applyEnabled: false });

    expect(mocks.listOrderDataBatchHistory).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "查看最近批次" }));

    expect(await screen.findByText("Primary Owner")).toBeVisible();
    expect(screen.getByText("总计 12 · 可应用 10 · 错误 2")).toBeVisible();
    expect(screen.getByText(/这里只显示最近 20 个批次/)).toBeVisible();
    expect(screen.queryByText("Mario Rossi")).not.toBeInTheDocument();
    expect(mocks.listOrderDataBatchHistory).toHaveBeenCalledTimes(1);
    expect(mocks.listOrderDataBatchHistory).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000001",
    );
  });
});

function renderSection({
  applyEnabled,
  onDirtyChange,
}: {
  applyEnabled: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <OrderDataSection
        storeId="00000000-0000-0000-0000-000000000001"
        storeName="ChinaTech Test"
        applyEnabled={applyEnabled}
        onDirtyChange={onDirtyChange}
      />
    </QueryClientProvider>,
  );
}

function previewFixture(overrides: Partial<OrderDataImportPreview> = {}): OrderDataImportPreview {
  return {
    batchId: "00000000-0000-0000-0000-000000000020",
    storeId: "00000000-0000-0000-0000-000000000001",
    templateVersion: "repairdesk-order-data-v1",
    mode: "update_only",
    expiresAt: "2099-07-14T12:00:00.000Z",
    summary: { total: 1, ready: 1, create: 0, update: 1, invalid: 0, skipped: 0 },
    rows: [
      {
        rowNumber: 2,
        action: "update",
        status: "ready",
        publicNo: "R0000001",
        changedFields: ["故障描述"],
        warnings: [],
        errors: [],
      },
    ],
    ...overrides,
  };
}

function batchHistoryFixture(): OrderDataBatchHistory {
  return {
    storeId: "00000000-0000-0000-0000-000000000001",
    hasMore: true,
    items: [
      {
        id: "batch-1",
        storeId: "00000000-0000-0000-0000-000000000001",
        kind: "import",
        mode: "update_only",
        status: "previewed",
        actorDisplayName: "Primary Owner",
        createdAt: "2026-07-13T08:00:00.000Z",
        previewedAt: "2026-07-13T08:01:00.000Z",
        expiresAt: "2026-07-14T08:00:00.000Z",
        summary: { total: 12, ready: 10, invalid: 2 },
      },
    ],
  };
}
