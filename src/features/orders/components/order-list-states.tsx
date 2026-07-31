"use client";

import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { brandGradientStyle, stateBlocks } from "@/lib/ui-patterns";

export function EmptyOrdersState({
  hasActiveFilters,
  searchQuery,
  onClearFilters,
}: {
  hasActiveFilters: boolean;
  searchQuery?: string;
  onClearFilters: () => void;
}) {
  const normalizedSearch = searchQuery?.trim();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mx-auto mt-16 flex max-w-sm flex-col items-center justify-center text-center"
    >
      <div className={stateBlocks.emptyIcon} style={brandGradientStyle}>
        <Search className="size-7" />
      </div>
      <h3 className="font-display text-lg font-semibold">
        {normalizedSearch
          ? `未找到“${normalizedSearch}”`
          : hasActiveFilters
            ? "暂无符合条件的工单"
            : "暂无工单"}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {normalizedSearch
          ? "可以检查订单号、姓名、电话号码或 IMEI，也可以清除条件后重试。"
          : hasActiveFilters
            ? "当前有筛选条件生效，可以清除后再查看。"
            : "新建第一张维修工单后会显示在这里。"}
      </p>
      {hasActiveFilters && (
        <Button variant="outline" size="sm" className="mt-3 h-8" onClick={onClearFilters}>
          {normalizedSearch ? "清除搜索和筛选" : "清除全部筛选"}
        </Button>
      )}
    </motion.div>
  );
}

export function OrdersErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto mt-6 flex max-w-lg flex-col items-center justify-center rounded-xl border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-3 text-center sm:mt-16 sm:px-4 sm:py-5">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-status-danger/15 text-status-danger-foreground">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="font-display text-lg font-semibold">工单加载失败</h3>
      <p className="mt-1 max-w-md break-words text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" className="mt-3 h-8 gap-1.5" onClick={onRetry}>
        <RefreshCw className="size-3.5" /> 重试
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
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, (page - 1) * pageSize + visible);

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border/60 bg-surface/70 px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        显示 {start}-{end} / {total}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange ? (
          <label className="flex min-h-11 items-center gap-1.5">
            <span>每页</span>
            <select
              value={pageSize}
              className="h-11 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
              aria-label="每页显示工单数量"
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option} 条
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          className="h-11"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          上一页
        </Button>
        <span className="min-w-16 text-center tabular-nums">
          {page} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-11"
          disabled={page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
