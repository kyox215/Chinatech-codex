"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OrderReasonField } from "@/features/orders/components/order-reason-field";
import { ResponsiveOrderActionOverlay } from "@/features/orders/components/responsive-order-action-overlay";
import {
  buildBusinessReasonSelection,
  createEmptyOrderReasonDraft,
  getOrderReasonCatalog,
  getOrderReasonLegacyPreview,
} from "@/features/orders/model/order-reason-catalog";
import type { BusinessReasonSelectionV2, OrderDetail } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";

export function ReworkDispositionCard({
  detail,
  pending,
  onLegacySave,
  onStartReview,
  onRecordDisposition,
  className,
}: {
  detail: OrderDetail;
  pending: boolean;
  onLegacySave: (diagnosisResult: string) => Promise<void>;
  onStartReview: (selection: BusinessReasonSelectionV2) => Promise<void>;
  onRecordDisposition: (selection: BusinessReasonSelectionV2) => Promise<void>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(createEmptyOrderReasonDraft);
  const startMode = Boolean(detail.capabilities?.canStartAfterSalesReview);
  const dispositionV2Mode = Boolean(detail.capabilities?.canDecideReworkDisposition);
  const catalog = getOrderReasonCatalog(startMode ? "rework.triage" : "rework.disposition");
  const selection = useMemo(() => buildBusinessReasonSelection(catalog, reason), [catalog, reason]);
  const diagnosis = detail.order.diagnosis_result?.trim() ?? "";
  const preview = getOrderReasonLegacyPreview(catalog, reason);
  const alreadyRecorded = !dispositionV2Mode && diagnosis.includes("返修检测处置：");
  const canEdit = Boolean(detail.capabilities?.canEditRepair);
  const blockedReason = startMode
    ? undefined
    : !canEdit
      ? "当前账号没有记录返修处置的权限。"
      : !diagnosis
        ? "请先记录检测结论，再选择返修处置。"
        : alreadyRecorded
          ? "已记录返修处置；如需修正，请在检测结论中保留原文并追加新结论。"
          : undefined;

  if (!startMode && detail.order.status !== "rework") return null;

  return (
    <>
      <section
        data-order-rework-disposition-card="true"
        className={cn(
          "flex min-w-0 items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-status-warn-foreground/20 bg-status-warn/35 px-3 py-2",
          className,
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <RotateCcw className="size-3.5 text-status-warn-foreground" />
            {startMode ? "售后复检" : "返修复检处置"}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {blockedReason ??
              (startMode
                ? "从已完结工单建立独立返修子单，原单证据和金额保持不变"
                : "检测完成后点选责任与后续方向，不需要手写处理说明")}
          </div>
        </div>
        {(startMode || canEdit) && !alreadyRecorded ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 text-xs"
            disabled={pending || (!startMode && !diagnosis)}
            onClick={() => {
              setReason(createEmptyOrderReasonDraft());
              setOpen(true);
            }}
          >
            {startMode ? "开始复检" : "选择处置"}
          </Button>
        ) : null}
      </section>

      <ResponsiveOrderActionOverlay
        open={open}
        pending={pending}
        dirty={Boolean(reason.primaryCode)}
        onOpenChange={setOpen}
        title={startMode ? "开始售后复检" : "返修检测后处置"}
        description={
          startMode
            ? "选择本次售后原因，系统会建立独立返修子单；原完结工单不会被修改。"
            : "先保留检测结论，再选择处置；系统会自动更新原单与返修单的关联类型。"
        }
        contentClassName="w-[min(600px,calc(100vw-24px))]"
        dataAttribute="data-order-rework-disposition-overlay"
        footer={
          <>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              返回
            </Button>
            <Button
              type="button"
              disabled={pending || !selection || (!startMode && !diagnosis)}
              onClick={() => {
                if (!selection || (!startMode && !diagnosis)) return;
                const action = startMode
                  ? onStartReview(selection)
                  : dispositionV2Mode
                    ? onRecordDisposition(selection)
                    : preview
                      ? onLegacySave(`${diagnosis}\n${preview}`)
                      : Promise.resolve();
                void action.then(() => setOpen(false)).catch(() => undefined);
              }}
            >
              {pending ? "处理中…" : startMode ? "建立复检单" : "确认处置"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {!startMode ? (
            <div className="rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2.5 py-2 text-xs">
              <p className="text-[10px] font-semibold text-muted-foreground">已记录的检测结论</p>
              <p className="mt-1 line-clamp-4 whitespace-pre-wrap leading-5">{diagnosis}</p>
            </div>
          ) : null}
          <OrderReasonField
            catalog={catalog}
            value={reason}
            onChange={setReason}
            disabled={pending}
            compact
          />
          {!startMode && !dispositionV2Mode && reason.primaryCode === "unrelated_new_fault" ? (
            <p className="rounded-lg bg-status-warn px-2.5 py-2 text-xs text-status-warn-foreground">
              本次只保存兼容摘要，不会声称已经创建关联新单。结构化关联需等数据阶段批准上线。
            </p>
          ) : null}
        </div>
      </ResponsiveOrderActionOverlay>
    </>
  );
}
