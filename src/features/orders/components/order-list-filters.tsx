"use client";

import type { Dispatch, SetStateAction } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { indicatorSpring } from "@/lib/motion";
import { brandGradientStyle, repairOs } from "@/lib/ui-patterns";
import type { OrderListFilters, RepairDeskOptions } from "@/lib/repairdesk/api";
import { repairOrderType, type RepairOrderStatus, type StatusTone } from "@/lib/mock/enums";
import { orderExceptionMeta } from "@/features/orders/model/canonical-order-status";
import { simpleOrderFlowStages } from "@/features/orders/model/order-simple-flow";
import type { OrderListStatusTab } from "@/features/orders/model/order-workflow";
import type { OrderWorkflowStatusCode } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";

export function FiltersPanel({
  filters,
  setFilters,
  options,
  statuses,
  onClose,
  onStatusFilterChange,
}: {
  filters: OrderListFilters;
  setFilters: Dispatch<SetStateAction<OrderListFilters>>;
  options: RepairDeskOptions;
  statuses: { code: RepairOrderStatus; label: string }[];
  onClose?: () => void;
  onStatusFilterChange?: () => void;
}) {
  const toggle = <K extends keyof OrderListFilters>(key: K, value: string) => {
    const arr = (filters[key] as string[] | undefined) ?? [];
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    setFilters({ ...filters, [key]: next });
    if (key === "statuses") onStatusFilterChange?.();
  };
  const toggleWorkflowStage = (workflowStatuses: readonly OrderWorkflowStatusCode[]) => {
    const current = filters.workflowStatuses ?? [];
    const active = workflowStatuses.every((status) => current.includes(status));
    const next = active
      ? current.filter((status) => !workflowStatuses.includes(status))
      : Array.from(new Set<OrderWorkflowStatusCode>([...current, ...workflowStatuses]));
    setFilters({ ...filters, workflowStatuses: next.length ? next : undefined });
    onStatusFilterChange?.();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="min-h-0 flex-1 overscroll-contain">
        <div className="space-y-5 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5">
          <FilterGroup label="主流程">
            <div className="grid grid-cols-2 gap-2">
              {simpleOrderFlowStages.map((stage) => {
                const active = stage.workflowStatuses.every((status) =>
                  filters.workflowStatuses?.includes(status),
                );
                return (
                  <button
                    key={stage.key}
                    type="button"
                    onClick={() => toggleWorkflowStage(stage.workflowStatuses)}
                    className={cn(
                      filterChipClass,
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-surface hover:bg-accent",
                    )}
                  >
                    {stage.label}
                  </button>
                );
              })}
            </div>
          </FilterGroup>

          <FilterGroup label="异常">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(orderExceptionMeta).map(([status, meta]) => {
                const active = filters.exceptionStatuses?.includes(status as never);
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggle("exceptionStatuses", status)}
                    className={cn(
                      filterChipClass,
                      active
                        ? "border-status-danger-foreground/40 bg-status-danger/15 text-status-danger-foreground"
                        : "bg-surface hover:bg-accent",
                    )}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </FilterGroup>

          <FilterGroup label="工单状态">
            <div className="grid grid-cols-3 gap-2">
              {statuses.map((status) => {
                const active = filters.statuses?.includes(status.code);
                return (
                  <button
                    key={status.code}
                    type="button"
                    onClick={() => toggle("statuses", status.code)}
                    className={cn(
                      filterChipClass,
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-surface hover:bg-accent",
                    )}
                  >
                    {status.label}
                  </button>
                );
              })}
            </div>
          </FilterGroup>

          <FilterGroup label="工单类型">
            <div className="grid grid-cols-2 gap-2">
              {repairOrderType.map((t) => {
                const active = filters.types?.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggle("types", t)}
                    className={cn(
                      filterChipClass,
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-surface hover:bg-accent",
                    )}
                  >
                    {t === "quick_repair" ? "快修" : "送修"}
                  </button>
                );
              })}
            </div>
          </FilterGroup>

          <FilterGroup label="付款状态">
            <div className="grid grid-cols-3 gap-2">
              {(["all", "paid", "unpaid"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFilters({ ...filters, paid: p })}
                  className={cn(
                    filterChipClass,
                    (filters.paid ?? "all") === p
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-surface hover:bg-accent",
                  )}
                >
                  {p === "all" ? "全部" : p === "paid" ? "已结清" : "未结清"}
                </button>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label="技师">
            <div className="space-y-2">
              {options.technicians.map((t) => (
                <label
                  key={t}
                  className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--border-panel)] bg-card px-3 py-2 text-sm hover:bg-accent"
                >
                  <Checkbox
                    className="size-5 rounded-md"
                    checked={filters.technicians?.includes(t) ?? false}
                    onCheckedChange={() => toggle("technicians", t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label="外修供应商">
            <div className="space-y-2">
              {options.suppliers.map((s) => (
                <label
                  key={s.id}
                  className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--border-panel)] bg-card px-3 py-2 text-sm hover:bg-accent"
                >
                  <Checkbox
                    className="size-5 rounded-md"
                    checked={filters.supplierIds?.includes(s.id) ?? false}
                    onCheckedChange={() => toggle("supplierIds", s.id)}
                  />
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: s.color }}
                  />
                  <span className="min-w-0 truncate">{s.short_name}</span>
                </label>
              ))}
            </div>
          </FilterGroup>
        </div>
      </ScrollArea>
      {onClose && (
        <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-2 border-t bg-[var(--surface-workspace-strong)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button
            variant="outline"
            className="h-11 px-5"
            onClick={() => {
              setFilters({ search: filters.search });
              onStatusFilterChange?.();
            }}
          >
            重置
          </Button>
          <Button className="h-11 w-full" onClick={onClose}>
            应用筛选
          </Button>
        </div>
      )}
    </div>
  );
}

const filterChipClass =
  "min-h-10 rounded-lg border px-2.5 py-2 text-center text-xs font-medium leading-tight transition-colors";

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

export function OrderStatusFilterControls({
  groups,
  subTabs,
  groupValue,
  statusValue,
  onGroupChange,
  onStatusChange,
}: {
  groups: {
    key: string;
    label: string;
    shortLabel?: string;
    count: number;
    hint?: string;
    tone?: StatusTone;
  }[];
  subTabs: OrderListStatusTab[];
  groupValue: string;
  statusValue: string;
  onGroupChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}) {
  const showSubTabs = groupValue !== "all" && subTabs.length > 1;
  const activeGroup = groups.find((group) => group.key === groupValue);

  return (
    <div data-order-desktop-flow-filter="true" className={cn(repairOs.mobileInfoCard, "p-2")}>
      <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <ListChecks className="size-3" />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-semibold leading-4">阶段队列</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {groupValue === "all"
                ? "先选阶段，再处理下一步"
                : `当前：${activeGroup?.label ?? groupValue} · ${activeGroup?.count ?? 0} 条`}
            </div>
          </div>
        </div>
        <span className="hidden text-[10px] text-muted-foreground sm:inline">处理视图</span>
      </div>

      <div
        data-order-desktop-flow-rail="true"
        className="hidden min-w-0 gap-1 sm:grid sm:grid-cols-3 lg:grid-cols-6"
      >
        {groups.map((group, index) => {
          const active = groupValue === group.key;
          const isAll = group.key === "all";
          const tone = group.tone ?? "neutral";
          return (
            <button
              key={group.key}
              type="button"
              aria-pressed={active}
              onClick={() => onGroupChange(group.key)}
              className={cn(
                "relative grid min-h-8 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 overflow-hidden rounded-md border px-2 py-1 text-left transition-all",
                active
                  ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                  : "border-border/50 bg-surface/65 text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="orders-flow-stage-card"
                  className="absolute inset-y-1 left-0 w-0.5 rounded-full"
                  style={brandGradientStyle}
                  transition={indicatorSpring}
                />
              )}
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-xs font-semibold">{group.label}</span>
                  <span
                    className={cn(
                      "grid size-3.5 shrink-0 place-items-center rounded-full text-[8px] font-semibold tabular-nums",
                      active
                        ? "bg-primary text-primary-foreground"
                        : tone === "success"
                          ? "bg-status-success text-status-success-foreground"
                          : tone === "warn"
                            ? "bg-status-warn text-status-warn-foreground"
                            : tone === "progress"
                              ? "bg-status-progress text-status-progress-foreground"
                              : "bg-surface-muted",
                    )}
                  >
                    {isAll ? "全" : index}
                  </span>
                </div>
              </div>
              <span className="shrink-0 font-mono text-xs font-semibold leading-none tabular-nums text-foreground">
                {group.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 snap-x gap-1.5 overflow-x-auto pb-1 sm:hidden">
        {groups.map((group) => {
          const active = groupValue === group.key;
          return (
            <button
              key={group.key}
              type="button"
              aria-pressed={active}
              onClick={() => onGroupChange(group.key)}
              className={cn(
                "inline-flex h-9 shrink-0 snap-start items-center gap-2 rounded-full border px-2.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-[var(--border-panel)] bg-card text-muted-foreground shadow-[var(--shadow-card)]",
              )}
            >
              <span>{group.label}</span>
              <span
                className={cn(
                  "font-mono text-[10px] font-semibold leading-none tabular-nums",
                  active
                    ? "border-l border-primary-foreground/35 pl-2 text-primary-foreground"
                    : "rounded-full bg-surface-muted px-1.5 py-0.5 text-foreground",
                )}
              >
                {group.count}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {showSubTabs && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-1.5 hidden min-w-0 flex-wrap items-center gap-1 sm:flex"
          >
            {subTabs.map((status) => {
              const active = statusValue === status.key;
              return (
                <button
                  key={status.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onStatusChange(status.key)}
                  className={cn(
                    "relative h-6 min-w-0 rounded-md border px-2 text-[11px] font-medium transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/50 bg-surface/70 text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {status.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
