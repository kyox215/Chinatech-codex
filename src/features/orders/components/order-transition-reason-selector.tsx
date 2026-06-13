"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getOrderTransitionReasonConfig,
  type OrderTransitionReasonPreset,
} from "@/features/orders/model/order-transition-reasons";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import { cn } from "@/lib/utils";

export function OrderTransitionReasonSelector({
  target,
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  target: RepairOrderStatus;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const config = getOrderTransitionReasonConfig(target);
  const selectedPreset = useMemo(
    () => config?.presets.find((preset) => preset.reason === value.trim()),
    [config?.presets, value],
  );

  if (!config) {
    return (
      <Textarea
        rows={compact ? 3 : 4}
        placeholder="补充说明（可选）"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <div className="min-w-0 space-y-2">
      <div className="min-w-0">
        <p className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>{config.title}</p>
        <p className={cn("mt-0.5 text-muted-foreground", compact ? "text-[10px]" : "text-xs")}>
          {config.description}
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2">
        {config.presets.map((preset) => (
          <ReasonPresetButton
            key={preset.id}
            preset={preset}
            selected={selectedPreset?.id === preset.id}
            disabled={disabled}
            compact={compact}
            onSelect={() => onChange(preset.reason)}
          />
        ))}
      </div>

      <label className="block min-w-0 space-y-1">
        <span
          className={cn("font-medium text-muted-foreground", compact ? "text-[10px]" : "text-xs")}
        >
          处理说明{config.required ? "（必填）" : "（可选）"}
        </span>
        <Textarea
          rows={compact ? 3 : 4}
          placeholder="也可以直接编辑成更准确的说明"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={cn("resize-none", compact && "min-h-20 text-xs")}
        />
      </label>
    </div>
  );
}

function ReasonPresetButton({
  preset,
  selected,
  disabled,
  compact,
  onSelect,
}: {
  preset: OrderTransitionReasonPreset;
  selected: boolean;
  disabled: boolean;
  compact: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "min-w-0 rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60",
        compact ? "px-2 py-1.5" : "px-2.5 py-2",
        selected
          ? "border-primary/45 bg-primary/10 text-primary"
          : "border-[var(--border-panel)] bg-[var(--surface-panel)] hover:bg-accent/35",
      )}
    >
      <span className={cn("block truncate font-semibold", compact ? "text-[11px]" : "text-xs")}>
        {preset.label}
      </span>
      <span
        className={cn(
          "mt-0.5 block line-clamp-2 text-muted-foreground",
          compact ? "text-[10px] leading-3" : "text-[11px] leading-4",
        )}
      >
        {preset.description}
      </span>
    </button>
  );
}
