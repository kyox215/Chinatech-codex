"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";

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
import {
  OrderDataAction,
  OrderDataSummaryValue,
} from "@/features/settings/components/order-data-controls";
import {
  applyOrderDataImport,
  downloadOrderDataTemplate,
  exportCustomerStats,
  exportOrderData,
  previewOrderDataImport,
  type OrderDataImportApplyResult,
  type OrderDataImportMode,
  type OrderDataImportPreview,
} from "@/lib/repairdesk/api";
import { brandGradientStyle, repairOs } from "@/lib/ui-patterns";
import { RepairOsSectionHeader } from "@/shared/ui";

export function OrderDataSection({
  storeId,
  applyEnabled,
}: {
  storeId: string;
  applyEnabled: boolean;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File>();
  const [mode, setMode] = useState<OrderDataImportMode>("update_only");
  const [preview, setPreview] = useState<OrderDataImportPreview>();
  const [applyResult, setApplyResult] = useState<OrderDataImportApplyResult>();
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setFile(undefined);
    setPreview(undefined);
    setApplyResult(undefined);
    setConfirmed(false);
  }, [storeId]);

  const downloadMutation = useMutation({
    mutationFn: async (kind: "template" | "orders" | "customers") => {
      if (kind === "template") return downloadOrderDataTemplate(storeId);
      if (kind === "customers") return exportCustomerStats(storeId);
      return exportOrderData(storeId);
    },
    onSuccess: ({ blob, fileName }) => {
      downloadBlob(blob, fileName);
      toast.success("文件已生成");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "生成文件失败"),
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("请选择 XLSX 文件");
      return previewOrderDataImport({ file, expectedStoreId: storeId, mode });
    },
    onSuccess: (result) => {
      setPreview(result);
      setApplyResult(undefined);
      setConfirmed(false);
      toast.success(result.summary.invalid > 0 ? "预览完成，请修正错误行" : "预览完成");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "预览失败"),
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("请先生成导入预览");
      return applyOrderDataImport({ batchId: preview.batchId, expectedStoreId: storeId });
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ordersKeys.all }),
        queryClient.invalidateQueries({ queryKey: customersKeys.all }),
      ]);
      setApplyResult(result);
      if (result.status === "partial") {
        setConfirmed(false);
        toast.error(
          `部分完成：成功 ${result.applied}，冲突 ${result.conflicts}，失败 ${result.failed}`,
        );
        return;
      }
      toast.success(`已应用 ${result.applied} 行`);
      setPreview(undefined);
      setFile(undefined);
      setConfirmed(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "应用导入失败"),
  });

  const canApply = Boolean(
    preview &&
    preview.summary.ready > 0 &&
    preview.summary.invalid === 0 &&
    applyEnabled &&
    applyResult?.batchId !== preview.batchId &&
    confirmed &&
    !applyMutation.isPending,
  );

  return (
    <div className="space-y-3">
      <section className={repairOs.adminSection}>
        <RepairOsSectionHeader icon={FileSpreadsheet} iconFrame={false} title="工单数据文件" />
        <div className="grid gap-2 sm:grid-cols-3">
          <OrderDataAction
            icon={Download}
            title="空白模板"
            disabled={downloadMutation.isPending}
            onClick={() => downloadMutation.mutate("template")}
          />
          <OrderDataAction
            icon={FileSpreadsheet}
            title="导出工单"
            disabled={downloadMutation.isPending}
            onClick={() => downloadMutation.mutate("orders")}
          />
          <OrderDataAction
            icon={Users}
            title="客户统计"
            disabled={downloadMutation.isPending}
            onClick={() => downloadMutation.mutate("customers")}
          />
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-md border border-status-warning-border bg-status-warning-surface px-3 py-2 text-xs text-status-warning-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>导出文件包含客户资料，只保存在受控设备中。</span>
        </div>
      </section>

      <section className={repairOs.adminSection}>
        <RepairOsSectionHeader icon={Upload} iconFrame={false} title="导入工单" />
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="order-data-file" className="text-xs">
              XLSX 文件
            </Label>
            <Input
              id="order-data-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="min-w-0 text-xs file:mr-2 file:border-0 file:bg-transparent file:text-xs file:font-medium"
              onChange={(event) => {
                setFile(event.target.files?.[0]);
                setPreview(undefined);
                setApplyResult(undefined);
                setConfirmed(false);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="order-data-mode" className="text-xs">
              导入模式
            </Label>
            <Select
              value={mode}
              onValueChange={(value: OrderDataImportMode) => {
                setMode(value);
                setPreview(undefined);
                setApplyResult(undefined);
                setConfirmed(false);
              }}
            >
              <SelectTrigger id="order-data-mode" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="update_only">只更新已有工单</SelectItem>
                <SelectItem value="create_and_update">新增并更新</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 justify-self-start gap-1.5 sm:justify-self-auto"
            disabled={!file || previewMutation.isPending}
            onClick={() => previewMutation.mutate()}
          >
            <Upload className="size-4" />
            生成预览
          </Button>
        </div>
      </section>

      {preview ? (
        <section className={repairOs.adminSection}>
          <RepairOsSectionHeader icon={CheckCircle2} iconFrame={false} title="导入预览" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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

          {applyResult?.batchId === preview.batchId ? (
            <div className="mt-3 rounded-md border border-status-warning-border bg-status-warning-surface px-3 py-2 text-xs leading-5 text-status-warning-foreground">
              应用结果：成功 {applyResult.applied} 行，冲突 {applyResult.conflicts} 行，失败{" "}
              {applyResult.failed} 行，跳过 {applyResult.skipped} 行。
            </div>
          ) : null}

          {applyResult?.batchId === preview.batchId && applyResult.rows?.length ? (
            <div className="mt-3 max-h-64 overflow-auto rounded-md border border-border">
              {applyResult.rows.slice(0, 50).map((row) => (
                <div
                  key={`${row.rowNumber}-${row.status}`}
                  className="grid gap-1 border-b border-border px-3 py-2 last:border-0 sm:grid-cols-[90px_110px_1fr]"
                >
                  <span className="text-xs font-medium text-foreground">第 {row.rowNumber} 行</span>
                  <span className="text-xs text-muted-foreground">
                    {applyStatusLabel(row.status)}
                  </span>
                  <span className="text-xs leading-5 text-muted-foreground">
                    {row.errors.length > 0
                      ? row.errors.map((issue) => issue.message).join("；")
                      : "未应用或已跳过"}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {preview.rows.length > 0 ? (
            <div className="mt-3 max-h-64 overflow-auto rounded-md border border-border">
              {preview.rows.slice(0, 100).map((row) => (
                <div
                  key={row.rowNumber}
                  className="grid gap-1 border-b border-border px-3 py-2 last:border-0 sm:grid-cols-[90px_110px_1fr]"
                >
                  <span className="text-xs font-medium text-foreground">第 {row.rowNumber} 行</span>
                  <span className="text-xs text-muted-foreground">
                    {previewStatusLabel(row.status, row.action)}
                  </span>
                  <span className="text-xs leading-5 text-muted-foreground">
                    {[...row.errors, ...row.warnings].length > 0
                      ? [...row.errors, ...row.warnings].map((issue) => issue.message).join("；")
                      : row.changedFields.length > 0
                        ? `将修改：${row.changedFields.join("、")}`
                        : "无字段变更"}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <Checkbox
                id="confirm-order-data-import"
                checked={confirmed}
                disabled={preview.summary.invalid > 0 || !applyEnabled}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
              />
              <Label htmlFor="confirm-order-data-import" className="text-xs leading-5">
                {applyEnabled ? "确认按预览结果更新当前店铺工单" : "工单导入应用当前已暂停"}
              </Label>
            </div>
            <Button
              type="button"
              className="h-9 gap-1.5 border-0 text-primary-foreground"
              style={brandGradientStyle}
              disabled={!canApply}
              onClick={() => applyMutation.mutate()}
            >
              <CheckCircle2 className="size-4" />
              应用导入
            </Button>
          </div>
        </section>
      ) : null}

      {applyResult && !preview ? (
        <div className="rounded-md border border-status-success-foreground/25 bg-status-success/20 px-3 py-2 text-xs text-status-success-foreground">
          导入完成：已应用 {applyResult.applied} 行，跳过 {applyResult.skipped} 行。
        </div>
      ) : null}
    </div>
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function previewStatusLabel(status: string, action: string) {
  if (status === "invalid") return "错误";
  if (status === "skipped") return "跳过";
  return action === "create" ? "新增" : "更新";
}

function applyStatusLabel(status: string) {
  if (status === "conflict") return "冲突";
  if (status === "failed") return "失败";
  if (status === "skipped") return "跳过";
  return "已应用";
}
