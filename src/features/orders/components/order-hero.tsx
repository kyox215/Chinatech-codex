"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  CreditCard,
  MoreHorizontal,
  Package,
  Printer,
  Wrench,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { MoneyText, OrderTypeBadge, StatusBadge } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { OrderDetail } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";

type NextAction = {
  primary?: { to: RepairOrderStatus; label: string };
  secondary: { to: RepairOrderStatus; label: string }[];
};

export function OrderHero({
  order,
  customerName,
  deviceLabel,
  next,
  transitionPending,
  onTransition,
  onNotify,
  onPay,
  onPrint,
  onCancel,
  showBackLink = true,
}: {
  order: OrderDetail["order"];
  customerName?: string;
  deviceLabel: string;
  next: NextAction;
  transitionPending: boolean;
  onTransition: (to: RepairOrderStatus) => void;
  onNotify: () => void;
  onPay: () => void;
  onPrint: () => void;
  onCancel: () => void;
  showBackLink?: boolean;
}) {
  return (
    <div className="glass-card mb-2 min-w-0 overflow-hidden px-2 py-2 sm:mb-4 sm:px-4 sm:py-4">
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground sm:flex-wrap sm:text-xs">
        {showBackLink && (
          <>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-[11px] sm:h-7 sm:text-xs"
            >
              <Link href="/orders">
                <ArrowLeft className="size-3.5" /> 返回列表
              </Link>
            </Button>
            <span className="opacity-50">/</span>
          </>
        )}
        <span>工单详情</span>
      </div>
      <div className="mt-1 grid min-w-0 gap-1.5 sm:mt-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span
              className="min-w-0 max-w-full truncate font-display text-lg font-semibold leading-tight tracking-tight gradient-text sm:text-2xl md:text-3xl"
              title={order.public_no}
            >
              {order.public_no}
            </span>
            <StatusBadge status={order.status} />
            <OrderTypeBadge type={order.order_type} />
            {order.original_order_id && (
              <Link
                href={`/orders/${order.original_order_id}`}
                className="inline-flex items-center gap-1 rounded border bg-status-warn px-1.5 py-0.5 text-xs text-status-warn-foreground hover:underline"
              >
                <Wrench className="size-3" /> 返修来源
              </Link>
            )}
          </div>
          <div className="mt-0.5 min-w-0 truncate text-[11px] text-muted-foreground sm:mt-1 sm:text-sm">
            {deviceLabel} · {customerName ?? order.customer_name} · 技师 {order.technician_name}
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:hidden">
          <HeroMoneyCell label="总价" amount={order.quotation_amount} strong />
          <HeroMoneyCell label="定金" amount={order.deposit_amount} />
          <HeroMoneyCell label="待付" amount={order.balance_amount} strong />
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex sm:justify-end">
          <div className="rounded-lg border border-border/60 bg-surface-muted/25 px-2 py-1 text-left sm:border-0 sm:bg-transparent sm:p-0 sm:text-right">
            <div className="text-[10px] font-medium text-muted-foreground/70 sm:uppercase sm:tracking-widest">
              总报价
            </div>
            <MoneyText
              amount={order.quotation_amount}
              className="font-display text-lg font-semibold leading-tight sm:text-xl"
            />
          </div>
        </div>
      </div>

      <div className="mt-2 sm:mt-3">
        <div className="grid min-w-0 grid-cols-4 gap-1.5 sm:hidden">
          {next.primary && (
            <Button
              size="sm"
              disabled={transitionPending}
              onClick={() => onTransition(next.primary!.to)}
              className="col-span-2 h-7 gap-1 border-0 px-1.5 text-[11px] text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              推进「{next.primary.label}」
            </Button>
          )}
          {next.secondary.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 gap-1 px-1.5 text-[11px]">
                  流转
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>选择目标状态</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {next.secondary.map((action) => (
                  <DropdownMenuItem
                    key={action.to}
                    onClick={() => {
                      if (action.to === "cancelled") onCancel();
                      else onTransition(action.to);
                    }}
                  >
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-1.5 text-[11px]"
            onClick={onNotify}
          >
            <Bell className="size-3.5" />
            通知
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-1.5 text-[11px]"
            disabled={order.is_paid || order.balance_amount <= 0}
            onClick={onPay}
          >
            <CreditCard className="size-3.5" /> 收款
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-1.5 text-[11px]"
            onClick={onPrint}
          >
            <Printer className="size-3.5" />
            打印
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1 px-1.5 text-[11px]">
            <Package className="size-3.5" />
            库存
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-1.5 text-[11px]"
                aria-label="更多工单操作"
              >
                <MoreHorizontal className="size-4" />
                更多
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(window.location.href)
                    .then(() => toast.success("链接已复制"));
                }}
              >
                复制链接
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onCancel}
              >
                <XCircle className="mr-2 size-3.5" /> 取消工单
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="hidden min-w-0 flex-wrap items-center gap-1.5 sm:flex">
          {next.primary && (
            <Button
              size="sm"
              disabled={transitionPending}
              onClick={() => onTransition(next.primary!.to)}
              className="h-7 gap-1.5 border-0 px-2 text-xs text-white sm:h-8"
              style={{ background: "var(--gradient-brand)" }}
            >
              <span className="sm:hidden">推进「{next.primary.label}」</span>
              <span className="hidden sm:inline">推进至「{next.primary.label}」</span>
            </Button>
          )}
          {next.secondary.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2 text-xs sm:h-8">
                  <span className="sm:hidden">流转</span>
                  <span className="hidden sm:inline">其他流转</span>
                  <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>选择目标状态</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {next.secondary.map((action) => (
                  <DropdownMenuItem
                    key={action.to}
                    onClick={() => {
                      if (action.to === "cancelled") onCancel();
                      else onTransition(action.to);
                    }}
                  >
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2 text-xs sm:h-8"
            onClick={onNotify}
          >
            <Bell className="size-3.5" />
            <span className="sm:hidden">通知</span>
            <span className="hidden sm:inline">通知客户</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2 text-xs sm:h-8"
            disabled={order.is_paid || order.balance_amount <= 0}
            onClick={onPay}
          >
            <CreditCard className="size-3.5" /> 收款
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2 text-xs sm:h-8"
            onClick={onPrint}
          >
            <Printer className="size-3.5" />
            <span className="sm:hidden">打印</span>
            <span className="hidden sm:inline">打印受理单</span>
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2 text-xs sm:h-8">
            <Package className="size-3.5" />
            <span className="sm:hidden">库存</span>
            <span className="hidden sm:inline">转库存</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="size-7 p-0 sm:size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(window.location.href)
                    .then(() => toast.success("链接已复制"));
                }}
              >
                复制链接
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onCancel}
              >
                <XCircle className="mr-2 size-3.5" /> 取消工单
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

function HeroMoneyCell({
  label,
  amount,
  strong,
}: {
  label: string;
  amount: number;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border/60 bg-surface-muted/25 px-2 py-1">
      <div className="text-[10px] font-medium leading-none text-muted-foreground">{label}</div>
      <MoneyText
        amount={amount}
        className={cn(
          "mt-0.5 block truncate font-mono text-[13px] leading-tight",
          strong && "font-semibold text-foreground",
        )}
      />
    </div>
  );
}
