"use client";

import { useRef } from "react";
import { CheckCircle2, LockKeyhole, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  OrderWorkflowChangeSummary,
  OrderWorkflowDraftIssue,
} from "@/features/settings/model/order-workflow-draft-review";
import { componentOverlay } from "@/lib/component-patterns";

export interface OrderWorkflowReviewDialogProps {
  open: boolean;
  summary: OrderWorkflowChangeSummary;
  issues: OrderWorkflowDraftIssue[];
  onOpenChange: (open: boolean) => void;
  onRestoreFocus: () => void;
}

export function OrderWorkflowReviewDialog({
  open,
  summary,
  issues,
  onOpenChange,
  onRestoreFocus,
}: OrderWorkflowReviewDialogProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(40rem,calc(100vw-24px))] max-w-none p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => titleRef.current?.focus());
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
      >
        <DialogHeader
          className={`${componentOverlay.mobileHeader} border-b border-[var(--border-panel)] pr-14 text-left sm:px-5`}
        >
          <DialogTitle ref={titleRef} tabIndex={-1} className="outline-none">
            检查状态流变更
          </DialogTitle>
          <DialogDescription>
            这是当前店铺草稿与已加载版本的差异。此步骤只检查，不写入服务器。
          </DialogDescription>
        </DialogHeader>

        <div className={`${componentOverlay.mobileBody} sm:px-5`}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric label="新增状态" value={summary.added} />
            <Metric label="名称变化" value={summary.renamed} />
            <Metric label="可用性变化" value={summary.availabilityChanged} />
            <Metric label="流转变化" value={summary.transitionsChanged} />
            <Metric label="默认状态" value={summary.defaultChanged ? 1 : 0} />
            <Metric label="顺序变化" value={summary.orderChanged ? 1 : 0} />
          </div>

          <section aria-labelledby="workflow-change-list-title">
            <div className="flex items-center justify-between gap-3">
              <h3 id="workflow-change-list-title" className="text-sm font-semibold">
                变更明细
              </h3>
              <Badge variant="outline">{summary.items.length} 项</Badge>
            </div>
            {summary.items.length ? (
              <ul className="mt-2 grid gap-2 text-sm">
                {summary.items.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 rounded-lg bg-surface-muted/45 px-2.5 py-1.5 sm:px-3 sm:py-2"
                  >
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="min-w-0 break-words">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded-lg border border-dashed border-[var(--border-panel)] px-3 py-2.5 text-center text-xs text-muted-foreground sm:py-4 sm:text-sm">
                当前没有待检查的变更。
              </p>
            )}
          </section>

          <section aria-labelledby="workflow-impact-title">
            <h3 id="workflow-impact-title" className="text-sm font-semibold">
              可能影响的入口
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {summary.impactedEntrypoints.length ? (
                summary.impactedEntrypoints.map((entry) => (
                  <Badge key={entry} variant="outline" className="whitespace-normal text-left">
                    {entry}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">暂无入口变化</span>
              )}
            </div>
          </section>

          <section aria-labelledby="workflow-validation-title">
            <div className="flex items-center justify-between gap-3">
              <h3 id="workflow-validation-title" className="text-sm font-semibold">
                安全检查
              </h3>
              <Badge variant="outline">
                {issues.length ? `${issues.length} 项待处理` : "本地检查通过"}
              </Badge>
            </div>
            {issues.length ? (
              <ul className="mt-2 grid gap-2">
                {issues.map((item, index) => (
                  <li
                    key={`${item.code}:${item.statusId ?? index}`}
                    className="flex gap-2 rounded-lg border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2 text-sm text-status-danger-foreground"
                  >
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                    <span>{item.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded-lg border border-[var(--border-panel)] bg-surface-muted/45 px-3 py-2 text-sm text-muted-foreground">
                本地结构与必填规则检查通过；仍需服务端事务、并发版本和活跃工单兼容性检查。
              </p>
            )}
          </section>

          <div
            id="workflow-apply-lock-reason"
            className="flex gap-2 rounded-lg border border-status-warn-foreground/25 bg-status-warn px-2.5 py-2 text-status-warn-foreground sm:gap-3 sm:px-3 sm:py-3"
          >
            <LockKeyhole className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-sm font-semibold">应用仍处于审批门</p>
              <p className="mt-1 text-xs leading-5">
                状态、顺序、默认值与流转关系必须由一个带版本校验的事务接口一次提交。该接口尚未获批，因此不会调用旧的分步保存
                API。
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className={`${componentOverlay.mobileFooter} bg-card sm:px-5`}>
          <Button
            type="button"
            variant="outline"
            className="min-h-9"
            onClick={() => onOpenChange(false)}
          >
            返回继续编辑
          </Button>
          <Button
            type="button"
            className="min-h-10"
            disabled
            aria-describedby="workflow-apply-lock-reason"
          >
            <LockKeyhole className="size-4" /> 应用状态流（待审批）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border-panel)] bg-card px-2.5 py-1.5 sm:px-3 sm:py-2">
      <p className="text-[11px] text-muted-foreground lg:text-xs lg:leading-4">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums sm:mt-1 sm:text-lg">{value}</p>
    </div>
  );
}
