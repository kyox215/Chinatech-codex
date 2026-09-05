"use client";

import { useLocale } from "@/shared/i18n/locale-provider";
import { getWorkflowProgressValue, orderTaskStages } from "@/features/orders/model/order-task-flow";
import { localizeOrderFlowStage } from "@/features/orders/model/order-i18n";
import type { OrderWorkflowStatusCode } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";

export interface OrderMiniProgressProps {
  workflowStatus: OrderWorkflowStatusCode;
  currentLabel?: string;
  nextAction?: string;
  danger?: boolean;
  isTerminal?: boolean;
  className?: string;
}

/**
 * The compact order progress primitive intentionally renders only the five
 * segment rail. Callers can keep their own visible labels beside it while the
 * accessible name carries the current and terminal state.
 */
export function OrderMiniProgress({
  workflowStatus,
  currentLabel,
  nextAction,
  danger = false,
  isTerminal = false,
  className,
}: OrderMiniProgressProps) {
  const { t } = useLocale();
  const currentIndex = Math.max(
    0,
    Math.min(getWorkflowProgressValue(workflowStatus), orderTaskStages.length - 1),
  );
  const currentStage = orderTaskStages[currentIndex];
  const localizedStage = currentStage ? localizeOrderFlowStage(currentStage, t) : undefined;
  const label = currentLabel || localizedStage?.label || workflowStatus;
  const accessibleStatus = isTerminal
    ? t("orders.workflowTerminalAria", { current: label })
    : t("orders.workflowAria", {
        current: label,
        next: nextAction || localizedStage?.nextAction || "",
      });

  return (
    <div
      data-order-mini-progress="true"
      role="img"
      aria-label={accessibleStatus}
      className={cn("grid min-w-0 grid-cols-5 gap-0.5", className)}
    >
      {orderTaskStages.map((stage, index) => {
        const active = index <= currentIndex;
        const current = index === currentIndex;
        return (
          <span
            key={stage.key}
            data-order-mini-progress-segment={index}
            aria-hidden="true"
            className={cn(
              "h-1 min-w-0 rounded-full",
              current
                ? danger
                  ? "bg-status-danger-foreground"
                  : "bg-primary"
                : active
                  ? "bg-primary/45"
                  : "bg-border",
            )}
          />
        );
      })}
    </div>
  );
}
