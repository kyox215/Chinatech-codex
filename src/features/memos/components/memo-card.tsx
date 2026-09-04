import { CalendarClock, Check, NotebookPen, UserRound } from "lucide-react";

import type { MemoListItem } from "@/features/memos/model/contracts";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { getMemoPresentationCopy, translateMemoPresentation } from "@/shared/i18n/messages";

import { formatMemoDate, MemoStatus } from "./memo-status";

export function MemoCard({
  memo,
  busy,
  onOpen,
  onTransition,
}: {
  memo: MemoListItem;
  busy?: boolean;
  onOpen: () => void;
  onTransition: () => void;
}) {
  const { locale } = useLocale();
  const copy = getMemoPresentationCopy(locale);
  const completed = memo.kind === "todo" && memo.todo_status === "completed";
  const overdue =
    memo.kind === "todo" &&
    memo.todo_status === "pending" &&
    Boolean(memo.due_at && new Date(memo.due_at).getTime() < Date.now());

  return (
    <article className="group grid min-w-0 grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-1.5 border-b border-border/45 px-2 py-1.5 last:border-b-0 sm:px-3 sm:py-2">
      {memo.kind === "todo" ? (
        memo.capabilities.canTransition ? (
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={translateMemoPresentation(
              locale,
              completed ? "reopenTodoAria" : "completeTodoAria",
              { title: memo.title },
            )}
            aria-pressed={completed}
            disabled={busy}
            onClick={onTransition}
          >
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full border-2 transition-colors",
                completed
                  ? "border-status-success-foreground/40 bg-status-success text-status-success-foreground"
                  : overdue
                    ? "border-status-danger-foreground/55 text-status-danger-foreground"
                    : "border-primary/45 text-primary",
              )}
              aria-hidden="true"
            >
              {completed ? <Check className="size-3.5" strokeWidth={3} /> : null}
            </span>
          </button>
        ) : (
          <span
            className="grid size-8 place-items-center"
            aria-label={completed ? copy.completedTodoAria : copy.pendingTodoAria}
          >
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full border-2",
                completed
                  ? "border-status-success-foreground/40 bg-status-success text-status-success-foreground"
                  : overdue
                    ? "border-status-danger-foreground/55"
                    : "border-primary/45",
              )}
              aria-hidden="true"
            >
              {completed ? <Check className="size-3.5" strokeWidth={3} /> : null}
            </span>
          </span>
        )
      ) : (
        <span className="grid size-8 place-items-center" aria-label={copy.normalNoteAria}>
          <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
            <NotebookPen className="size-4" aria-hidden="true" />
          </span>
        </span>
      )}

      <button
        type="button"
        className="min-h-8 min-w-0 rounded-lg py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={translateMemoPresentation(locale, "openMemoAria", { title: memo.title })}
        onClick={onOpen}
      >
        <span
          className={cn(
            "block line-clamp-2 text-sm font-semibold leading-5 sm:truncate",
            completed && "text-muted-foreground line-through decoration-border",
          )}
        >
          {memo.title}
        </span>
        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
          <span className="flex min-w-0 items-center gap-1">
            <UserRound className="size-3 shrink-0" aria-hidden="true" />
            <span className="max-w-32 truncate">{memo.assignee_name ?? copy.unassigned}</span>
          </span>
          {memo.kind === "todo" ? (
            <span
              className={cn(
                "flex items-center gap-1 whitespace-nowrap",
                overdue && "font-medium text-status-danger-foreground",
              )}
            >
              <CalendarClock className="size-3 shrink-0" aria-hidden="true" />
              {memo.due_at ? formatMemoDate(memo.due_at, locale) : copy.noDue}
            </span>
          ) : (
            <span className="truncate">
              {translateMemoPresentation(locale, "recordedBy", {
                name: memo.created_by_name_snapshot,
              })}
            </span>
          )}
          <span className="whitespace-nowrap">
            {translateMemoPresentation(locale, "updatedAt", {
              date: formatMemoDate(memo.updated_at, locale),
            })}
          </span>
        </span>
      </button>

      <MemoStatus memo={memo} className="mt-1 border-transparent bg-transparent px-0" />
    </article>
  );
}
