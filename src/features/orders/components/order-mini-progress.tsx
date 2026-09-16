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
 * The shared rail shows the actual current stage and next task. Terminal
 * orders use an unfilled rail rather than implying every repair step happened.
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
  const knownStage = orderTaskStages.some((stage) =>
    (stage.workflowStatuses as readonly OrderWorkflowStatusCode[]).includes(workflowStatus),
  );
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
      className={cn("min-w-0", className)}
    >
      <div className="grid grid-cols-5 gap-1">
        {orderTaskStages.map((stage, index) => {
          const active = knownStage && !isTerminal && index <= currentIndex;
          const current = knownStage && !isTerminal && index === currentIndex;
          return (
            <span
              key={stage.key}
              data-order-mini-progress-segment={index}
              aria-hidden="true"
              className={cn(
                "h-1.5 min-w-0 rounded-full",
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
      <div
        aria-hidden="true"
        className="mt-1 flex min-w-0 flex-wrap items-center justify-between gap-x-2 text-[10px] leading-4"
      >
        <span
          data-order-progress-current="true"
          className={cn(
            "font-medium",
            danger ? "text-status-danger-foreground" : "text-foreground",
          )}
        >
          {label}
        </span>
        {!isTerminal && nextAction ? (
          <span data-order-progress-next="true" className="text-muted-foreground">
            → {nextAction}
          </span>
        ) : null}
      </div>
    </div>
  );
}
