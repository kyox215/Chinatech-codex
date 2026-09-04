import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderDataBatchHistory, OrderDataImportPreview } from "@/lib/repairdesk/types";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

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
    mocks.downloadOrderDataTemplate.mockResolvedValue({
      blob: new Blob(["template-bytes"], { type: "application/vnd.test.template" }),
      fileName: "template.xlsx",
    });
    mocks.exportCustomerStats.mockResolvedValue({
      blob: new Blob(["customer-bytes"], { type: "application/vnd.test.customers" }),
      fileName: "customers.xlsx",
    });
    mocks.exportOrderData.mockResolvedValue({
      blob: new Blob(["order-bytes"], { type: "application/vnd.test.orders" }),
      fileName: "orders.xlsx",
    });
    mocks.applyOrderDataImport.mockResolvedValue({
      batchId: "00000000-0000-0000-0000-000000000020",
      status: "applied",
      applied: 1,
      conflicts: 0,
      failed: 0,
      skipped: 0,
      rows: [],
    });
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

    expect(await screen.findByRole("alert")).toHaveTextContent("预览失败");
    expect(screen.queryByText("文件字段不匹配")).not.toBeInTheDocument();
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

  it.each([
    [
      "zh-CN",
      [
        "创建：2026年3月29日 01:30",
        "到期：2026年3月29日 03:30",
        "创建：2026年3月29日 03:30",
        "到期：时间无效",
      ],
    ],
    [
      "it-IT",
      [
        "Creato: 29 mar 2026, 01:30",
        "Scade: 29 mar 2026, 03:30",
        "Creato: 29 mar 2026, 03:30",
        "Scade: Data non valida",
      ],
    ],
    [
      "en",
      [
        "Created: Mar 29, 2026, 1:30 AM",
        "Expires: Mar 29, 2026, 3:30 AM",
        "Created: Mar 29, 2026, 3:30 AM",
        "Expires: Invalid date",
      ],
    ],
  ] as const)(
    "formats batch history in Europe/Rome with an invalid-safe fallback in %s",
    async (locale, expected) => {
      const base = batchHistoryFixture().items[0]!;
      mocks.listOrderDataBatchHistory.mockResolvedValue({
        ...batchHistoryFixture(),
        hasMore: false,
        items: [
          {
            ...base,
            id: "batch-before-dst",
            createdAt: "2026-03-29T00:30:00.000Z",
            expiresAt: "2026-03-29T01:30:00.000Z",
          },
          {
            ...base,
            id: "batch-after-dst",
            createdAt: "2026-03-29T01:30:00.000Z",
            expiresAt: "RAW_INVALID_TIMESTAMP",
          },
        ],
      });
      const user = userEvent.setup();
      renderSection({ applyEnabled: false, locale });

      await user.click(
        screen.getByRole("button", {
          name: /(?:查看最近批次|Visualizza lotti recenti|View recent batches)/,
        }),
      );

      for (const text of expected) expect(await screen.findByText(text)).toBeVisible();
      expect(document.body).not.toHaveTextContent("RAW_INVALID_TIMESTAMP");
    },
  );

  it("drops a late old-store preview before cache, draft, notice, or focus side effects", async () => {
    const pending = deferred<OrderDataImportPreview>();
    mocks.previewOrderDataImport.mockReturnValueOnce(pending.promise);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();
    const view = render(sectionTree({ applyEnabled: true, queryClient }));
    await user.upload(
      await screen.findByLabelText("XLSX 文件（最大 4 MB）"),
      new File(["OLD_STORE_PII"], "old-preview.xlsx"),
    );
    fireEvent.click(screen.getByRole("button", { name: "生成预览" }));
    await waitFor(() => expect(mocks.previewOrderDataImport).toHaveBeenCalledTimes(1));

    view.rerender(
      sectionTree({
        storeId: "00000000-0000-0000-0000-000000000002",
        applyEnabled: true,
        queryClient,
      }),
    );
    invalidate.mockClear();
    await act(async () => {
      pending.resolve(previewFixture());
      await pending.promise;
    });

    expect(invalidate).not.toHaveBeenCalled();
    expect(screen.queryByText("R0000001")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("old-preview.xlsx");
    expect(document.body).not.toHaveTextContent("预览完成");
  });

  it.each([
    ["zh-CN", ["空白模板", "导出工单", "客户统计"]],
    ["it-IT", ["Modello vuoto", "Esporta ordini", "Statistiche clienti"]],
    ["en", ["Blank template", "Export orders", "Customer statistics"]],
  ] as const)("keeps all three export consumers byte-bound in %s", async (locale, labels) => {
    const user = userEvent.setup();
    const downloads: string[] = [];
    const blobs: Blob[] = [];
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return `blob:test-${blobs.length}`;
    });
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function clickDownload(this: HTMLAnchorElement) {
        downloads.push(this.download);
      });
    renderSection({ applyEnabled: false, locale });

    for (const [index, label] of labels.entries()) {
      const button = await screen.findByRole("button", { name: label });
      fireEvent.click(button);
      fireEvent.click(button);
      await waitFor(() => expect(downloads).toHaveLength(index + 1));
    }

    await waitFor(() => {
      expect(mocks.downloadOrderDataTemplate).toHaveBeenCalledTimes(1);
      expect(mocks.exportOrderData).toHaveBeenCalledTimes(1);
      expect(mocks.exportCustomerStats).toHaveBeenCalledTimes(1);
    });
    for (const call of [
      mocks.downloadOrderDataTemplate,
      mocks.exportOrderData,
      mocks.exportCustomerStats,
    ]) {
      expect(call).toHaveBeenCalledWith("00000000-0000-0000-0000-000000000001");
    }
    expect(downloads).toEqual(["template.xlsx", "orders.xlsx", "customers.xlsx"]);
    expect(blobs.map((blob) => blob.type)).toEqual([
      "application/vnd.test.template",
      "application/vnd.test.orders",
      "application/vnd.test.customers",
    ]);
    expect(await Promise.all(blobs.map(readBlobText))).toEqual([
      "template-bytes",
      "order-bytes",
      "customer-bytes",
    ]);
    await waitFor(() => expect(revokeObjectUrl).toHaveBeenCalledTimes(3));
    expect(revokeObjectUrl.mock.calls.map(([url]) => url)).toEqual([
      "blob:test-1",
      "blob:test-2",
      "blob:test-3",
    ]);
    createObjectUrl.mockRestore();
    revokeObjectUrl.mockRestore();
    click.mockRestore();
  });

  it.each([
    ["zh-CN", ["空白模板", "导出工单", "客户统计"], "生成文件失败"],
    [
      "it-IT",
      ["Modello vuoto", "Esporta ordini", "Statistiche clienti"],
      "Generazione file non riuscita",
    ],
    ["en", ["Blank template", "Export orders", "Customer statistics"], "Could not generate file"],
  ] as const)(
    "contains Error and API diagnostics for every rejected export in %s",
    async (locale, labels, failure) => {
      mocks.downloadOrderDataTemplate.mockRejectedValueOnce(new Error("RAW_TEMPLATE_SENTINEL"));
      mocks.exportOrderData.mockRejectedValueOnce(
        new RepairDeskApiError("RAW_EXPORT_MESSAGE_SENTINEL", 500, "RAW_EXPORT_CODE_SENTINEL", {
          diagnostic: "RAW_EXPORT_DETAILS_SENTINEL",
        }),
      );
      mocks.exportCustomerStats.mockRejectedValueOnce(new Error("RAW_CUSTOMER_SENTINEL"));
      const createObjectUrl = vi.spyOn(URL, "createObjectURL");
      renderSection({ applyEnabled: false, locale });

      for (const label of labels) {
        fireEvent.click(await screen.findByRole("button", { name: label }));
        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(failure));
      }

      expect(mocks.downloadOrderDataTemplate).toHaveBeenCalledTimes(1);
      expect(mocks.exportOrderData).toHaveBeenCalledTimes(1);
      expect(mocks.exportCustomerStats).toHaveBeenCalledTimes(1);
      expect(createObjectUrl).not.toHaveBeenCalled();
      expect(document.body.textContent).not.toMatch(/RAW_|diagnostic|SENTINEL/);
      createObjectUrl.mockRestore();
    },
  );

  it.each([
    ["zh-CN", "生成预览", "检查并应用", "确认并应用"],
    ["it-IT", "Genera anteprima", "Verifica e applica", "Conferma e applica"],
    ["en", "Generate preview", "Review and apply", "Confirm and apply"],
  ] as const)(
    "sends exact preview/apply inputs once and hides raw issue text in %s",
    async (locale, previewLabel, reviewLabel, applyLabel) => {
      const pendingApply = deferred<Awaited<ReturnType<typeof mocks.applyOrderDataImport>>>();
      const preview = previewFixture({
        rows: [
          {
            rowNumber: 2,
            action: "update",
            status: "ready",
            publicNo: "R-DYNAMIC-001",
            changedFields: ["device_model", "unknown_RAW_FIELD"],
            warnings: [{ code: "unknown_issue_code", message: "RAW_SQL_ISSUE_SENTINEL" }],
            errors: [],
          },
        ],
      });
      mocks.previewOrderDataImport.mockResolvedValue(preview);
      mocks.applyOrderDataImport.mockReturnValueOnce(pendingApply.promise);
      const user = userEvent.setup();
      renderSection({ applyEnabled: true, locale });
      const file = new File(["PII_BATCH_BYTES"], "orders.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      await user.upload(screen.getByLabelText(/XLSX|File XLSX/), file);
      const previewButton = screen.getByRole("button", { name: previewLabel });
      fireEvent.click(previewButton);
      fireEvent.click(previewButton);
      await waitFor(() => expect(mocks.previewOrderDataImport).toHaveBeenCalledTimes(1));
      expect(mocks.previewOrderDataImport).toHaveBeenCalledWith({
        file,
        expectedStoreId: "00000000-0000-0000-0000-000000000001",
        mode: "update_only",
      });
      expect(document.body).not.toHaveTextContent("RAW_SQL_ISSUE_SENTINEL");
      expect(document.body).not.toHaveTextContent("unknown_RAW_FIELD");
      expect(await screen.findByText(/R-DYNAMIC-001/)).toBeVisible();

      await user.click(screen.getByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: reviewLabel }));
      const confirm = screen.getByRole("button", { name: applyLabel });
      fireEvent.click(confirm);
      fireEvent.click(confirm);
      await waitFor(() => expect(mocks.applyOrderDataImport).toHaveBeenCalledTimes(1));
      expect(mocks.applyOrderDataImport).toHaveBeenCalledWith({
        batchId: "00000000-0000-0000-0000-000000000020",
        expectedStoreId: "00000000-0000-0000-0000-000000000001",
      });
      pendingApply.resolve({
        batchId: "00000000-0000-0000-0000-000000000020",
        status: "applied",
        applied: 1,
        conflicts: 0,
        failed: 0,
        skipped: 0,
        rows: [],
      });
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    },
  );

  it.each([
    [
      "zh-CN",
      "生成预览",
      "完整预览报告",
      "检查并应用",
      "确认并应用",
      "下载完整错误报告",
      "导入行存在冲突，请修正后重新生成预览。",
      "导入行需要检查。",
      "该行未能应用，请重新生成预览。",
    ],
    [
      "it-IT",
      "Genera anteprima",
      "Report anteprima completo",
      "Verifica e applica",
      "Conferma e applica",
      "Scarica report errori completo",
      "La riga di importazione contiene un conflitto. Correggila e genera una nuova anteprima.",
      "La riga di importazione richiede verifica.",
      "La riga non è stata applicata. Genera una nuova anteprima.",
    ],
    [
      "en",
      "Generate preview",
      "Full preview report",
      "Review and apply",
      "Confirm and apply",
      "Download full error report",
      "The import row has a conflict. Fix it and generate a new preview.",
      "The import row needs review.",
      "The row could not be applied. Generate a new preview.",
    ],
  ] as const)(
    "sanitizes both downloaded reports without mutating canonical rows in %s",
    async (
      locale,
      previewLabel,
      previewReportLabel,
      reviewLabel,
      applyLabel,
      applyReportLabel,
      conflictLabel,
      genericLabel,
      applyFailureLabel,
    ) => {
      const preview = previewFixture({
        rows: [
          {
            rowNumber: 7,
            action: "update",
            status: "ready",
            orderId: "ORDER-DYNAMIC-ID",
            publicNo: "R-DYNAMIC-REPORT",
            changedFields: ["device_model", "RAW_CHANGED_FIELD_SENTINEL"],
            warnings: [
              {
                code: "version_conflict",
                field: "版本时间",
                message: "RAW_PROVIDER_PREVIEW_SENTINEL",
              },
              {
                code: "RAW_SQL_CODE_SENTINEL",
                field: "RAW_SQL_FIELD_SENTINEL",
                message: "RAW_SQL_MESSAGE_SENTINEL",
              },
            ],
            errors: [],
          },
        ],
      });
      const applyResult = {
        batchId: preview.batchId,
        status: "partial" as const,
        applied: 0,
        conflicts: 1,
        failed: 1,
        skipped: 0,
        rows: [
          {
            rowNumber: 7,
            status: "failed" as const,
            errors: [
              { code: "apply_failed", message: "RAW_APPLY_PROVIDER_SENTINEL" },
              {
                code: "RAW_APPLY_CODE_SENTINEL",
                field: "RAW_APPLY_FIELD_SENTINEL",
                message: "RAW_APPLY_SQL_SENTINEL",
              },
            ],
          },
        ],
      };
      mocks.previewOrderDataImport.mockResolvedValue(preview);
      mocks.applyOrderDataImport.mockResolvedValue(applyResult);
      const blobs: Blob[] = [];
      const downloads: string[] = [];
      const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
        blobs.push(blob as Blob);
        return `blob:report-${blobs.length}`;
      });
      const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(function clickReport(this: HTMLAnchorElement) {
          downloads.push(this.download);
        });
      const user = userEvent.setup();
      renderSection({ applyEnabled: true, locale });
      await user.upload(screen.getByLabelText(/XLSX|File XLSX/), new File(["PII"], "rows.xlsx"));
      await user.click(screen.getByRole("button", { name: previewLabel }));
      await user.click(await screen.findByRole("button", { name: previewReportLabel }));
      await user.click(screen.getByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: reviewLabel }));
      await user.click(screen.getByRole("button", { name: applyLabel }));
      await user.click(await screen.findByRole("button", { name: applyReportLabel }));

      expect(blobs).toHaveLength(2);
      expect(blobs.map((blob) => blob.type)).toEqual([
        "text/csv;charset=utf-8",
        "text/csv;charset=utf-8",
      ]);
      const [previewCsv, applyCsv] = await Promise.all(blobs.map(readBlobText));
      expect(previewCsv).toContain("ORDER-DYNAMIC-ID");
      expect(previewCsv).toContain("R-DYNAMIC-REPORT");
      expect(previewCsv).toContain("device_model");
      expect(previewCsv).toContain(`version_conflict:版本时间:${conflictLabel}`);
      expect(previewCsv).toContain(`unknown_issue:${genericLabel}`);
      expect(applyCsv).toContain(`apply_failed:${applyFailureLabel}`);
      expect(applyCsv).toContain(`unknown_issue:${genericLabel}`);
      expect(`${previewCsv}${applyCsv}`).not.toMatch(/RAW_|SENTINEL|provider|SQL/i);
      expect(preview).toEqual(
        expect.objectContaining({
          rows: [
            expect.objectContaining({
              changedFields: ["device_model", "RAW_CHANGED_FIELD_SENTINEL"],
              warnings: expect.arrayContaining([
                expect.objectContaining({ message: "RAW_PROVIDER_PREVIEW_SENTINEL" }),
              ]),
            }),
          ],
        }),
      );
      expect(downloads[0]).toMatch(/^repairdesk-order-preview-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(downloads[1]).toMatch(/^repairdesk-order-apply-errors-\d{4}-\d{2}-\d{2}\.csv$/);
      await waitFor(() => expect(revokeObjectUrl).toHaveBeenCalledTimes(2));
      expect(revokeObjectUrl).toHaveBeenNthCalledWith(1, "blob:report-1");
      expect(revokeObjectUrl).toHaveBeenNthCalledWith(2, "blob:report-2");
      createObjectUrl.mockRestore();
      revokeObjectUrl.mockRestore();
      click.mockRestore();
    },
  );

  it.each([
    ["空白模板", "template"],
    ["导出工单", "orders"],
    ["客户统计", "customers"],
  ] as const)(
    "invalidates an old-store %s response before Blob, cache, or DOM side effects",
    async (label, kind) => {
      const pending = deferred<{ blob: Blob; fileName: string }>();
      const exportMock =
        kind === "template"
          ? mocks.downloadOrderDataTemplate
          : kind === "customers"
            ? mocks.exportCustomerStats
            : mocks.exportOrderData;
      exportMock.mockReturnValueOnce(pending.promise);
      const createObjectUrl = vi.spyOn(URL, "createObjectURL");
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      const view = render(sectionTree({ applyEnabled: true, queryClient }));

      fireEvent.click(await screen.findByRole("button", { name: label }));
      await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1));
      view.rerender(
        sectionTree({
          storeId: "00000000-0000-0000-0000-000000000002",
          applyEnabled: true,
          queryClient,
        }),
      );
      invalidate.mockClear();
      await act(async () => {
        pending.resolve({ blob: new Blob(["OLD_STORE_PII"]), fileName: "old-store.xlsx" });
        await pending.promise;
      });

      expect(createObjectUrl).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
      expect(document.body).not.toHaveTextContent("old-store.xlsx");
      createObjectUrl.mockRestore();
    },
  );

  it.each([
    ["zh-CN", "生成预览", "检查并应用", "确认并应用", "应用导入失败"],
    [
      "it-IT",
      "Genera anteprima",
      "Verifica e applica",
      "Conferma e applica",
      "Applicazione importazione non riuscita",
    ],
    ["en", "Generate preview", "Review and apply", "Confirm and apply", "Could not apply import"],
  ] as const)(
    "contains rejected apply diagnostics and retains the preview draft in %s",
    async (locale, previewLabel, reviewLabel, applyLabel, failure) => {
      mocks.previewOrderDataImport.mockResolvedValue(previewFixture());
      mocks.applyOrderDataImport.mockRejectedValueOnce(
        new RepairDeskApiError("RAW_APPLY_MESSAGE_SENTINEL", 409, "RAW_APPLY_CODE_SENTINEL", {
          rows: ["RAW_APPLY_DETAILS_SENTINEL"],
        }),
      );
      const user = userEvent.setup();
      renderSection({ applyEnabled: true, locale });
      const file = new File(["PII_BATCH_BYTES"], "retain.xlsx");
      await user.upload(screen.getByLabelText(/XLSX|File XLSX/), file);
      await user.click(screen.getByRole("button", { name: previewLabel }));
      await screen.findByRole("region");
      await user.click(screen.getByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: reviewLabel }));
      const apply = screen.getByRole("button", { name: applyLabel });
      fireEvent.click(apply);
      fireEvent.click(apply);

      await waitFor(() => expect(mocks.applyOrderDataImport).toHaveBeenCalledTimes(1));
      expect(await screen.findByRole("alert")).toHaveTextContent(failure);
      expect(screen.getAllByText("retain.xlsx").length).toBeGreaterThan(0);
      expect(document.body.textContent).not.toMatch(/RAW_|SENTINEL/);
    },
  );

  it("drops a late old-store apply result before cache, DOM, or focus side effects", async () => {
    mocks.previewOrderDataImport.mockResolvedValue(previewFixture());
    const pending = deferred<Awaited<ReturnType<typeof mocks.applyOrderDataImport>>>();
    mocks.applyOrderDataImport.mockReturnValueOnce(pending.promise);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();
    const view = render(sectionTree({ applyEnabled: true, queryClient }));
    await user.upload(
      await screen.findByLabelText("XLSX 文件（最大 4 MB）"),
      new File(["OLD_STORE_PII"], "old-store.xlsx"),
    );
    await user.click(screen.getByRole("button", { name: "生成预览" }));
    await screen.findByRole("region");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "检查并应用" }));
    await user.click(screen.getByRole("button", { name: "确认并应用" }));
    await waitFor(() => expect(mocks.applyOrderDataImport).toHaveBeenCalledTimes(1));

    view.rerender(
      sectionTree({
        storeId: "00000000-0000-0000-0000-000000000002",
        applyEnabled: true,
        queryClient,
      }),
    );
    invalidate.mockClear();
    pending.resolve({
      batchId: "00000000-0000-0000-0000-000000000020",
      status: "applied",
      applied: 1,
      conflicts: 0,
      failed: 0,
      skipped: 0,
      rows: [],
    });
    await pending.promise;
    await Promise.resolve();

    expect(invalidate).not.toHaveBeenCalled();
    expect(document.body).not.toHaveTextContent("导入完成");
    expect(document.body).not.toHaveTextContent("old-store.xlsx");
  });

  it("preserves a focused file draft across locale switch with zero domain IO", async () => {
    const user = userEvent.setup();
    renderSection({ applyEnabled: true, withLocaleSwitch: true });
    const input = await screen.findByLabelText("XLSX 文件（最大 4 MB）");
    const file = new File(["draft"], "locale-draft.xlsx");
    await user.upload(input, file);
    input.focus();
    const baseline = domainCallCount();

    await user.click(screen.getByRole("button", { name: "switch-it" }));

    expect(screen.getByText("locale-draft.xlsx")).toBeVisible();
    expect(screen.getByLabelText("File XLSX (massimo 4 MB)")).toHaveFocus();
    expect(domainCallCount()).toBe(baseline);
  });
});

