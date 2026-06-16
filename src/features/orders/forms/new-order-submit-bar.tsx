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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-background/80 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-1.5 backdrop-blur-xl md:pointer-events-auto md:sticky md:-mx-5 md:mt-4 md:px-0 md:pb-0 md:pt-0 lg:-mx-6">
      <div className="pointer-events-auto mx-auto grid max-w-[430px] min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-[var(--border-panel)] bg-card px-2 py-2 shadow-[var(--shadow-card)] md:flex md:max-w-none md:justify-between md:gap-2 md:rounded-none md:border-x-0 md:border-b-0 md:px-5 md:py-2 lg:px-6">
        {onCancel ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="hidden h-8 gap-1.5 rounded-xl text-xs md:inline-flex"
            onClick={onCancel}
          >
            <ArrowLeft className="size-3.5" /> 返回工单
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="hidden h-8 gap-1.5 rounded-xl text-xs md:inline-flex"
            asChild
          >
            <Link href="/orders">
              <ArrowLeft className="size-3.5" /> 返回工单
            </Link>
          </Button>
        )}
        <div className="contents md:flex md:min-w-0 md:items-center md:gap-2">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] items-center gap-2 rounded-lg border border-[var(--border-panel)] bg-background/65 px-2 py-1.5 md:flex-none md:gap-3">
            <SummaryMetric label="合计" value={formatMoney(total)} strong />
            <span className="h-6 w-px bg-[var(--border-panel)]" />
            <SummaryMetric label="定金" value={formatMoney(deposit)} />
          </div>
          <Button
            type="submit"
            disabled={!valid || pending}
            className="h-10 shrink-0 gap-1.5 rounded-xl border-0 px-4 text-xs font-semibold text-primary-foreground md:w-auto md:text-sm"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Banknote className="size-3.5" />
            {pending ? "创建中…" : "创建工单"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-[10px] font-medium leading-3 text-muted-foreground">
        {label}
      </span>
      <span
        className={
          strong
            ? "block truncate font-mono text-base font-semibold leading-5 text-foreground"
            : "block truncate font-mono text-xs leading-5 text-muted-foreground"
        }
      >
        {value}
      </span>
    </span>
  );
}
