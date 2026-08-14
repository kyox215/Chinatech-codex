"use client";

import Link from "next/link";
import {
  ArchiveX,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  Clock3,
  History,
  Loader2,
  PackageCheck,
  ShieldCheck,
  Tag,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  InventoryItemStatus,
  InventoryLifecycleListSummary,
  InventoryLifecycleProjection,
} from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { InventoryStatusBadge } from "@/features/inventory/components/inventory-ui-primitives";
import {
  getInventoryLifecycleProjectionMeta,
  inventoryLifecycleProjectionStatusMeta,
} from "../model/projection";
import type { InventoryDetailNextAction } from "@/features/inventory/model/inventory-detail-next-action";
import { InventoryNoActionGuidanceCard } from "@/features/inventory/components/inventory-no-action-guidance-card";
import { resolveInventoryNoActionGuidance } from "@/features/inventory/model/inventory-no-action-guidance";
import { InventoryLifecycleTimeline } from "./inventory-lifecycle-timeline";
import {
  buildInventoryLifecycleMilestones,
  resolveInventoryMilestoneTimeline,
} from "../model/inventory-lifecycle-timeline";

export type LifecycleStatus = InventoryLifecycleListSummary["business_status"];

export const lifecycleStatusMeta: Record<
  LifecycleStatus,
  { label: string; className: string; description: string }
> = {
  in_stock: {
    label: "在售",
    className: "bg-status-success text-status-success-foreground",
    description: "商品可继续进入预订流程。",
  },
  reserved: {
    label: "已预订",
    className: "bg-status-warn text-status-warn-foreground",
    description: "商品已被客户锁定，等待付款或取走。",
  },
  sold_pending_pickup: {
    label: "待取货",
    className: "bg-status-info text-status-info-foreground",
    description: "销售已完成，尚未确认客户取走。",
  },
  delivered: {
    label: "已交付",
    className: "bg-status-neutral text-status-neutral-foreground",
    description: "已记录实际取走时间，可继续查看保修或售后。",
  },
  after_sales: {
    label: "售后处理中",
    className: "bg-status-danger text-status-danger-foreground",
    description: "设备已有未关闭售后案件。",
  },
  removed: {
    label: "已移除",
    className: "bg-muted text-muted-foreground",
    description: "商品不再参与正常销售。",
  },
};

export function InventoryLifecycleStatusBadge({
  status,
  className,
}: {
  status: LifecycleStatus;
  className?: string;
}) {
  const meta = lifecycleStatusMeta[status];
  return (
    <InventoryStatusBadge className={cn(meta.className, className)}>
      {meta.label}
    </InventoryStatusBadge>
  );
}

const projectionToneClasses = {
  neutral: "bg-status-neutral text-status-neutral-foreground",
  info: "bg-status-info text-status-info-foreground",
  warning: "bg-status-warn text-status-warn-foreground",
  success: "bg-status-success text-status-success-foreground",
  danger: "bg-status-danger text-status-danger-foreground",
} as const;

export function getInventoryLifecycleProjectionToneClass(tone: keyof typeof projectionToneClasses) {
  return projectionToneClasses[tone];
}

const projectionIcons = {
  "circle-dashed": CircleDashed,
  tag: Tag,
  clock: Clock3,
  "package-check": PackageCheck,
  "check-circle": CheckCircle2,
  wrench: Wrench,
  "archive-x": ArchiveX,
} as const;

export function InventoryLifecycleProjectionBadge({
  projection,
  legacyStatus,
  className,
}: {
  projection: InventoryLifecycleProjection;
  legacyStatus?: InventoryItemStatus | string | null;
  className?: string;
}) {
  const meta = getInventoryLifecycleProjectionMeta(projection, legacyStatus);
  const Icon = projectionIcons[meta.icon];
  return (
    <InventoryStatusBadge className={cn(projectionToneClasses[meta.tone], "gap-1", className)}>
      <Icon className="size-3" aria-hidden="true" />
      <span>{meta.label}</span>
    </InventoryStatusBadge>
  );
}

export function InventoryLifecycleProjectionStatusIcon({
  status,
  className,
}: {
  status: InventoryLifecycleProjection["status"];
  className?: string;
}) {
  const Icon = projectionIcons[inventoryLifecycleProjectionStatusMeta[status].icon];
  return <Icon className={cn("size-3.5", className)} aria-hidden="true" />;
}

