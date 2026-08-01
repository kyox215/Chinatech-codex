"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  History,
  LoaderCircle,
  Trash2,
  Upload,
  Users,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { customersKeys } from "@/features/customers/api/query-keys";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { ORDER_DATA_MAX_FILE_BYTES } from "@/features/orders/model/order-data-contract";
import {
  buildOrderDataApplyReport,
  buildOrderDataPreviewReport,
  type OrderDataTextReport,
} from "@/features/orders/model/order-data-report";
import {
  OrderDataAction,
  OrderDataSummaryValue,
} from "@/features/settings/components/order-data-controls";
import { UnsavedSettingsGuard } from "@/features/settings/components/unsaved-settings-guard";
import {
  applyOrderDataImport,
  downloadOrderDataTemplate,
  exportCustomerStats,
  exportOrderData,
  listOrderDataBatchHistory,
  previewOrderDataImport,
  type OrderDataImportApplyResult,
  type OrderDataImportMode,
  type OrderDataImportPreview,
} from "@/lib/repairdesk/api";
import { brandGradientStyle, repairOs } from "@/lib/ui-patterns";
import { RepairOsSectionHeader } from "@/shared/ui";

type DownloadKind = "template" | "orders" | "customers";
type FlowNotice = { kind: "info" | "success" | "error"; message: string };
const PREVIEW_INITIAL_ROWS = 10;
const PREVIEW_RENDER_LIMIT = 100;