function renderSection({
  applyEnabled,
  onDirtyChange,
  storeId = "00000000-0000-0000-0000-000000000001",
  locale = "zh-CN",
  withLocaleSwitch = false,
}: {
  applyEnabled: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  storeId?: string;
  locale?: AppLocale;
  withLocaleSwitch?: boolean;
}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    sectionTree({ applyEnabled, onDirtyChange, storeId, locale, withLocaleSwitch, queryClient }),
  );
}

function sectionTree({
  applyEnabled,
  onDirtyChange,
  storeId = "00000000-0000-0000-0000-000000000001",
  locale = "zh-CN",
  withLocaleSwitch = false,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
}: {
  applyEnabled: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  storeId?: string;
  locale?: AppLocale;
  withLocaleSwitch?: boolean;
  queryClient?: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider initialLocale={locale}>
        {withLocaleSwitch ? <LocaleSwitchHarness /> : null}
        <OrderDataSection
          storeId={storeId}
          storeName="ChinaTech Test"
          applyEnabled={applyEnabled}
          onDirtyChange={onDirtyChange}
        />
      </LocaleProvider>
    </QueryClientProvider>
  );
}

function LocaleSwitchHarness() {
  const { setLocale } = useLocale();
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => setLocale("it-IT")}
    >
      switch-it
    </button>
  );
}

function domainCallCount() {
  return [
    mocks.previewOrderDataImport,
    mocks.applyOrderDataImport,
    mocks.downloadOrderDataTemplate,
    mocks.exportCustomerStats,
    mocks.exportOrderData,
    mocks.listOrderDataBatchHistory,
  ].reduce((total, mock) => total + mock.mock.calls.length, 0);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function readBlobText(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
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