export function InventoryLifecycleSummaryCard({
  summary,
  itemId,
  compact = false,
  hidePrimaryStatus = false,
  nextAction,
  hideMobilePrimaryAction = false,
  onAction,
  onReadOnly,
}: {
  summary: InventoryLifecycleListSummary;
  itemId: string;
  compact?: boolean;
  hidePrimaryStatus?: boolean;
  nextAction?: InventoryDetailNextAction;
  hideMobilePrimaryAction?: boolean;
  onAction?: () => void;
  onReadOnly?: () => void | Promise<void>;
}) {
  const projection = summary.projection;
  const meta = lifecycleStatusMeta[summary.business_status];
  const projectionMeta =
    projection?.mode === "exact" ? getInventoryLifecycleProjectionMeta(projection) : undefined;
  const allowedActions =
    projection?.mode === "exact" ? projection.allowed_actions : summary.allowed_actions;
  const canReserve = allowedActions?.includes("reservation.create") === true;
  const nextHref = summary.after_sales?.case_id
    ? `/inventory/after-sales/${encodeURIComponent(summary.after_sales.case_id)}`
    : summary.sale_order_id
      ? `/inventory/sales/${encodeURIComponent(summary.sale_order_id)}`
      : canReserve
        ? `/inventory/${encodeURIComponent(itemId)}/reserve`
        : null;
  const nextLabel = summary.after_sales?.case_id
    ? "继续处理售后"
    : summary.sale_order_id
      ? summary.business_status === "reserved"
        ? "收款 / 完成成交"
        : "打开销售与保修"
      : "开始预订";
  const resolvedHref =
    nextAction?.kind === "action" ? nextAction.href : nextAction ? undefined : nextHref;
  const resolvedLabel =
    nextAction?.kind === "action"
      ? nextAction.label
      : nextAction?.kind === "loading"
        ? nextAction.label
        : nextAction?.kind === "none"
          ? "当前没有可执行动作"
          : nextLabel;
  const resolvedLoading = nextAction?.kind === "loading";
  const resolvedNone = nextAction?.kind === "none";
  const primaryActionClass = hideMobilePrimaryAction ? "max-lg:hidden" : undefined;
  const noActionGuidance = resolveInventoryNoActionGuidance({
    lifecycleState: nextAction?.kind === "loading" ? "loading" : "ready",
    hasData: true,
    projectionMode: projection?.mode ?? "compatible",
    projection,
    status: summary.business_status,
    allowedActions,
  });

  return (
    <section
      data-ui="inventory-lifecycle-summary"
      className={cn(repairOs.mobileInfoCard, compact ? "p-2" : "p-2.5 sm:p-3")}
      aria-labelledby="inventory-lifecycle-summary-title"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <PackageCheck className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <h2
              id="inventory-lifecycle-summary-title"
              className="truncate text-[11px] font-semibold lg:text-sm"
            >
              当前业务
            </h2>
          </div>
          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
            {projectionMeta?.description ?? meta.description}
          </p>
        </div>
        {!hidePrimaryStatus && projection?.mode === "exact" ? (
          <InventoryLifecycleProjectionBadge projection={projection} />
        ) : !hidePrimaryStatus ? (
          <InventoryLifecycleStatusBadge status={summary.business_status} />
        ) : null}
      </div>

      <div className="mt-2 grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-4">
        <LifecycleFact label="SKU" value={summary.sku} mono />
        <LifecycleFact label="预订到期" value={formatDate(summary.reservation_expires_at)} />
        <LifecycleFact label="预计取走" value={formatDate(summary.expected_pickup_at)} />
        <LifecycleFact label="保修至" value={formatDate(summary.warranty_ends_at)} />
      </div>

      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 border-t border-[var(--border-panel)] pt-2">
        <span className="inline-flex min-h-7 items-center gap-1 rounded-lg bg-[var(--surface-panel-muted)] px-2 text-[10px] text-muted-foreground">
          <History className="size-3" aria-hidden="true" />
          版本 {summary.order_version ?? summary.unit_version ?? "—"}
        </span>
        {noActionGuidance ? (
          <InventoryNoActionGuidanceCard
            guidance={noActionGuidance}
            onReadOnly={onReadOnly}
            className="w-full basis-full"
          />
        ) : resolvedHref ? (
          <Button asChild className={cn("min-h-11 gap-1.5 px-3 text-xs", primaryActionClass)}>
            <Link href={resolvedHref}>
              {resolvedLabel}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant={resolvedNone || resolvedLoading ? "outline" : "default"}
            disabled={resolvedNone || resolvedLoading}
            aria-busy={resolvedLoading}
            className={cn("min-h-11 gap-1.5 text-xs", primaryActionClass)}
            onClick={onAction}
          >
            {resolvedLoading ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : null}
            {resolvedLabel}
            {!resolvedNone && !resolvedLoading ? (
              <ArrowRight className="size-3.5" aria-hidden="true" />
            ) : null}
          </Button>
        )}
      </div>
    </section>
  );
}

