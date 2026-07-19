"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { motion } from "framer-motion";

import { indicatorSpring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type OrderDetailTab<T extends string = string> = {
  key: T;
  label: string;
};

export function OrderDetailTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  ariaLabel = "工单详情视图",
  idPrefix,
  className,
}: {
  tabs: readonly OrderDetailTab<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
  ariaLabel?: string;
  idPrefix?: string;
  className?: string;
}) {
  const generatedId = useId().replace(/:/g, "");
  const resolvedIdPrefix = idPrefix ?? `order-detail-tabs-${generatedId}`;
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    if (!nextTab) return;
    onChange(nextTab.key);
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      data-order-detail-tabs="true"
      className={cn("relative z-10 mb-3 mt-1.5 min-w-0 max-w-full sm:mb-3 sm:mt-2", className)}
    >
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel)] p-0.5 shadow-[var(--shadow-card)] backdrop-blur sm:flex-wrap sm:p-1"
      >
        {tabs.map((tab, index) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              ref={(node) => {
                buttonRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${resolvedIdPrefix}-tab-${tab.key}`}
              aria-selected={active}
              aria-controls={`${resolvedIdPrefix}-panel-${tab.key}`}
              tabIndex={active ? 0 : -1}
              data-order-detail-tab={tab.key}
              onClick={() => onChange(tab.key)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "relative shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-xs",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId={`${resolvedIdPrefix}-active-indicator`}
                  className="absolute inset-0 -z-10 rounded-md border border-primary/20 bg-primary/10"
                  transition={indicatorSpring}
                />
              )}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
