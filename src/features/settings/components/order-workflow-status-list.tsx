"use client";

import { ArrowDown, ArrowUp, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RepairOsBusinessCard } from "@/shared/ui";
import type { OrderWorkflowStatus } from "@/lib/repairdesk/types";
import { useLocale } from "@/shared/i18n/locale-provider";
import { translateSettingsOperations } from "@/shared/i18n/messages";

export function OrderWorkflowStatusList({
  statuses,
  canEdit,
  onEdit,
  onMove,
}: {
  statuses: OrderWorkflowStatus[];
  canEdit: boolean;
  onEdit: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}) {
  const { locale } = useLocale();
  const copy = (
    source: Parameters<typeof translateSettingsOperations>[1],
    values?: Parameters<typeof translateSettingsOperations>[2],
  ) => translateSettingsOperations(locale, source, values);
  return (
    <div className="grid min-w-0 gap-2" role="list" aria-label={copy("状态列表")}>
      {statuses.map((status, index) => (
        <RepairOsBusinessCard
          key={status.id}
          as="div"
          role="listitem"
          data-ui="workflow-status-card"
          data-workflow-status-code={status.code}
          className="grid-cols-1 gap-3 px-3 py-3 hover:bg-card sm:px-4"
        >
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <StatusSummary status={status} copy={copy} />
            {canEdit ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 sm:size-8"
                  disabled={index === 0}
                  aria-label={copy("上移状态 {label}", { label: status.label })}
                  onClick={() => onMove(status.id, -1)}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 sm:size-8"
                  disabled={index === statuses.length - 1}
                  aria-label={copy("下移状态 {label}", { label: status.label })}
                  onClick={() => onMove(status.id, 1)}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 sm:min-h-9"
                  aria-label={copy("编辑状态 {label}", { label: status.label })}
                  onClick={() => onEdit(status.id)}
                >
                  <Pencil className="size-4" /> {copy("编辑")}
                </Button>
              </div>
            ) : null}
          </div>
        </RepairOsBusinessCard>
      ))}
    </div>
  );
}

function StatusSummary({ status, copy }: { status: OrderWorkflowStatus; copy: Copy }) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="break-words text-sm font-semibold">{status.label}</p>
        <Badge variant="outline">{workflowBucketLabel(status.bucket, copy)}</Badge>
        <Badge variant="outline">{copy(status.is_system ? "系统" : "自定义")}</Badge>
        {!status.enabled ? <Badge variant="outline">{copy("已停用")}</Badge> : null}
      </div>
      <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
        {status.code}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{copy(status.show_in_order_filters ? "显示于筛选" : "不显示于筛选")}</span>
        <span>{copy(status.allowed_for_create ? "可用于新建" : "不可用于新建")}</span>
        {status.is_default_create_status ? (
          <span className="font-medium text-primary">{copy("默认新建状态")}</span>
        ) : null}
      </div>
    </div>
  );
}

type Copy = (
  source: Parameters<typeof translateSettingsOperations>[1],
  values?: Parameters<typeof translateSettingsOperations>[2],
) => string;

function workflowBucketLabel(bucket: OrderWorkflowStatus["bucket"], copy: Copy) {
  const labels = {
    intake: "受理",
    diagnosing: "检测报价",
    quote: "检测报价",
    parts: "配件",
    repair: "维修",
    pickup: "取机",
    done: "结案",
    cancelled: "异常",
    custom: "自定义",
  } as const;
  return copy(labels[bucket]);
}
