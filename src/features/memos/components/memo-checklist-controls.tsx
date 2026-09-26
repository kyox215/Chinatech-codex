import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { getMemoPresentationCopy, translateMemoPresentation } from "@/shared/i18n/messages";

/** Keep the semantic checkbox and its 44px target; only the visible mark is 22px. */
export const MemoCompletionCheckbox = forwardRef<
  ElementRef<typeof Checkbox>,
  ComponentPropsWithoutRef<typeof Checkbox>
>(({ className, ...props }, ref) => (
  <Checkbox
    ref={ref}
    className={cn(
      "relative size-11 rounded-full border-0 bg-transparent shadow-none transition-colors duration-150 hover:bg-muted/60 active:bg-muted focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=checked]:bg-transparent motion-reduce:transition-none",
      "before:absolute before:left-1/2 before:top-1/2 before:size-[22px] before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border-[1.5px] before:border-muted-foreground/60 before:transition-colors before:duration-150 data-[state=checked]:before:border-primary data-[state=checked]:before:bg-primary motion-reduce:before:transition-none",
      "[&>span]:relative [&>span]:z-10 [&_svg]:size-3.5 [&_svg]:stroke-[2.5]",
      className,
    )}
    {...props}
  />
));
MemoCompletionCheckbox.displayName = "MemoCompletionCheckbox";

export function MemoChecklistProgress({
  completed,
  total,
  className,
}: {
  completed: number;
  total: number;
  className?: string;
}) {
  const { locale } = useLocale();
  const copy = getMemoPresentationCopy(locale);
  if (!total) return null;
  const label = translateMemoPresentation(locale, "checklistProgressAria", { completed, total });

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
        aria-valuetext={label}
        className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
          style={{ width: `${(completed / total) * 100}%` }}
        />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {completed}/{total} <span>{copy.statusCompleted}</span>
      </span>
    </div>
  );
}