export function OrderDataSection({
  storeId,
  storeName,
  applyEnabled,
  onDirtyChange,
}: {
  storeId: string;
  storeName: string;
  applyEnabled: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flowFocusRef = useRef<HTMLDivElement>(null);
  const previewFocusRef = useRef<HTMLElement>(null);
  const resultFocusRef = useRef<HTMLDivElement>(null);
  const storeIdRef = useRef(storeId);
  const [file, setFile] = useState<File>();
  const [mode, setMode] = useState<OrderDataImportMode>("update_only");
  const [preview, setPreview] = useState<OrderDataImportPreview>();
  const [applyResult, setApplyResult] = useState<OrderDataImportApplyResult>();
  const [confirmed, setConfirmed] = useState(false);
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<FlowNotice>();
  const [now, setNow] = useState(() => Date.now());
  const [showExpandedPreview, setShowExpandedPreview] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const clearFileInput = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const resetFlow = useCallback(() => {
    setFile(undefined);
    setMode("update_only");
    setPreview(undefined);
    setApplyResult(undefined);
    setConfirmed(false);
    setApplyConfirmOpen(false);
    setNotice(undefined);
    setShowExpandedPreview(false);
    setHistoryOpen(false);
    clearFileInput();
  }, [clearFileInput]);

  useEffect(() => {
    storeIdRef.current = storeId;
    resetFlow();
  }, [resetFlow, storeId]);

  useEffect(() => {
    if (!preview) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [preview]);

  const batchHistoryQuery = useQuery({
    queryKey: ordersKeys.dataBatches(storeId),
    queryFn: async () => {
      const result = await listOrderDataBatchHistory(storeId);
      if (result.storeId !== storeIdRef.current) {
        throw new Error("店铺上下文已经变化，请重新读取批次历史");
      }
      return result;
    },
    enabled: historyOpen,
    staleTime: 30_000,
  });

  const downloadMutation = useMutation({
    mutationFn: async ({
      kind,
      expectedStoreId,
    }: {
      kind: DownloadKind;
      expectedStoreId: string;
    }) => {
      if (kind === "template") return downloadOrderDataTemplate(expectedStoreId);
      if (kind === "customers") return exportCustomerStats(expectedStoreId);
      return exportOrderData(expectedStoreId);
    },
    onMutate: ({ kind }) => {
      setNotice({ kind: "info", message: downloadPendingLabel(kind) });
    },
    onSuccess: ({ blob, fileName }, variables) => {
      if (variables.expectedStoreId !== storeIdRef.current) return;
      downloadBlob(blob, fileName);
      setNotice({ kind: "success", message: `${fileName} 已生成并开始下载。` });
      void queryClient.invalidateQueries({
        queryKey: ordersKeys.dataBatches(variables.expectedStoreId),
      });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: errorMessage(error, "生成文件失败") });
      focusSoon(flowFocusRef);
    },
  });

  const previewMutation = useMutation({
    mutationFn: async (variables: {
      file: File;
      expectedStoreId: string;
      mode: OrderDataImportMode;
    }) => previewOrderDataImport(variables),
    onMutate: () => {
      setNotice({ kind: "info", message: "正在安全解析文件并生成预览…" });
    },
    onSuccess: (result, variables) => {
      if (
        variables.expectedStoreId !== storeIdRef.current ||
        result.storeId !== variables.expectedStoreId
      ) {
        return;
      }
      setNow(Date.now());
      setPreview(result);
      setApplyResult(undefined);
      setConfirmed(false);
      setShowExpandedPreview(false);
      setNotice({
        kind: result.summary.invalid > 0 ? "error" : "success",
        message:
          result.summary.invalid > 0
            ? `预览完成：发现 ${result.summary.invalid} 行错误，应用已锁定。`
            : `预览完成：${result.summary.ready} 行可应用。`,
      });
      void queryClient.invalidateQueries({
        queryKey: ordersKeys.dataBatches(variables.expectedStoreId),
      });
      focusSoon(previewFocusRef);
    },
    onError: (error) => {
      setNotice({ kind: "error", message: errorMessage(error, "预览失败") });
      focusSoon(flowFocusRef);
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (variables: {
      batchId: string;
      expectedStoreId: string;
      expiresAt: string;
    }) => {
      if (new Date(variables.expiresAt).getTime() <= Date.now()) {
        throw new Error("导入预览已过期，请重新选择文件并生成预览");
      }
      const result = await applyOrderDataImport({
        batchId: variables.batchId,
        expectedStoreId: variables.expectedStoreId,
      });
      return { result, expectedStoreId: variables.expectedStoreId };
    },
    onMutate: () => {
      setApplyConfirmOpen(false);
      setNotice({ kind: "info", message: "正在锁定批次并应用工单数据，请勿关闭页面…" });
    },
    onSuccess: async ({ result, expectedStoreId }) => {
      if (expectedStoreId !== storeIdRef.current) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ordersKeys.all }),
        queryClient.invalidateQueries({ queryKey: customersKeys.all }),
        queryClient.invalidateQueries({ queryKey: ordersKeys.dataBatches(expectedStoreId) }),
      ]);
      setApplyResult(result);
      setConfirmed(false);
      if (result.status === "partial") {
        setNotice({
          kind: "error",
          message: `部分完成：成功 ${result.applied}，冲突 ${result.conflicts}，失败 ${result.failed}，跳过 ${result.skipped}。同一批次已锁定。`,
        });
        focusSoon(resultFocusRef);
        return;
      }
      setNotice({ kind: "success", message: `导入完成：已应用 ${result.applied} 行。` });
      setPreview(undefined);
      setFile(undefined);
      clearFileInput();
      focusSoon(resultFocusRef);
    },
    onError: (error) => {
      setConfirmed(false);
      setNotice({ kind: "error", message: errorMessage(error, "应用导入失败") });
      focusSoon(flowFocusRef);
    },
  });

  const busy = downloadMutation.isPending || previewMutation.isPending || applyMutation.isPending;
  const dirty = Boolean(file || preview);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const previewExpired = Boolean(preview && new Date(preview.expiresAt).getTime() <= now);
  const currentBatchLocked = Boolean(preview && applyResult?.batchId === preview.batchId);
  const canApply = Boolean(
    preview &&
    preview.summary.ready > 0 &&
    preview.summary.invalid === 0 &&
    applyEnabled &&
    !previewExpired &&
    !currentBatchLocked &&
    confirmed &&
    !busy,
  );
  const disabledReason = preview
    ? applyDisabledReason({
        preview,
        applyEnabled,
        previewExpired,
        currentBatchLocked,
        confirmed,
      })
    : "";
  const previewDisplayLimit = showExpandedPreview ? PREVIEW_RENDER_LIMIT : PREVIEW_INITIAL_ROWS;
  const visiblePreviewRows = preview?.rows.slice(0, previewDisplayLimit) ?? [];
  const visibleApplyRows = applyResult?.rows?.slice(0, 50) ?? [];
  const batchHistory = batchHistoryQuery.data;

  const discardFlow = useCallback(() => {
    dirtyRef.current = false;
    resetFlow();
    onDirtyChange?.(false);
    return { status: "resolved" as const };
  }, [onDirtyChange, resetFlow]);

  const handleFileChange = (nextFile: File | undefined) => {
    setPreview(undefined);
    setApplyResult(undefined);
    setConfirmed(false);
    setShowExpandedPreview(false);
    if (!nextFile) {
      setFile(undefined);
      setNotice(undefined);
      return;
    }
    if (!nextFile.name.toLowerCase().endsWith(".xlsx")) {
      setFile(undefined);
      clearFileInput();
      setNotice({ kind: "error", message: "只支持 .xlsx 文件，不支持 .xls 或含宏工作簿。" });
      focusSoon(flowFocusRef);
      return;
    }
    if (nextFile.size === 0 || nextFile.size > ORDER_DATA_MAX_FILE_BYTES) {
      setFile(undefined);
      clearFileInput();
      setNotice({ kind: "error", message: "文件为空或超过 4 MB 限制。" });
      focusSoon(flowFocusRef);
      return;
    }
    setFile(nextFile);
    setNotice({
      kind: "info",
      message: `已选择 ${nextFile.name}（${formatBytes(nextFile.size)}），尚未上传。`,
    });
  };

  const clearSelectedFile = () => {
    setFile(undefined);
    setPreview(undefined);
    setApplyResult(undefined);
    setConfirmed(false);
    setNotice({ kind: "info", message: "已清除本地文件和预览。" });
    clearFileInput();
    fileInputRef.current?.focus();
  };

  return (
    <div
      data-settings-order-data-section
      className="min-w-0 space-y-3"
      aria-busy={busy || undefined}
    >
      <UnsavedSettingsGuard
        id={`settings-order-data-flow:${storeId}`}
        dirty={dirty}
        isDirty={() => dirtyRef.current}
        busy={previewMutation.isPending || applyMutation.isPending}
        canSave={false}
        saveUnavailableReason="所选文件和导入预览不能跨页面保存；可舍弃后离开。"
        label="工单数据文件或导入预览"
        onSave={async () => ({ status: "blocked", focus: () => flowFocusRef.current?.focus() })}
        onDiscard={discardFlow}
        onFocusFallback={() => flowFocusRef.current?.focus()}
      />

      <section className={repairOs.adminSection}>
        <RepairOsSectionHeader
          icon={FileSpreadsheet}
          iconFrame={false}
          title="工单数据文件"
          description="下载只包含当前店铺的安全字段；文件可能含客户资料。"
        />
        <div className="grid gap-2 sm:grid-cols-3">
          {(["template", "orders", "customers"] as const).map((kind) => (
            <OrderDataAction
              key={kind}
              icon={kind === "customers" ? Users : kind === "orders" ? FileSpreadsheet : Download}
              title={
                downloadMutation.isPending && downloadMutation.variables?.kind === kind
                  ? downloadPendingLabel(kind)
                  : downloadLabel(kind)
              }
              disabled={busy}
              onClick={() => downloadMutation.mutate({ kind, expectedStoreId: storeId })}
            />
          ))}
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-md border border-status-warn-foreground/25 bg-status-warn px-3 py-2 text-xs leading-5 text-status-warn-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>导出文件包含客户资料，只保存在受控设备中；不通过个人聊天工具转发。</span>
        </div>
      </section>

      <section className={repairOs.adminSection}>
        <RepairOsSectionHeader
          icon={Upload}
          iconFrame={false}
          title="导入工单"
          description="选择文件 → 选择模式 → 服务端预览。预览本身不会修改工单。"
        />
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(180px,220px)_auto] lg:items-end">
          <div className="min-w-0 space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="order-data-file" className="text-xs">
              XLSX 文件（最大 4 MB）
            </Label>
            <Input
              ref={fileInputRef}
              id="order-data-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="h-[38px] min-w-0 text-xs file:mr-2 file:border-0 file:bg-transparent file:text-xs file:font-medium"
              disabled={busy}
              onChange={(event) => handleFileChange(event.target.files?.[0])}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="order-data-mode" className="text-xs">
              导入模式
            </Label>
            <Select
              value={mode}
              disabled={busy}
              onValueChange={(value: OrderDataImportMode) => {
                setMode(value);
                setPreview(undefined);
                setApplyResult(undefined);
                setConfirmed(false);
                setShowExpandedPreview(false);
                setNotice(
                  file ? { kind: "info", message: "导入模式已变化，请重新生成预览。" } : undefined,
                );
              }}
            >
              <SelectTrigger id="order-data-mode" className="h-[38px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="update_only" className="min-h-8">
                  只更新已有工单
                </SelectItem>
                <SelectItem value="create_and_update" className="min-h-8">
                  新增并更新
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-9 w-full gap-1.5 lg:w-auto"
            disabled={!file || busy}
            onClick={() => file && previewMutation.mutate({ file, expectedStoreId: storeId, mode })}
          >
            {previewMutation.isPending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {previewMutation.isPending ? "正在生成" : "生成预览"}
          </Button>
        </div>

        {file ? (
          <div className="mt-3 grid min-w-0 gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="break-all text-xs font-medium text-foreground">{file.name}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatBytes(file.size)} · {formatMode(mode)} · 文件仅保留在当前浏览器流程中
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="min-h-9 justify-self-start gap-1.5 sm:justify-self-auto"
              disabled={busy}
              onClick={clearSelectedFile}
            >
              <Trash2 className="size-4" /> 清除文件
            </Button>
          </div>
        ) : null}

        {notice ? (
          <div
            ref={flowFocusRef}
            tabIndex={-1}
            role={notice.kind === "error" ? "alert" : "status"}
            aria-live={notice.kind === "error" ? "assertive" : "polite"}
            className={noticeClassName(notice.kind)}
          >
            {notice.kind === "info" && busy ? (
              <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" />
            ) : notice.kind === "error" ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            )}
            <span>{notice.message}</span>
          </div>
        ) : null}
      </section>

      {preview ? (
        <section
          ref={previewFocusRef}
          tabIndex={-1}
          className={repairOs.adminSection}
          aria-label="导入预览"
        >
          <RepairOsSectionHeader
            icon={CheckCircle2}
            iconFrame={false}
            title="导入预览"
            description="请核对当前店铺、模式、有效期、工单号和修改字段。"
            action={
              <Button
                type="button"
                variant="outline"
                className="min-h-9 gap-1.5"
                onClick={() => downloadTextReport(buildOrderDataPreviewReport(preview))}
              >
                <Download className="size-4" /> 完整预览报告
              </Button>
            }
          />

          <dl className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
            <PreviewContext label="当前店铺" value={storeName} />
            <PreviewContext label="导入模式" value={formatMode(preview.mode)} />
            <PreviewContext label="文件" value={file?.name ?? "已生成预览"} breakAll />
            <PreviewContext
              label="预览有效期"
              value={formatDateTime(preview.expiresAt)}
              danger={previewExpired}
            />
          </dl>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <OrderDataSummaryValue label="总行数" value={preview.summary.total} />
            <OrderDataSummaryValue label="新增" value={preview.summary.create} />
            <OrderDataSummaryValue label="更新" value={preview.summary.update} />
            <OrderDataSummaryValue label="跳过" value={preview.summary.skipped} />
            <OrderDataSummaryValue
              label="错误"
              value={preview.summary.invalid}
              danger={preview.summary.invalid > 0}
            />
          </div>

          {previewExpired ? (
            <div
              className="mt-3 flex gap-2 rounded-md border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2 text-xs leading-5 text-status-danger-foreground"
              role="alert"
            >
              <Clock3 className="mt-0.5 size-4 shrink-0" />
              <span>这份预览已过期，不能应用。请清除后重新选择文件并生成新预览。</span>
            </div>
          ) : null}

          {applyResult?.batchId === preview.batchId ? (
            <div
              ref={resultFocusRef}
              tabIndex={-1}
              role={applyResult.status === "partial" ? "alert" : "status"}
              className="mt-3 rounded-md border border-status-warn-foreground/25 bg-status-warn px-3 py-2 text-xs leading-5 text-status-warn-foreground"
            >
              应用结果：成功 {applyResult.applied} 行，冲突 {applyResult.conflicts} 行，失败{" "}
              {applyResult.failed} 行，跳过 {applyResult.skipped} 行。同一批次已锁定，不能重复提交。
            </div>
          ) : null}

          {visibleApplyRows.length > 0 ? (
            <div className="mt-3 space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-medium text-foreground">
                  未应用行：当前显示 {visibleApplyRows.length} / {applyResult?.rows?.length ?? 0}
                </p>
                {applyResult ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-9 gap-1.5 self-start"
                    onClick={() => downloadTextReport(buildOrderDataApplyReport(applyResult))}
                  >
                    <Download className="size-4" /> 下载完整错误报告
                  </Button>
                ) : null}
              </div>
              <div className="rounded-md border border-border sm:max-h-72 sm:overflow-auto">
                {visibleApplyRows.map((row) => (
                  <div
                    key={`${row.rowNumber}-${row.status}`}
                    className="grid min-w-0 gap-1 border-b border-border px-3 py-2 last:border-0 sm:grid-cols-[90px_110px_minmax(0,1fr)]"
                  >
                    <span className="text-xs font-medium text-foreground">
                      第 {row.rowNumber} 行
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {applyStatusLabel(row.status)}
                    </span>
                    <span className="break-words text-xs leading-5 text-muted-foreground">
                      {row.errors.length > 0
                        ? row.errors.map((issue) => issue.message).join("；")
                        : "未应用或已跳过"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {visiblePreviewRows.length > 0 ? (
            <div className="mt-3 space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-medium text-foreground">
                  预览明细：当前显示 {visiblePreviewRows.length} / {preview.rows.length}
                </p>
                <div className="flex flex-col items-start gap-1 sm:items-end">
                  {preview.rows.length > PREVIEW_RENDER_LIMIT ? (
                    <p className="text-[11px] text-muted-foreground">
                      页面最多展开前 100 行；完整内容请下载预览报告。
                    </p>
                  ) : null}
                  {preview.rows.length > PREVIEW_INITIAL_ROWS ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-8 px-2 text-xs"
                      onClick={() => setShowExpandedPreview((expanded) => !expanded)}
                    >
                      {showExpandedPreview
                        ? "收起预览明细"
                        : `展开前 ${Math.min(PREVIEW_RENDER_LIMIT, preview.rows.length)} 行`}
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="rounded-md border border-border sm:max-h-[28rem] sm:overflow-auto">
                {visiblePreviewRows.map((row) => (
                  <div
                    key={row.rowNumber}
                    className="grid min-w-0 gap-1 border-b border-border px-3 py-2 last:border-0 sm:grid-cols-[minmax(100px,140px)_100px_minmax(0,1fr)]"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        {row.publicNo ? `工单 ${row.publicNo}` : `第 ${row.rowNumber} 行`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        表格第 {row.rowNumber} 行
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {previewStatusLabel(row.status, row.action)}
                    </span>
                    <span className="break-words text-xs leading-5 text-muted-foreground">
                      {[...row.errors, ...row.warnings].length > 0
                        ? [...row.errors, ...row.warnings].map((issue) => issue.message).join("；")
                        : row.changedFields.length > 0
                          ? `将修改：${row.changedFields.join("、")}`
                          : "无字段变更"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-3 grid gap-3 border-t border-border pt-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0 space-y-1.5">
              <div className="flex min-h-9 items-center gap-2">
                <Checkbox
                  id="confirm-order-data-import"
                  checked={confirmed}
                  disabled={
                    preview.summary.invalid > 0 ||
                    !applyEnabled ||
                    previewExpired ||
                    currentBatchLocked ||
                    busy
                  }
                  onCheckedChange={(checked) => setConfirmed(checked === true)}
                />
                <Label
                  htmlFor="confirm-order-data-import"
                  className="flex min-h-9 flex-1 cursor-pointer items-center text-xs leading-5"
                >
                  确认这份预览属于“{storeName}”，并按预览结果处理当前店铺工单
                </Label>
              </div>
              {disabledReason ? (
                <p className="text-[11px] leading-5 text-muted-foreground">{disabledReason}</p>
              ) : (
                <p className="text-[11px] leading-5 text-status-warn-foreground">
                  新增类导入不能一键完全恢复；提交前还会显示最后确认。
                </p>
              )}
            </div>
            <Button
              type="button"
              className="min-h-10 w-full gap-1.5 border-0 text-primary-foreground lg:w-auto"
              style={brandGradientStyle}
              disabled={!canApply}
              onClick={() => setApplyConfirmOpen(true)}
            >
              <CheckCircle2 className="size-4" />
              检查并应用
            </Button>
          </div>
        </section>
      ) : null}

      {applyResult && !preview ? (
        <div
          ref={resultFocusRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="rounded-md border border-status-success-foreground/25 bg-status-success/20 px-3 py-3 text-xs leading-5 text-status-success-foreground"
        >
          导入完成：已应用 {applyResult.applied} 行，跳过 {applyResult.skipped} 行。同一批次已锁定。
        </div>
      ) : null}

      <section className={repairOs.adminSection}>
        <RepairOsSectionHeader
          icon={History}
          iconFrame={false}
          title="最近批次"
          description="按当前店铺读取最近 20 个脱敏摘要；不返回工作簿内容或字段前后值。"
          action={
            historyOpen ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-9 gap-1.5"
                disabled={batchHistoryQuery.isFetching}
                onClick={() => void batchHistoryQuery.refetch()}
              >
                {batchHistoryQuery.isFetching ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <History className="size-4" />
                )}
                刷新历史
              </Button>
            ) : undefined
          }
        />
        {!historyOpen ? (
          <div className="grid gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <p className="text-xs leading-5 text-muted-foreground">
              历史读取是独立动作，不会自动加载，也不会暴露客户字段。批次回滚仍未开放。
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-9 gap-1.5"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="size-4" /> 查看最近批次
            </Button>
          </div>
        ) : batchHistoryQuery.isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-20 items-center gap-2 text-xs text-muted-foreground"
          >
            <LoaderCircle className="size-4 animate-spin" /> 正在读取当前店铺批次摘要…
          </div>
        ) : batchHistoryQuery.isError ? (
          <div
            role="alert"
            className="grid gap-3 rounded-lg border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-3 text-xs text-status-danger-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <span>{errorMessage(batchHistoryQuery.error, "批次历史读取失败")}</span>
            <Button
              type="button"
              variant="outline"
              className="min-h-9"
              onClick={() => void batchHistoryQuery.refetch()}
            >
              重新读取
            </Button>
          </div>
        ) : !batchHistory || batchHistory.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
            当前店铺还没有可显示的工单数据批次。
          </div>
        ) : (
          <div className="space-y-2">
            <div className="rounded-lg border border-border">
              {batchHistory.items.map((batch) => (
                <div
                  key={batch.id}
                  className="grid min-w-0 gap-2 border-b border-border px-3 py-3 last:border-0 md:grid-cols-[minmax(130px,0.9fr)_minmax(120px,0.8fr)_minmax(0,1.2fr)_minmax(150px,1fr)]"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      {batchKindLabel(batch.kind)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {batchStatusLabel(batch.status)}
                    </p>
                  </div>
                  <div className="min-w-0 text-xs">
                    <p className="text-muted-foreground">
                      {batch.mode ? formatMode(batch.mode) : "不适用"}
                    </p>
                    <p className="mt-0.5 break-words text-[11px] text-muted-foreground">
                      {batch.actorDisplayName ?? "操作人已不可用"}
                    </p>
                  </div>
                  <p className="break-words text-xs leading-5 text-muted-foreground">
                    {batchSummaryText(batch.summary)}
                  </p>
                  <div className="text-[11px] leading-5 text-muted-foreground">
                    <p>创建：{formatDateTime(batch.createdAt)}</p>
                    <p>
                      {batch.appliedAt
                        ? `应用：${formatDateTime(batch.appliedAt)}`
                        : `到期：${formatDateTime(batch.expiresAt)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {batchHistory.hasMore ? (
              <p className="text-[11px] text-muted-foreground">
                这里只显示最近 20 个批次；更早历史未在本页加载。
              </p>
            ) : null}
          </div>
        )}
        <div className="mt-3 flex gap-2 rounded-md border border-status-warn-foreground/25 bg-status-warn px-3 py-2 text-[11px] leading-5 text-status-warn-foreground">
          <Clock3 className="mt-0.5 size-3.5 shrink-0" />
          <span>
            “到期”表示预览不可再应用，不等于已完成 PII 清理。可靠的保留期调度与监控仍需单独批准。
          </span>
        </div>
      </section>

      <AlertDialog open={applyConfirmOpen} onOpenChange={setApplyConfirmOpen}>
        <AlertDialogContent className="max-h-[min(88dvh,720px)] overflow-y-auto sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>确认应用工单数据？</AlertDialogTitle>
            <AlertDialogDescription>
              这是对当前店铺的批量写入。请最后核对店铺、模式、数量和恢复边界。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {preview ? (
            <dl className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 text-xs sm:grid-cols-2">
              <PreviewContext label="当前店铺" value={storeName} />
              <PreviewContext label="导入模式" value={formatMode(preview.mode)} />
              <PreviewContext
                label="新增 / 更新"
                value={`${preview.summary.create} / ${preview.summary.update}`}
              />
              <PreviewContext label="预览有效期" value={formatDateTime(preview.expiresAt)} />
            </dl>
          ) : null}
          <div className="flex gap-2 rounded-md border border-status-warn-foreground/25 bg-status-warn px-3 py-2 text-xs leading-5 text-status-warn-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              更新行仍会在服务端执行版本校验；新增行不会自动删除，发生部分成功时需下载错误报告并重新生成预览。
            </span>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-12" disabled={applyMutation.isPending}>
              返回预览
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-12 border-0 text-primary-foreground"
              style={brandGradientStyle}
              disabled={!preview || !canApply || applyMutation.isPending}
              onClick={() =>
                preview &&
                applyMutation.mutate({
                  batchId: preview.batchId,
                  expectedStoreId: storeId,
                  expiresAt: preview.expiresAt,
                })
              }
            >
              {applyMutation.isPending ? "正在应用" : "确认并应用"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PreviewContext({
  label,
  value,
  danger = false,
  breakAll = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
  breakAll?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd
        className={`mt-0.5 font-medium ${danger ? "text-status-danger-foreground" : "text-foreground"} ${breakAll ? "break-all" : "break-words"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadTextReport(report: OrderDataTextReport) {
  downloadBlob(new Blob([report.content], { type: "text/csv;charset=utf-8" }), report.fileName);
}

function previewStatusLabel(status: string, action: string) {
  if (status === "invalid") return "错误";
  if (status === "conflict") return "冲突";
  if (status === "failed") return "失败";
  if (status === "skipped") return "跳过";
  if (status === "applied") return "已应用";
  return action === "create" ? "新增" : "更新";
}

function applyStatusLabel(status: string) {
  if (status === "conflict") return "冲突";
  if (status === "failed") return "失败";
  if (status === "skipped") return "跳过";
  return "已应用";
}

function batchKindLabel(kind: string) {
  if (kind === "order_export") return "工单导出";
  if (kind === "customer_stats") return "客户统计";
  if (kind === "template") return "空白模板";
  return "工单导入";
}

function batchStatusLabel(status: string) {
  const labels: Record<string, string> = {
    building: "生成中",
    completed: "已完成",
    previewed: "已预览",
    applying: "应用中",
    applied: "已应用",
    partial: "部分完成",
    failed: "失败",
    expired: "已过期",
    rolled_back: "已恢复",
    rollback_partial: "部分恢复",
  };
  return labels[status] ?? "未知状态";
}

function batchSummaryText(summary: {
  total?: number;
  ready?: number;
  create?: number;
  update?: number;
  invalid?: number;
  skipped?: number;
  rows?: number;
  applied?: number;
  conflicts?: number;
  failed?: number;
}) {
  const values = [
    summary.rows !== undefined ? `导出 ${summary.rows}` : "",
    summary.total !== undefined ? `总计 ${summary.total}` : "",
    summary.ready !== undefined ? `可应用 ${summary.ready}` : "",
    summary.create !== undefined ? `新增 ${summary.create}` : "",
    summary.update !== undefined ? `更新 ${summary.update}` : "",
    summary.applied !== undefined ? `成功 ${summary.applied}` : "",
    summary.conflicts !== undefined ? `冲突 ${summary.conflicts}` : "",
    summary.failed !== undefined ? `失败 ${summary.failed}` : "",
    summary.invalid !== undefined ? `错误 ${summary.invalid}` : "",
    summary.skipped !== undefined ? `跳过 ${summary.skipped}` : "",
  ].filter(Boolean);
  return values.join(" · ") || "无计数摘要";
}

function applyDisabledReason(input: {
  preview: OrderDataImportPreview;
  applyEnabled: boolean;
  previewExpired: boolean;
  currentBatchLocked: boolean;
  confirmed: boolean;
}) {
  if (!input.applyEnabled) {
    return "最终应用当前保持关闭；需先完成状态流、默认质保、最大批次和保留期发布门禁。";
  }
  if (input.previewExpired) return "预览已过期，请重新生成。";
  if (input.currentBatchLocked) return "同一批次已经处理并锁定，不能重复提交。";
  if (input.preview.summary.invalid > 0) {
    return `仍有 ${input.preview.summary.invalid} 行错误，请修正文件后重新生成预览。`;
  }
  if (input.preview.summary.ready === 0) return "没有可应用的数据行。";
  if (!input.confirmed) return "请先确认当前店铺和预览内容。";
  return "";
}

function noticeClassName(kind: FlowNotice["kind"]) {
  const tone =
    kind === "error"
      ? "border-status-danger-foreground/25 bg-status-danger/10 text-status-danger-foreground"
      : kind === "success"
        ? "border-status-success-foreground/25 bg-status-success/20 text-status-success-foreground"
        : "border-border bg-muted/30 text-foreground";
  return `mt-3 flex gap-2 rounded-md border px-3 py-2 text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring ${tone}`;
}

function downloadLabel(kind: DownloadKind) {
  if (kind === "orders") return "导出工单";
  if (kind === "customers") return "客户统计";
  return "空白模板";
}

function downloadPendingLabel(kind: DownloadKind) {
  if (kind === "orders") return "正在导出工单…";
  if (kind === "customers") return "正在生成统计…";
  return "正在生成模板…";
}

function formatMode(mode: OrderDataImportMode) {
  return mode === "create_and_update" ? "新增并更新" : "只更新已有工单";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间无效";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function focusSoon(ref: { current: HTMLElement | null }) {
  window.setTimeout(() => ref.current?.focus(), 0);
}
