"use client";

import { useId, useRef, type KeyboardEvent } from "react";

import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export type CustomerDetailTab<T extends string = string> = {
  key: T;
  label: string;
  count?: number;
};

export function CustomerDetailTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  idPrefix,
  panelIdPrefix,
  className,
}: {
  tabs: readonly CustomerDetailTab<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
  idPrefix?: string;
  panelIdPrefix?: string;
  className?: string;
}) {
  const generatedId = useId();
  const prefix = idPrefix ?? `customer-tabs-${generatedId.replace(/:/g, "")}`;
  const controlsPrefix = panelIdPrefix ?? prefix;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    onChange(tabs[nextIndex].key);
    refs.current[nextIndex]?.focus();
  };

  return (
    <div
      className={cn("mb-2 grid w-full min-w-0 grid-cols-5 gap-1", className)}
      role="tablist"
      aria-label="客户详情分组"
    >
      {tabs.map((item, index) => (
        <button
          key={item.key}
          ref={(node) => {
            refs.current[index] = node;
          }}
          id={`${prefix}-tab-${item.key}`}
          type="button"
          role="tab"
          aria-selected={activeTab === item.key}
          aria-controls={`${controlsPrefix}-panel-${item.key}`}
          tabIndex={activeTab === item.key ? 0 : -1}
          onKeyDown={(event) => onKeyDown(event, index)}
          onClick={() => onChange(item.key)}
          className={cn(
            repairOs.chip,
            "h-9 min-w-0 justify-center gap-1 px-1 text-[11px] sm:px-2 sm:text-xs",
            activeTab === item.key && repairOs.chipActive,
          )}
        >
          <span className="truncate">{item.label}</span>
          {item.count !== undefined ? (
            <span
              className={cn(
                "hidden shrink-0 rounded-full px-1 py-0.5 font-mono text-[9px] leading-none tabular-nums min-[390px]:inline",
                activeTab === item.key
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-[var(--surface-panel-muted)] text-muted-foreground",
              )}
            >
              {item.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
