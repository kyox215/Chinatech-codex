"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

export function OrderDataAction({
  icon: Icon,
  title,
  disabled,
  onClick,
}: {
  icon: typeof Download;
  title: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-9 justify-start gap-2 px-3"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="size-4" />
      {title}
    </Button>
  );
}

export function OrderDataSummaryValue({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/30 px-3 py-2">
      <p className="text-[11px] text-muted-foreground lg:text-xs lg:leading-4">{label}</p>
      <p
        className={
          danger
            ? "text-base font-semibold text-status-danger-foreground"
            : "text-base font-semibold text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}
