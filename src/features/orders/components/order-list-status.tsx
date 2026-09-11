"use client";

import { StatusBadge } from "@/components/orders/badges";
import { OrderMiniProgress } from "./order-mini-progress";
import type { OrderListItem, OrderWorkflow } from "@/lib/repairdesk/types";
import { getOrderListPresentation } from "../model/order-list-presentation";
import { useLocale } from "@/shared/i18n/locale-provider";
import { cn } from "@/lib/utils";

export interface OrderListStatusProps {
  order: OrderListItem;
  workflow?: OrderWorkflow;
  showProgress?: boolean;
  showDetail?: boolean;
  className?: string;
}

/** Composes existing status and progress primitives from one list-only presentation. */
export function OrderListStatus({
  order,
  workflow,
  showProgress = true,
  showDetail = true,
  className,
}: OrderListStatusProps) {
  const { t } = useLocale();
  const presentation = getOrderListPresentation(order, t, workflow);
  return (
    <div
      className={cn("min-w-0", className)}
      data-order-current-status={presentation.workflowStatus}
    >
      <StatusBadge
        status={order.status}
        label={presentation.label}
        tone={presentation.tone}
        className="max-w-full whitespace-normal text-[11px] leading-4 [&>span]:shrink-0"
      />
      {showDetail ? (
        <p
          className={cn(
            "mt-1 text-[11px] leading-4 break-words text-muted-foreground",
            presentation.danger && "text-status-danger-foreground",
          )}
          data-order-status-context="true"
        >
          {presentation.detail}
        </p>
      ) : null}
      {showProgress ? (
        <OrderMiniProgress
          workflowStatus={presentation.workflowStatus}
          currentLabel={`${presentation.label} · ${presentation.detail}`}
          nextAction={presentation.nextAction}
          danger={presentation.danger}
          isTerminal={presentation.terminal}
          className="mt-2"
        />
      ) : null}
    </div>
  );
}
