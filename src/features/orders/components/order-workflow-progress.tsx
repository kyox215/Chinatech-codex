"use client";

import { motion } from "framer-motion";

import {
  getWorkflowProgressValue,
  orderTaskStages,
  type OrderTaskStage,
} from "@/features/orders/model/order-task-flow";
import type { StatusTone } from "@/lib/mock/enums";
import type { OrderWorkflowStatusCode } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";

const nodeToneClass: Record<StatusTone, { current: string; done: string; track: string }> = {
  neutral: {
    current: "border-muted-foreground bg-muted-foreground text-background",
    done: "bg-muted-foreground",
    track: "bg-muted-foreground",
  },
  info: {
    current: "border-primary bg-primary text-primary-foreground",
    done: "bg-primary",
    track: "bg-primary",
  },
  progress: {
    current: "border-status-progress-foreground bg-status-progress-foreground text-background",
    done: "bg-status-progress-foreground",
    track: "bg-status-progress-foreground",
  },
  warn: {
    current: "border-status-warn-foreground bg-status-warn-foreground text-background",
    done: "bg-status-warn-foreground",
    track: "bg-status-warn-foreground",
  },
  success: {
    current: "border-status-success-foreground bg-status-success-foreground text-background",
    done: "bg-status-success-foreground",
    track: "bg-status-success-foreground",
  },
  danger: {
    current: "border-status-danger-foreground bg-status-danger-foreground text-background",
    done: "bg-status-danger-foreground",
    track: "bg-status-danger-foreground",
  },
};

export function OrderWorkflowProgress({
  workflowStatus,
  tone,
  currentStage,
  compact = false,
  showLabels = false,
  className,
}: {
  workflowStatus: OrderWorkflowStatusCode;
  tone: StatusTone;
  currentStage?: OrderTaskStage;
  compact?: boolean;
  showLabels?: boolean;
  className?: string;
}) {
  const currentIndex = getWorkflowProgressValue(workflowStatus);
  const activeStage = currentStage ?? orderTaskStages[currentIndex];
  const toneClass = nodeToneClass[tone];
  const stageCount = orderTaskStages.length;
  const railOffset = `${100 / Math.max(1, stageCount * 2)}%`;
  const progressWidth = stageCount <= 1 ? "0%" : `${(currentIndex / (stageCount - 1)) * 100}%`;
  const stageGridStyle = { gridTemplateColumns: `repeat(${stageCount}, minmax(0, 1fr))` };

  return (
    <div
      className={cn("min-w-0", className)}
      data-order-workflow-progress="true"
      aria-label={`当前流程：${activeStage?.label ?? workflowStatus}`}
    >
      <div
        className={cn("relative grid min-w-0 items-center", compact ? "h-4" : "h-8")}
        style={stageGridStyle}
      >
        <span
          aria-hidden
          className="absolute top-1/2 h-0.5 -translate-y-1/2 overflow-hidden rounded-full bg-border/65"
          style={{ left: railOffset, right: railOffset }}
        >
          <span
            className={cn(
              "block h-full rounded-full transition-[width] duration-300 ease-out",
              toneClass.track,
            )}
            style={{ width: progressWidth }}
          />
        </span>
        {orderTaskStages.map((stage, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;
          const next = index === currentIndex + 1;
          const displayStage = current ? (activeStage ?? stage) : stage;

          return (
            <span key={stage.key} className="relative z-10 grid place-items-center">
              <span
                title={displayStage.label}
                className={cn(
                  "grid place-items-center rounded-full border transition-all duration-200",
                  current && "relative",
                  compact ? "size-2.5 text-[0px]" : "size-5 text-[10px] font-semibold",
                  current
                    ? cn("scale-110 shadow-sm", toneClass.current)
                    : done
                      ? cn("border-transparent", toneClass.done)
                      : next
                        ? "border-primary/45 bg-card text-primary"
                        : "border-border bg-card text-muted-foreground",
                )}
              >
                {current && (
                  <motion.span
                    aria-hidden
                    className={cn(
                      "absolute rounded-full",
                      compact ? "size-3.5" : "size-6",
                      toneClass.track,
                    )}
                    animate={{ opacity: [0.22, 0.06, 0.22], scale: [1, 1.45, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                <span className="relative">{compact ? "" : displayStage.shortLabel}</span>
              </span>
            </span>
          );
        })}
      </div>
      {showLabels && (
        <div
          className="mt-1 grid min-w-0 text-center text-[10px] leading-4 text-muted-foreground"
          style={stageGridStyle}
        >
          {orderTaskStages.map((stage, index) => {
            const displayStage = index === currentIndex ? (activeStage ?? stage) : stage;
            return (
              <span
                key={stage.key}
                className={cn(
                  "truncate",
                  index === currentIndex && "font-semibold text-foreground",
                  index < currentIndex && "text-primary",
                )}
              >
                {displayStage.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