export function InventoryLifecycleUnavailableCard({
  title = "商品生命周期暂不可用",
  body = "当前门店的生命周期开关尚未启用，或服务端尚未返回完整业务资料。现有库存数据不会被修改。",
  onBack,
}: {
  title?: string;
  body?: string;
  onBack?: () => void;
}) {
  return (
    <section
      data-ui="inventory-lifecycle-unavailable"
      className={cn(repairOs.mobileInfoCard, "p-4")}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2.5">
        <CircleAlert
          className="mt-0.5 size-4 shrink-0 text-status-warn-foreground"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
          {onBack ? (
            <Button
              type="button"
              variant="outline"
              className="mt-3 min-h-11 text-xs"
              onClick={onBack}
            >
              返回商品库存
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function InventoryDeviceHealthCard({
  category,
  brand,
  specifications,
  inspection,
  showExtendedChecks = true,
}: {
  category: string;
  brand?: string;
  specifications?: Record<string, string>;
  inspection?: InventoryLifecycleListSummary["inspection"];
  /** Detail pages can keep the first health summary focused on battery/Face ID. */
  showExtendedChecks?: boolean;
}) {
  const isApple = brand?.trim().toLowerCase() === "apple";
  const checks = [
    { key: "battery_health", label: "电池健康", icon: ShieldCheck },
    { key: "face_id_status", label: "Face ID", icon: ShieldCheck },
    { key: "touch_id_status", label: "Touch ID", icon: ShieldCheck },
    { key: "true_tone_status", label: "原彩显示", icon: ShieldCheck },
    { key: "activation_lock_status", label: "激活锁", icon: ShieldCheck },
    { key: "data_wipe_status", label: "数据抹除", icon: ShieldCheck },
  ].filter(
    (check) =>
      isApple ||
      !["battery_health", "face_id_status", "touch_id_status", "true_tone_status"].includes(
        check.key,
      ),
  );
  const visibleChecks = showExtendedChecks
    ? checks
    : checks.filter(({ key }) => ["battery_health", "face_id_status"].includes(key));
  const hasHealthSignal =
    Boolean(inspection) || visibleChecks.some(({ key }) => specifications?.[key] !== undefined);
  if (!hasHealthSignal) return null;

  return (
    <section
      data-ui="inventory-device-health"
      className={cn(repairOs.mobileInfoCard, "p-2.5 sm:p-3")}
      aria-labelledby="inventory-device-health-title"
    >
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
        <h2 id="inventory-device-health-title" className="text-[11px] font-semibold lg:text-sm">
          设备检测
        </h2>
        <span className="ml-auto text-[10px] text-muted-foreground">未检测不会显示为 0</span>
      </div>
      <div className="mt-2 grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-3">
        {visibleChecks.map(({ key, label, icon: Icon }) => {
          const inspectionValue = inspection?.[key as keyof NonNullable<typeof inspection>];
          const raw =
            inspectionValue === null || inspectionValue === undefined
              ? specifications?.[key]
              : String(inspectionValue);
          const value =
            key === "battery_health" && raw ? `${raw}%` : raw ? inspectionStatusLabel(raw) : raw;
          return (
            <div key={key} className="min-w-0 rounded-lg bg-[var(--surface-panel-muted)] p-2">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Icon className="size-3" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </div>
              <p
                className={cn(
                  "mt-1 truncate text-xs font-semibold",
                  !value && "text-muted-foreground",
                )}
              >
                {value || "尚未检测"}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] leading-3 text-muted-foreground">
        检测时间：{inspection?.inspected_at ? formatFullDate(inspection.inspected_at) : "未检测"}
      </p>
    </section>
  );
}

export function InventoryLifecycleHistoryCard({
  summary,
}: {
  summary: InventoryLifecycleListSummary;
}) {
  return (
    <InventoryLifecycleTimeline
      source="milestone-summary"
      result={resolveInventoryMilestoneTimeline(buildInventoryLifecycleMilestones(summary))}
    />
  );
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function LifecycleFact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
      <p className="truncate text-[9px] leading-3 text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 truncate text-[11px] font-semibold leading-4", mono && "font-mono")}>
        {value}
      </p>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "未安排";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "未安排";
  return new Intl.DateTimeFormat("zh-CN", { day: "2-digit", month: "2-digit" }).format(parsed);
}

function inspectionStatusLabel(value: string) {
  return (
    {
      not_tested: "未检测",
      normal: "正常",
      abnormal: "异常",
      not_applicable: "不适用",
    }[value] ?? value
  );
}
