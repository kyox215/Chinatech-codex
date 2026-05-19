import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function SectionHeading({ title, className }: { title: string; className?: string }) {
  return (
    <h2 className={cn("mb-3 text-sm font-semibold text-muted-foreground", className)}>{title}</h2>
  );
}

export function FormItem({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-muted-foreground">
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
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-lg tabular-nums",
          strong && "font-display text-2xl font-semibold text-foreground",
        )}
      >
        {formatMoney(value)}
      </span>
    </div>
  );
}
