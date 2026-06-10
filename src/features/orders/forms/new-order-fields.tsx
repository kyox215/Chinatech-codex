import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function SectionHeading({ title, className }: { title: string; className?: string }) {
  return (
    <h2 className={cn("mb-1.5 text-xs font-semibold text-muted-foreground", className)}>{title}</h2>
  );
}

export function FormItem({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <Label className="text-[11px] text-muted-foreground sm:text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

export function MoneyRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-border/60 bg-surface-muted/20 px-2 py-1.5">
      <span className="truncate text-[11px] font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          strong && "font-display text-base font-semibold text-foreground",
        )}
      >
        {formatMoney(value)}
      </span>
    </div>
  );
}
