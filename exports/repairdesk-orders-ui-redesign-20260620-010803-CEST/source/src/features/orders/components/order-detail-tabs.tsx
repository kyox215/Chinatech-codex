"use client";

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
}: {
  tabs: readonly OrderDetailTab<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
}) {
  return (
    <div
      data-order-detail-tabs="true"
      className="relative z-10 mb-3 mt-1.5 min-w-0 max-w-full sm:mb-3 sm:mt-2"
    >
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel)] p-0.5 shadow-[var(--shadow-card)] backdrop-blur sm:flex-wrap sm:p-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={cn(
                "relative shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-xs",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="order-tab-indicator"
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
