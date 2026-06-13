"use client";

import Link from "next/link";
import { ArrowLeft, Banknote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";

export function NewOrderSubmitBar({
  total,
  deposit,
  valid,
  pending,
  onCancel,
}: {
  total: number;
  deposit: number;
  valid: boolean;
  pending: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-30 -mx-2 mt-2 border-t border-[var(--border-panel)] bg-background/95 shadow-[0_-10px_30px_color-mix(in_oklch,var(--foreground)_10%,transparent)] backdrop-blur-xl sm:-mx-5 sm:mt-4 lg:-mx-6">
      <div className="mx-auto flex max-w-[430px] min-w-0 flex-col-reverse gap-1.5 px-2 py-1.5 sm:max-w-none sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-5 sm:py-2 lg:px-6">
        {onCancel ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="h-8 gap-1.5 rounded-xl text-xs"
            onClick={onCancel}
          >
            <ArrowLeft className="size-3.5" /> 返回工单
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="h-8 gap-1.5 rounded-xl text-xs"
            asChild
          >
            <Link href="/orders">
              <ArrowLeft className="size-3.5" /> 返回工单
            </Link>
          </Button>
        )}
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1 truncate rounded-lg border border-[var(--border-panel)] bg-card px-2 py-1 text-[10px] leading-3 text-muted-foreground shadow-[var(--shadow-card)] sm:flex-none sm:text-xs">
            合计{" "}
            <span className="font-mono text-xs font-semibold text-foreground sm:text-sm">
              {formatMoney(total)}
            </span>
            <span className="ml-1.5">定金 {formatMoney(deposit)}</span>
          </div>
          <Button
            type="submit"
            disabled={!valid || pending}
            className="h-9 shrink-0 gap-1.5 rounded-xl text-xs sm:w-auto sm:text-sm"
          >
            <Banknote className="size-3.5" />
            {pending ? "创建中…" : "创建工单"}
          </Button>
        </div>
      </div>
    </div>
  );
}
