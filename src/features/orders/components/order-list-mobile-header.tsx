"use client";

import type { Dispatch, ReactNode, Ref, SetStateAction } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  CheckCircle2,
  Filter,
  ListTodo,
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { brandGradientStyle, repairOs } from "@/lib/ui-patterns";
import type { OrderListFilters, RepairDeskOptions } from "@/lib/repairdesk/api";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { StatusTone } from "@/lib/mock/enums";
import { FiltersPanel } from "@/features/orders/components/order-list-filters";
import { RealtimeSyncIndicator } from "@/features/realtime";
import { cn } from "@/lib/utils";

type ActiveFilterChip = {
  key: string;
  label: string;
};

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
  filters,
  setFilters,
  totalOrders,
  activeFilterChips,
  mobileFiltersOpen,
  setMobileFiltersOpen,
  options,
  statuses,
  workflowIsError,
  workflowErrorMessage,
  onGroupChange,
  onStatusFilterChange,
  onClearAllFilters,
  onCreateOrder,
  scanAction,
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
  filters: OrderListFilters;
  setFilters: Dispatch<SetStateAction<OrderListFilters>>;
  totalOrders: number;
  activeFilterChips: ActiveFilterChip[];
  mobileFiltersOpen: boolean;
  setMobileFiltersOpen: (open: boolean) => void;
  options: RepairDeskOptions;
  statuses: { code: RepairOrderStatus; label: string }[];
  workflowIsError: boolean;
  workflowErrorMessage: string;
  onGroupChange: (value: string) => void;
  onStatusFilterChange: () => void;
  onClearAllFilters: () => void;
  onCreateOrder: () => void;
  scanAction?: ReactNode;
  viewModeControl?: ReactNode;
  headerRef?: Ref<HTMLDivElement>;
}) {
  const activeGroup = groups.find((group) => group.key === groupValue);
  const activeFilterCount = activeFilterChips.length;

  return (
    <div ref={headerRef} className={repairOs.mobileListHeaderShell}>
      <section className={repairOs.mobileFloatingHeaderCard}>
        <header className={repairOs.mobileFloatingHeaderNav}>
          <SidebarTrigger className="size-10 rounded-xl border border-[var(--border-panel)] bg-card shadow-none" />
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-semibold leading-5">订单管理</p>
            <p className="flex items-center justify-center gap-1 truncate text-[9px] leading-3 text-muted-foreground">
              <span className="truncate">
                {activeGroup?.label ?? "全部"} · 共 {totalOrders} 条
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
              scanAction ? "grid-cols-[minmax(0,1fr)_40px_40px]" : "grid-cols-[minmax(0,1fr)_40px]",
            )}
          >
            <div className={cn(repairOs.searchBar, "h-10 rounded-xl px-2 shadow-none")}>
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <Input
                value={filters.search ?? ""}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value || undefined,
                  }))
                }
                placeholder="搜索订单、客户、手机"
                className={cn(repairOs.searchInput, "h-9 text-base")}
              />
            </div>
            {scanAction}

            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="relative size-10 rounded-xl bg-card"
                  aria-label="筛选订单"
                >
                  <Filter className="size-3.5" />
                  {activeFilterCount > 0 ? (
                    <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[9px] font-semibold leading-4 text-primary-foreground">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="h-[100svh] max-h-[100svh] w-full max-w-sm p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>筛选</SheetTitle>
                </SheetHeader>
                <FiltersPanel
                  filters={filters}
                  setFilters={setFilters}
                  options={options}
                  statuses={statuses}
                  onClose={() => setMobileFiltersOpen(false)}
                  onStatusFilterChange={onStatusFilterChange}
                />
              </SheetContent>
            </Sheet>
          </div>

          {viewModeControl}

          <div className="grid min-w-0 grid-cols-2 gap-1" role="group" aria-label="待处理状态">
            {groups.map((group) => {
              const active = groupValue === group.key;
              const Icon = groupIcons[group.key] ?? ListTodo;

              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => onGroupChange(group.key)}
                  className={cn(
                    "grid h-10 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-[8px] border px-2 py-1 text-left transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    group.key === "all" && "col-span-2",
                    groupToneClass(group.tone, active),
                  )}
                  aria-pressed={active}
                  aria-label={`${group.label} ${group.count} 条`}
                >
                  <span className="flex min-w-0 items-center gap-1 text-[9px] font-semibold leading-none">
                    <Icon className="size-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{group.label}</span>
                  </span>
                  <span className="font-mono text-[9px] font-semibold leading-none tabular-nums opacity-80">
                    {group.count > 999 ? "999+" : group.count}
                  </span>
                </button>
              );
            })}
          </div>

          <span className="sr-only" role="status" aria-live="polite">
            当前显示 {activeGroup?.label ?? "全部待办"}，共 {activeGroup?.count ?? totalOrders} 条
          </span>

          {activeFilterChips.length > 0 ? (
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-1 pb-0.5">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="flex h-6 min-w-0 items-center gap-1 rounded-full border border-[var(--border-panel)] bg-surface-muted px-2 text-left text-[10px] font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label={`查看当前 ${activeFilterCount} 项筛选`}
              >
                <Filter className="size-2.5 shrink-0" />
                <span className="truncate">{activeFilterChips[0]?.label}</span>
                {activeFilterCount > 1 ? (
                  <span className="shrink-0 font-mono text-primary">+{activeFilterCount - 1}</span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={onClearAllFilters}
                className="grid size-6 shrink-0 place-items-center rounded-full text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label="清除全部筛选"
                title="清除全部筛选"
              >
                <X className="size-3" />
              </button>
            </div>
          ) : null}

          {workflowIsError ? (
            <div className="flex min-w-0 items-center gap-1 rounded-md border border-status-warn-foreground/25 bg-status-warn/10 px-2 py-1 text-[10px] text-status-warn-foreground">
              <AlertTriangle className="size-3 shrink-0" />
              <span className="min-w-0 truncate">状态流未加载：{workflowErrorMessage}</span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
