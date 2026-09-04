import { Archive, CheckCircle2, Circle, NotebookPen } from "lucide-react";

import type { MemoListItem } from "@/features/memos/model/contracts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { getMemoPresentationCopy } from "@/shared/i18n/messages";
import { APP_TIME_ZONE, type AppLocale } from "@/shared/i18n/locales";

export function MemoStatus({ memo, className }: { memo: MemoListItem; className?: string }) {
  const { locale } = useLocale();
  const copy = getMemoPresentationCopy(locale);
  const archived = Boolean(memo.archived_at);
  const completed = memo.todo_status === "completed";
  const overdue =
    memo.todo_status === "pending" && memo.due_at && new Date(memo.due_at).getTime() < Date.now();
  const Icon = archived
    ? Archive
    : memo.kind === "note"
      ? NotebookPen
      : completed
        ? CheckCircle2
        : Circle;
  const label = archived
    ? copy.statusArchived
    : memo.kind === "note"
      ? copy.statusNote
      : completed
        ? copy.statusCompleted
        : overdue
          ? copy.statusOverdue
          : copy.statusPending;
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 gap-1 rounded-md px-1.5 text-[10px]",
        completed && "border-status-success-foreground/30 text-status-success-foreground",
        overdue && "border-status-danger-foreground/30 text-status-danger-foreground",
        !completed && !overdue && !archived && "border-primary/25 text-primary",
        archived && "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}

export function formatMemoDate(value?: string | null, locale: AppLocale = "zh-CN") {
  if (!value) return getMemoPresentationCopy(locale).dateUnavailable;
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return getMemoPresentationCopy(locale).dateUnavailable;
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
}
