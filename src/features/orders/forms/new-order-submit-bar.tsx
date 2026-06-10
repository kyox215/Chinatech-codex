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
    <div className="sticky bottom-0 -mx-2 mt-3 flex min-w-0 flex-col-reverse gap-1.5 border-t bg-background/95 px-2 py-1.5 backdrop-blur sm:-mx-5 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-5 sm:py-2 lg:-mx-6 lg:px-6">
      {onCancel ? (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="h-8 gap-1.5 text-xs"
          onClick={onCancel}
        >
          <ArrowLeft className="size-3.5" /> 返回工单
        </Button>
      ) : (
        <Button variant="ghost" size="sm" type="button" className="h-8 gap-1.5 text-xs" asChild>
          <Link href="/orders">
            <ArrowLeft className="size-3.5" /> 返回工单
          </Link>
        </Button>
      )}
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 truncate text-xs text-muted-foreground">
          合计{" "}
          <span className="font-display text-sm font-semibold text-foreground sm:text-base">
            {formatMoney(total)}
          </span>
          <span className="ml-2">定金 {formatMoney(deposit)}</span>
        </div>
        <Button
          type="submit"
          disabled={!valid || pending}
          className="h-8 w-full gap-1.5 text-xs sm:h-9 sm:w-auto sm:text-sm"
        >
          <Banknote className="size-3.5" />
          {pending ? "创建中…" : "创建维修订单"}
        </Button>
      </div>
    </div>
  );
}
