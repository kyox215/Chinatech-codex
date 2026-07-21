import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function OrderActionReview({
  currentLabel,
  targetLabel,
  impact,
  className,
}: {
  currentLabel: string;
  targetLabel: string;
  impact: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3",
        className,
      )}
      aria-labelledby="order-action-review-title"
    >
      <h3 id="order-action-review-title" className="text-xs font-semibold">
        操作影响
      </h3>
      <div className="mt-2 flex min-w-0 items-center gap-2 text-sm font-semibold">
        <span className="min-w-0 truncate">{currentLabel}</span>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 truncate text-primary">{targetLabel}</span>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{impact}</p>
    </section>
  );
}
