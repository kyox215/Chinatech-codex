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
import { useLocale } from "@/shared/i18n/locale-provider";
import { translateSettingsOperations } from "@/shared/i18n/messages";

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
  const { locale } = useLocale();
  const copy = (
    source: Parameters<typeof translateSettingsOperations>[1],
    values?: Parameters<typeof translateSettingsOperations>[2],
  ) => translateSettingsOperations(locale, source, values);
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
            {copy("检查状态流变更")}
          </DialogTitle>
          <DialogDescription>
            {copy("这是当前店铺草稿与已加载版本的差异。此步骤只检查，不写入服务器。")}
          </DialogDescription>
        </DialogHeader>

        <div className={`${componentOverlay.mobileBody} sm:px-5`}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric label={copy("新增状态")} value={summary.added} />
            <Metric label={copy("名称变化")} value={summary.renamed} />
            <Metric label={copy("可用性变化")} value={summary.availabilityChanged} />
            <Metric label={copy("流转变化")} value={summary.transitionsChanged} />
            <Metric label={copy("默认状态")} value={summary.defaultChanged ? 1 : 0} />
            <Metric label={copy("顺序变化")} value={summary.orderChanged ? 1 : 0} />
          </div>

          <section aria-labelledby="workflow-change-list-title">
            <div className="flex items-center justify-between gap-3">
              <h3 id="workflow-change-list-title" className="text-sm font-semibold">
                {copy("变更明细")}
              </h3>
              <Badge variant="outline">
                {copy("{count} 项", { count: summary.presentationItems.length })}
              </Badge>
            </div>
            {summary.presentationItems.length ? (
              <ul className="mt-2 grid gap-2 text-sm">
                {summary.presentationItems.map((item, index) => (
                  <li
                    key={`${item.code}:${index}`}
                    className="flex gap-2 rounded-lg bg-surface-muted/45 px-2.5 py-1.5 sm:px-3 sm:py-2"
                  >
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="min-w-0 break-words">{workflowChangeLabel(item, copy)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded-lg border border-dashed border-[var(--border-panel)] px-3 py-2.5 text-center text-xs text-muted-foreground sm:py-4 sm:text-sm">
                {copy("当前没有待检查的变更。")}
              </p>
            )}
          </section>

          <section aria-labelledby="workflow-impact-title">
            <h3 id="workflow-impact-title" className="text-sm font-semibold">
              {copy("可能影响的入口")}
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {summary.impactedEntrypointCodes.length ? (
                summary.impactedEntrypointCodes.map((entry) => (
                  <Badge key={entry} variant="outline" className="whitespace-normal text-left">
                    {workflowEntrypointLabel(entry, copy)}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">{copy("暂无入口变化")}</span>
              )}
            </div>
          </section>

          <section aria-labelledby="workflow-validation-title">
            <div className="flex items-center justify-between gap-3">
              <h3 id="workflow-validation-title" className="text-sm font-semibold">
                {copy("安全检查")}
              </h3>
              <Badge variant="outline">
                {issues.length
                  ? copy("{count} 项待处理", { count: issues.length })
                  : copy("本地检查通过")}
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
                    <span>{workflowIssueLabel(item, copy)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded-lg border border-[var(--border-panel)] bg-surface-muted/45 px-3 py-2 text-sm text-muted-foreground">
                {copy("本地结构与必填规则检查通过；仍需服务端事务、并发版本和活跃工单兼容性检查。")}
              </p>
            )}
          </section>

          <div
            id="workflow-apply-lock-reason"
            className="flex gap-2 rounded-lg border border-status-warn-foreground/25 bg-status-warn px-2.5 py-2 text-status-warn-foreground sm:gap-3 sm:px-3 sm:py-3"
          >
            <LockKeyhole className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{copy("应用仍处于审批门")}</p>
              <p className="mt-1 text-xs leading-5">
                {copy(
                  "状态、顺序、默认值与流转关系必须由一个带版本校验的事务接口一次提交。该接口尚未获批，因此不会调用旧的分步保存 API。",
                )}
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
            {copy("返回继续编辑")}
          </Button>
          <Button
            type="button"
            className="min-h-10"
            disabled
            aria-describedby="workflow-apply-lock-reason"
          >
            <LockKeyhole className="size-4" /> {copy("应用状态流（待审批）")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Copy = (
  source: Parameters<typeof translateSettingsOperations>[1],
  values?: Parameters<typeof translateSettingsOperations>[2],
) => string;

function workflowChangeLabel(
  item: OrderWorkflowChangeSummary["presentationItems"][number],
  copy: Copy,
) {
  const values = item.values;
  switch (item.code) {
    case "added_status":
      return copy("新增状态「{label}」", values);
    case "removed_status":
      return copy("移除状态「{label}」", values);
    case "renamed_status":
      return copy("修改状态名称「{from}」→「{to}」", values);
    case "availability_changed":
      return copy("{count} 个状态的启用/入口可见性发生变化", values);
    case "default_changed":
      return copy("默认新建状态「{from}」→「{to}」", values);
    case "order_changed":
      return copy("状态显示顺序发生变化");
    case "transitions_changed":
      return copy("{count} 条流转关系发生变化", values);
    case "metadata_changed":
      return copy("状态分组或语义色发生变化");
    default:
      return copy("状态流存在待检查变更。");
  }
}

function workflowEntrypointLabel(code: string, copy: Copy) {
  const labels = {
    list_filters: "工单列表与状态筛选",
    new_order_default: "新建工单默认状态",
    detail_task_bulk: "工单详情、任务页与批量流转",
    badges_timeline: "状态徽章与时间线显示",
    existing_order_compatibility: "已有工单兼容性（需服务端复核）",
  } as const;
  return code in labels ? copy(labels[code as keyof typeof labels]) : copy("状态流入口");
}

function workflowIssueLabel(item: OrderWorkflowDraftIssue, copy: Copy) {
  const values = item.presentationValues;
  switch (item.code) {
    case "invalid_code":
      return copy("状态“{label}”的代码格式不正确", values);
    case "invalid_label":
      return copy("状态“{label}”的名称长度无效", values);
    case "invalid_short_label":
      return copy("状态“{label}”的短标签过长", values);
    case "store_mismatch":
      return copy("“{label}”不属于当前店铺草稿", values);
    case "system_disabled":
      return copy("系统状态“{label}”不能停用", values);
    case "system_bucket_changed":
      return copy("系统状态“{label}”的主流程分组不能修改", values);
    case "custom_status_unmapped":
      return copy("自定义状态“{label}”尚未绑定主流程语义", values);
    case "duplicate_code":
      return copy("状态代码“{label}”重复", values);
    case "invalid_default_count":
      return copy("必须且只能有一个默认新建状态");
    case "invalid_default":
      return copy("默认新建状态必须启用并允许用于新建工单");
    case "no_create_status":
      return copy("至少需要一个已启用且可用于新建工单的状态");
    case "duplicate_transition":
      return copy("流转关系“{label}”重复", values);
    case "self_transition":
      return copy("状态“{label}”不能流转到自身", values);
    case "missing_transition_status":
      return copy("流转关系“{label}”引用了不存在的状态", values);
    case "disabled_transition_status":
      return copy("已启用流转“{from} → {to}”引用了停用状态", values);
    case "invalid_primary":
      return copy("状态“{label}”必须且只能有一个推荐下一步", values);
    default:
      return copy("状态流存在无效配置。");
  }
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border-panel)] bg-card px-2.5 py-1.5 sm:px-3 sm:py-2">
      <p className="text-[11px] text-muted-foreground lg:text-xs lg:leading-4">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums sm:mt-1 sm:text-lg">{value}</p>
    </div>
  );
}
