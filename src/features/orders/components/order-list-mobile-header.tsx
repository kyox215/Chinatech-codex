"use client";

import type { ReactNode, Ref } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Bell,
  CheckCircle2,
  ListTodo,
  LoaderCircle,
  PackageCheck,
  PackagePlus,
  Plus,
  Search,
  Wrench,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { brandGradientStyle, repairOs } from "@/lib/ui-patterns";
import type { StatusTone } from "@/lib/mock/enums";
import {
  orderMobileQueueAllSpan,
  orderMobileQueueGrid,
} from "@/features/orders/components/order-list-layout";
import { RealtimeSyncIndicator } from "@/features/realtime";
import { cn } from "@/lib/utils";

const groupIcons: Record<string, LucideIcon> = {
  all: ListTodo,
  processing: Wrench,
  ordered: PackagePlus,
  arrived: PackageCheck,
  arrived_notified: Bell,
  repaired: CheckCircle2,
  repaired_notified: BadgeCheck,
};

function groupToneClass(tone: StatusTone | undefined, active: boolean) {
  if (tone === "info") {
    return active
      ? "border-status-info-foreground/45 bg-status-info text-status-info-foreground ring-1 ring-inset ring-status-info-foreground/25"
      : "border-status-info-foreground/25 bg-status-info/65 text-status-info-foreground";
  }
  if (tone === "warn") {
    return active
      ? "border-status-warn-foreground/45 bg-status-warn text-status-warn-foreground ring-1 ring-inset ring-status-warn-foreground/25"
      : "border-status-warn-foreground/25 bg-status-warn/65 text-status-warn-foreground";
  }
  if (tone === "success") {
    return active
      ? "border-status-success-foreground/45 bg-status-success text-status-success-foreground ring-1 ring-inset ring-status-success-foreground/25"
      : "border-status-success-foreground/25 bg-status-success/65 text-status-success-foreground";
  }
  return active
    ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-action)]"
    : "border-[var(--border-panel)] bg-surface-muted text-muted-foreground";
}

export function MobileOrdersFloatingHeader({
  groups,
  groupValue,
  pendingGroupValue,
  pendingLabel,
  totalOrders,
  onGroupChange,
  onCreateOrder,
  scanAction,
  searchValue,
  searchBusy,
  interactionDisabled = false,
  onSearchChange,
  onSearchSubmit,
  onSearchClear,
  viewModeControl,
  headerRef,
}: {
  groups: {
    key: string;
    label: string;
    shortLabel?: string;
    count: number;
    hint?: string;
    tone?: StatusTone;
  }[];
  groupValue: string;
  pendingGroupValue?: string;
  pendingLabel?: string;
  totalOrders: number;
  onGroupChange: (value: string) => void;
  onCreateOrder: () => void;
  scanAction?: ReactNode;
  searchValue: string;
  searchBusy: boolean;
  interactionDisabled?: boolean;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSearchClear: () => void;
  viewModeControl?: ReactNode;
  headerRef?: Ref<HTMLDivElement>;
}) {
  const activeGroup = groups.find((group) => group.key === groupValue);

  return (
    <div ref={headerRef} className={repairOs.mobileListHeaderShell}>
      <section className={repairOs.mobileFloatingHeaderCard}>
        <header className={repairOs.mobileFloatingHeaderNav}>
          <SidebarTrigger className="size-10 rounded-xl border border-[var(--border-panel)] bg-card shadow-none" />
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-semibold leading-5">订单管理</p>
            <p className="flex items-center justify-center gap-1 truncate text-[9px] leading-3 text-muted-foreground">
              <span className="truncate">
                {pendingLabel
                  ? `正在加载${pendingLabel}…`
                  : `${activeGroup?.label ?? "全部"} · 共 ${totalOrders} 条`}
              </span>
              <RealtimeSyncIndicator compact />
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            className="size-10 rounded-xl border-0 text-primary-foreground shadow-[var(--shadow-action)]"
            style={brandGradientStyle}
            onClick={onCreateOrder}
            aria-label="新建工单"
          >
            <Plus className="size-4" />
          </Button>
        </header>

        <div className={cn(repairOs.mobileFloatingHeaderBody, "space-y-1.5")}>
          <div
            className={cn(
              "grid min-w-0 gap-1.5",
              scanAction ? "grid-cols-[minmax(0,1fr)_40px]" : "grid-cols-1",
            )}
          >
            <div
              className={cn(repairOs.searchBar, "h-10 rounded-xl px-2 shadow-none")}
              aria-busy={searchBusy}
            >
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <Input
                value={searchValue}
                disabled={interactionDisabled}
                onChange={(event) => onSearchChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  onSearchSubmit();
                }}
                placeholder="搜索订单、客户、手机"
                aria-label="搜索订单、客户或手机"
                className={cn(repairOs.searchInput, "h-9 text-base")}
              />
              {searchBusy ? (
                <LoaderCircle
                  className="size-3.5 shrink-0 animate-spin text-primary"
                  aria-hidden="true"
                />
              ) : null}
              {searchValue ? (
                <button
                  type="button"
                  disabled={interactionDisabled}
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  onClick={onSearchClear}
                  aria-label="清除搜索"
                  title="清除搜索"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
            {scanAction}
          </div>

          {viewModeControl}

          <div
            className={cn("grid min-w-0", orderMobileQueueGrid)}
            role="group"
            aria-label="待处理状态"
          >
            {groups.map((group) => {
              const active = groupValue === group.key;
              const pending = pendingGroupValue === group.key;
              const Icon = groupIcons[group.key] ?? ListTodo;

              return (
                <button
                  key={group.key}
                  type="button"
                  disabled={interactionDisabled}
                  onClick={() => onGroupChange(group.key)}
                  className={cn(
                    "grid h-10 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-[8px] border px-2 py-1 text-left transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    group.key === "all" && orderMobileQueueAllSpan,
                    groupToneClass(group.tone, active),
                  )}
                  aria-pressed={active}
                  aria-busy={pending}
                  aria-label={`${group.label} ${group.count} 条`}
                >
                  <span className="flex min-w-0 items-center gap-1 text-[9px] font-semibold leading-none">
                    <Icon className="size-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{group.label}</span>
                  </span>
                  {pending ? (
                    <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <span className="font-mono text-[9px] font-semibold leading-none tabular-nums opacity-80">
                      {group.count > 999 ? "999+" : group.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <span
            className="sr-only"
            role={searchValue || pendingLabel ? undefined : "status"}
            aria-live={searchValue || pendingLabel ? "off" : "polite"}
          >
            当前显示 {activeGroup?.label ?? "全部待办"}，共 {activeGroup?.count ?? totalOrders} 条
          </span>
        </div>
      </section>
    </div>
  );
}
