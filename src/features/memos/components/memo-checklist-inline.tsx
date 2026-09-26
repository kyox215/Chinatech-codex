"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { MemoChecklistItem, StoreMemo } from "@/features/memos/model/contracts";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { getMemoPresentationCopy, translateMemoPresentation } from "@/shared/i18n/messages";

export function MemoChecklistInline({
  memo,
  loading,
  error,
  busy,
  search,
  onRetry,
  onToggle,
}: {
  memo?: StoreMemo;
  loading?: boolean;
  error?: boolean;
  busy?: boolean;
  search?: string;
  onRetry: () => void;
  onToggle: (item: MemoChecklistItem, completed: boolean) => Promise<void>;
}) {
  const { locale } = useLocale();
  const copy = getMemoPresentationCopy(locale);
  const [completedOpen, setCompletedOpen] = useState(false);
  const pending = memo?.checklist.filter((item) => !item.completed) ?? [];
  const completed = memo?.checklist.filter((item) => item.completed) ?? [];
  const normalizedSearch = search?.trim().toLocaleLowerCase() ?? "";
  const matchedCompleted = completed.some((item) =>
    item.text.toLocaleLowerCase().includes(normalizedSearch),
  );

  useEffect(() => {
    if (normalizedSearch && matchedCompleted) setCompletedOpen(true);
  }, [matchedCompleted, normalizedSearch]);

  if (loading && !memo) {
    return (
      <div className="flex min-h-14 items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {copy.detailLoadingTitle}
      </div>
    );
  }

  if (error && !memo) {
    return (
      <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
        <p className="text-xs text-destructive">{copy.operationFailed}</p>
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onRetry}>
          {copy.retry}
        </Button>
      </div>
    );
  }

  if (!memo) return null;

  const row = (item: MemoChecklistItem) => (
    <label
      key={item.id}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-accent/60",
        busy && "cursor-wait opacity-65",
      )}
    >
      <Checkbox
        checked={item.completed}
        disabled={busy || !memo.capabilities.canTransition}
        className="size-5"
        aria-label={translateMemoPresentation(locale, "checklistToggleAria", { item: item.text })}
        onCheckedChange={(checked) => void onToggle(item, checked === true).catch(() => undefined)}
      />
      <span
        className={cn(
          "min-w-0 flex-1 break-words leading-5",
          item.completed && "text-muted-foreground line-through",
        )}
      >
        {item.text}
      </span>
    </label>
  );

  return (
    <div className="border-t border-border/45 bg-muted/20 px-2 py-2 sm:px-3">
      {pending.length ? <div className="space-y-0.5">{pending.map(row)}</div> : null}
      {completed.length ? (
        <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full justify-between px-2 text-xs"
            >
              {translateMemoPresentation(locale, "completedChecklistItems", {
                count: completed.length,
              })}
              <ChevronDown
                className={cn("size-4 transition-transform", completedOpen && "rotate-180")}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-0.5">{completed.map(row)}</CollapsibleContent>
        </Collapsible>
      ) : null}
      {!pending.length && !completed.length ? (
        <p className="px-2 py-3 text-xs text-muted-foreground">{copy.checklist}</p>
      ) : null}
    </div>
  );
}
