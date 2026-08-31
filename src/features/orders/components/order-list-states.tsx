"use client";

import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { brandGradientStyle, repairOs, stateBlocks } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

export function EmptyOrdersState({
  hasActiveFilters,
  searchQuery,
  onClearFilters,
}: {
  hasActiveFilters: boolean;
  searchQuery?: string;
  onClearFilters: () => void;
}) {
  const { t } = useLocale();
  const normalizedSearch = searchQuery?.trim();

  return (
    <motion.div
      data-ui="order-list-empty-state"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(repairOs.listStateCard, "max-w-xl")}
    >
      <div className={stateBlocks.emptyIcon} style={brandGradientStyle}>
        <Search className="size-5 sm:size-7" />
      </div>
      <h3 className="font-display text-base font-semibold sm:text-lg">
        {normalizedSearch
          ? t("orders.noSearchResults", { query: normalizedSearch })
          : hasActiveFilters
            ? t("orders.noFilteredResults")
            : t("orders.noOrders")}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
        {normalizedSearch
          ? t("orders.searchHelp")
          : hasActiveFilters
            ? t("orders.filterHelp")
            : t("orders.emptyHelp")}
      </p>
      {hasActiveFilters && (
        <Button variant="outline" size="sm" className="mt-3 h-8" onClick={onClearFilters}>
          {normalizedSearch ? t("orders.clearSearchAndFilters") : t("orders.clearAllFilters")}
        </Button>
      )}
    </motion.div>
  );
}

export function OrdersErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useLocale();
  return (
    <div
      data-ui="order-list-error-state"
      role="alert"
      className={cn(
        repairOs.listStateCard,
        "max-w-xl border-status-danger-foreground/25 bg-status-danger/10",
      )}
    >
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-status-danger/15 text-status-danger-foreground">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="font-display text-lg font-semibold">{t("orders.loadFailed")}</h3>
      <p className="mt-1 max-w-md break-words text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" className="mt-3 h-8 gap-1.5" onClick={onRetry}>
        <RefreshCw className="size-3.5" /> {t("orders.retry")}
      </Button>
    </div>
  );
}

export function PaginationBar({
  page,
  pageCount,
  pageSize,
  total,
  visible,
  onPageChange,
  pageSizeOptions = [20, 50],
  onPageSizeChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  visible: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
}) {
  const { t } = useLocale();
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, (page - 1) * pageSize + visible);

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border/60 bg-surface/70 px-3 py-2 text-xs text-muted-foreground sm:mt-6 sm:flex-row sm:items-center sm:justify-between">
      <span>{t("orders.showingRange", { start, end, total })}</span>
      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange ? (
          <label className="flex min-h-9 items-center gap-1.5">
            <span>{t("orders.perPage")}</span>
            <select
              value={pageSize}
              className="h-9 rounded-lg border border-input bg-background px-2 text-base text-foreground"
              aria-label={t("orders.perPageLabel")}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {t("orders.itemsCount", { count: option })}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          {t("orders.previousPage")}
        </Button>
        <span className="min-w-16 text-center tabular-nums">
          {page} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          disabled={page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        >
          {t("orders.nextPage")}
        </Button>
      </div>
    </div>
  );
}
