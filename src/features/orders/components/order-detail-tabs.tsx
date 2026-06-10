"use client";

import { motion } from "framer-motion";

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
    <div className="mb-2 min-w-0 max-w-full sm:mb-3">
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-lg border border-border/60 bg-surface/60 p-0.5 backdrop-blur sm:flex-wrap sm:p-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={cn(
                "relative shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-xs",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="order-tab-indicator"
                  className="absolute inset-0 -z-10 rounded-md"
                  style={{
                    background:
                      "linear-gradient(120deg, oklch(0.7 0.2 285 / 0.25), oklch(0.78 0.16 200 / 0.18))",
                    boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.08)",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
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
