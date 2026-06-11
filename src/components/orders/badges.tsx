import { cn } from "@/lib/utils";
import {
  approvalMeta,
  getStatusMeta,
  orderTypeMeta,
  type ApprovalStatus,
  type RepairOrderStatus,
  type RepairOrderType,
  type StatusTone,
} from "@/lib/mock/enums";
import { formatMoney } from "@/lib/money";

type Tone = "neutral" | "info" | "progress" | "warn" | "success" | "danger";

const toneClass: Record<Tone, string> = {
  neutral: "bg-status-neutral text-status-neutral-foreground ring-status-neutral-foreground/20",
  info: "bg-status-info text-status-info-foreground ring-status-info-foreground/30",
  progress: "bg-status-progress text-status-progress-foreground ring-status-progress-foreground/30",
  warn: "bg-status-warn text-status-warn-foreground ring-status-warn-foreground/30",
  success: "bg-status-success text-status-success-foreground ring-status-success-foreground/30",
  danger: "bg-status-danger text-status-danger-foreground ring-status-danger-foreground/30",
};

const dotClass: Record<Tone, string> = {
  neutral: "bg-status-neutral-foreground/70",
  info: "bg-status-info-foreground",
  progress: "bg-status-progress-foreground",
  warn: "bg-status-warn-foreground",
  success: "bg-status-success-foreground",
  danger: "bg-status-danger-foreground",
};

const livePulse: Tone[] = ["progress", "warn"];

function Pill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  const live = livePulse.includes(tone);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium leading-none ring-1 ring-inset",
        toneClass[tone],
        className,
      )}
    >
      <span className="relative inline-flex size-1.5">
        {live && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              dotClass[tone],
            )}
          />
        )}
        <span className={cn("relative inline-flex size-1.5 rounded-full", dotClass[tone])} />
      </span>
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
  label,
  tone,
  className,
}: {
  status: RepairOrderStatus;
  label?: string;
  tone?: StatusTone;
  className?: string;
}) {
  const m = getStatusMeta(status);
  return (
    <Pill tone={tone ?? m.tone} className={className}>
      {label ?? m.label}
    </Pill>
  );
}

export function OrderTypeBadge({ type, className }: { type: RepairOrderType; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-border/60 bg-surface-muted px-1.5 py-0.5 text-xs leading-none text-muted-foreground",
        className,
      )}
    >
      {orderTypeMeta[type].label}
    </span>
  );
}

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const m = approvalMeta[status];
  return <Pill tone={m.tone}>{m.label}</Pill>;
}

export function MoneyText({ amount, className }: { amount: number; className?: string }) {
  return <span className={cn("font-mono tabular-nums", className)}>{formatMoney(amount)}</span>;
}

export function PhoneText({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("font-mono text-xs tabular-nums text-muted-foreground", className)}>
      {value}
    </span>
  );
}
