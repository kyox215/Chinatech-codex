import type { HTMLAttributes, ReactNode } from "react";

import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const infoTileFrameClass = {
  soft: "min-w-0 rounded-xl bg-[var(--surface-panel-muted)] px-2 py-1.5",
  bordered:
    "min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2 py-1.5",
  plain: "min-w-0",
} as const;

export interface InventoryInfoTileProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  frame?: keyof typeof infoTileFrameClass;
  bodyClassName?: string;
  leadingClassName?: string;
  trailingClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  metaClassName?: string;
}

export function InventoryInfoTile({
  label,
  value,
  meta,
  leading,
  trailing,
  frame = "soft",
  className,
  bodyClassName,
  leadingClassName,
  trailingClassName,
  labelClassName,
  valueClassName,
  metaClassName,
  ...props
}: InventoryInfoTileProps) {
  const hasSlots = Boolean(leading || trailing);
  return (
    <div
      className={cn(
        infoTileFrameClass[frame],
        hasSlots && "flex items-center justify-between gap-2",
        className,
      )}
      {...props}
    >
      {leading ? <div className={cn("shrink-0", leadingClassName)}>{leading}</div> : null}
      <div className={cn("min-w-0", bodyClassName)}>
        <div className={cn("truncate text-[10px] leading-3 text-muted-foreground", labelClassName)}>
          {label}
        </div>
        <div className={cn("mt-0.5 min-w-0 break-words text-xs leading-4", valueClassName)}>
          {value}
        </div>
        {meta ? (
          <div
            className={cn(
              "mt-0.5 truncate text-[10px] leading-3 text-muted-foreground",
              metaClassName,
            )}
          >
            {meta}
          </div>
        ) : null}
      </div>
      {trailing ? <div className={cn("shrink-0", trailingClassName)}>{trailing}</div> : null}
    </div>
  );
}

export function InventoryStatusBadge({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { children: ReactNode }) {
  return (
    <span className={cn(repairOs.badge, className)} {...props}>
      {children}
    </span>
  );
}
