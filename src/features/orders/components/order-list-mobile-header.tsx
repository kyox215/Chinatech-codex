"use client";

import type { Dispatch, Ref, SetStateAction } from "react";
import { AlertTriangle, Filter, Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { brandGradientStyle, repairOs } from "@/lib/ui-patterns";
import type { OrderListFilters, RepairDeskOptions } from "@/lib/repairdesk/api";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { OrderWorkflowStatusCode } from "@/lib/repairdesk/types";
import { orderWorkflowMeta } from "@/features/orders/model/canonical-order-status";
import { FiltersPanel } from "@/features/orders/components/order-list-filters";
import { cn } from "@/lib/utils";

type ActiveFilterChip = {
  key: string;
  label: string;
};

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
  onRemoveFilterChip,
  onClearAllFilters,
  onCreateOrder,
  headerRef,
}: {
  groups: { key: string; label: string; count: number; hint?: string }[];
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
  onRemoveFilterChip: (key: string) => void;
  onClearAllFilters: () => void;
  onCreateOrder: () => void;
  headerRef?: Ref<HTMLDivElement>;
}) {
  const activeGroup = groups.find((group) => group.key === groupValue);
  const activeFilterCount = activeFilterChips.length;

  return (
    <div ref={headerRef} className={repairOs.mobileListHeaderShell}>
      <section className={repairOs.mobileFloatingHeaderCard}>
        <header className={repairOs.mobileFloatingHeaderNav}>
          <SidebarTrigger className="size-7 rounded-lg border border-[var(--border-panel)] bg-card shadow-none" />
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-semibold leading-5">订单管理</p>
            <p className="truncate text-[9px] leading-3 text-muted-foreground">
              {activeGroup?.label ?? "全部"} · 共 {totalOrders} 条
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            className="size-7 rounded-lg border-0 text-primary-foreground shadow-[var(--shadow-action)]"
            style={brandGradientStyle}
            onClick={onCreateOrder}
            aria-label="新建工单"
          >
            <Plus className="size-4" />
          </Button>
        </header>

        <div className={cn(repairOs.mobileFloatingHeaderBody, "space-y-1.5")}>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_32px] gap-1.5">
            <div className={cn(repairOs.searchBar, "h-8 rounded-xl px-2 shadow-none")}>
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
                className={cn(repairOs.searchInput, "h-7 text-xs")}
              />
            </div>

            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="relative size-8 rounded-xl bg-card"
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
              <SheetContent side="right" className="w-full max-w-sm p-0">
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

          <div
            className="min-w-0 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            aria-label="流程分组"
          >
            <div className="relative grid min-w-[430px] grid-cols-8">
              <span
                aria-hidden
                className="absolute left-[calc(100%/16)] right-[calc(100%/16)] top-3 h-px bg-border"
              />
              {groups.map((group) => {
                const active = groupValue === group.key;
                const isAll = group.key === "all";
                const workflowKey = group.key as OrderWorkflowStatusCode;
                const shortLabel =
                  (isAll ? "全" : orderWorkflowMeta[workflowKey]?.shortLabel) ??
                  group.label.slice(0, 1);

                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => onGroupChange(group.key)}
                    className="relative z-10 grid min-w-0 justify-items-center gap-0.5 px-0.5 text-center"
                    aria-pressed={active}
                  >
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full border text-[11px] font-semibold leading-none transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground shadow-none"
                          : "border-border bg-surface-muted text-muted-foreground",
                      )}
                    >
                      {shortLabel}
                    </span>
                    <span
                      className={cn(
                        "flex max-w-full items-center justify-center gap-0.5 truncate text-[9px] leading-3",
                        active ? "font-semibold text-primary" : "text-muted-foreground",
                      )}
                    >
                      <span className="truncate">{group.label}</span>
                      <span
                        className={cn(
                          "font-mono text-[9px] tabular-nums",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {group.count}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {activeFilterChips.length > 0 ? (
            <div className="flex min-w-0 snap-x gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => onRemoveFilterChip(chip.key)}
                  className="inline-flex h-6 max-w-[180px] shrink-0 snap-start items-center gap-1 rounded-full border border-[var(--border-panel)] bg-surface-muted px-2 text-[10px] font-medium text-muted-foreground"
                  title="点击移除此筛选"
                >
                  <span className="truncate">{chip.label}</span>
                  <X className="size-2.5 shrink-0" />
                </button>
              ))}
              <button
                type="button"
                onClick={onClearAllFilters}
                className="h-6 shrink-0 rounded-full px-2 text-[10px] font-medium text-primary"
              >
                清除
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
