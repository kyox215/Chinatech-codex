"use client";

import { ArrowDown, ArrowUp, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getOrderWorkflowBucketLabel } from "@/features/orders/model/order-workflow";
import { RepairOsBusinessCard } from "@/shared/ui";
import type { OrderWorkflowStatus } from "@/lib/repairdesk/types";

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
  return (
    <div className="grid min-w-0 gap-2" role="list" aria-label="状态列表">
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
            <StatusSummary status={status} />
            {canEdit ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={index === 0}
                  aria-label={`上移状态 ${status.label}`}
                  onClick={() => onMove(status.id, -1)}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={index === statuses.length - 1}
                  aria-label={`下移状态 ${status.label}`}
                  onClick={() => onMove(status.id, 1)}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-9"
                  aria-label={`编辑状态 ${status.label}`}
                  onClick={() => onEdit(status.id)}
                >
                  <Pencil className="size-4" /> 编辑
                </Button>
              </div>
            ) : null}
          </div>
        </RepairOsBusinessCard>
      ))}
    </div>
  );
}

function StatusSummary({ status }: { status: OrderWorkflowStatus }) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="break-words text-sm font-semibold">{status.label}</p>
        <Badge variant="outline">{getOrderWorkflowBucketLabel(status.bucket)}</Badge>
        <Badge variant="outline">{status.is_system ? "系统" : "自定义"}</Badge>
        {!status.enabled ? <Badge variant="outline">已停用</Badge> : null}
      </div>
      <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
        {status.code}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{status.show_in_order_filters ? "显示于筛选" : "不显示于筛选"}</span>
        <span>{status.allowed_for_create ? "可用于新建" : "不可用于新建"}</span>
        {status.is_default_create_status ? (
          <span className="font-medium text-primary">默认新建状态</span>
        ) : null}
      </div>
    </div>
  );
}
