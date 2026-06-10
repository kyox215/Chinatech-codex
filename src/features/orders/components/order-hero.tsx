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
    <div className="glass-card mb-6 px-5 py-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {showBackLink && (
          <>
            <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-1.5 text-xs">
              <Link href="/orders">
                <ArrowLeft className="size-3.5" /> 返回列表
              </Link>
            </Button>
            <span className="opacity-50">/</span>
          </>
        )}
        <span>工单详情</span>
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-2xl font-semibold tracking-tight gradient-text md:text-3xl">
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
          <div className="mt-1 truncate text-sm text-muted-foreground">
            {deviceLabel} · {customerName ?? order.customer_name} · 技师 {order.technician_name}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              总报价
            </div>
            <MoneyText
              amount={order.quotation_amount}
              className="font-display text-xl font-semibold"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max items-center gap-2 md:min-w-0 md:flex-wrap">
          {next.primary && (
            <Button
              size="sm"
              disabled={transitionPending}
              onClick={() => onTransition(next.primary!.to)}
              className="h-8 gap-1.5 border-0 text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              推进至「{next.primary.label}」
            </Button>
          )}
          {next.secondary.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 gap-1.5">
                  其他流转 <ChevronDown className="size-3.5" />
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
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onNotify}>
            <Bell className="size-3.5" /> 通知客户
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            disabled={order.is_paid || order.balance_amount <= 0}
            onClick={onPay}
          >
            <CreditCard className="size-3.5" /> 收款
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onPrint}>
            <Printer className="size-3.5" /> 打印受理单
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5">
            <Package className="size-3.5" /> 转库存
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 size-8 p-0">
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
