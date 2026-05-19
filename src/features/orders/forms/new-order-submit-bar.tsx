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
}: {
  total: number;
  deposit: number;
  valid: boolean;
  pending: boolean;
}) {
  return (
    <div className="sticky bottom-0 -mx-3 mt-5 flex flex-col-reverse gap-3 border-t bg-background/90 px-3 py-3 backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <Button variant="ghost" type="button" className="gap-1.5" asChild>
        <Link href="/orders">
          <ArrowLeft className="size-4" /> 返回工单
        </Link>
      </Button>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="text-sm text-muted-foreground">
          合计{" "}
          <span className="font-display text-lg font-semibold text-foreground">
            {formatMoney(total)}
          </span>
          <span className="ml-2">定金 {formatMoney(deposit)}</span>
        </div>
        <Button type="submit" disabled={!valid || pending} className="gap-1.5">
          <Banknote className="size-4" />
          {pending ? "创建中…" : "创建维修订单"}
        </Button>
      </div>
    </div>
  );
}
