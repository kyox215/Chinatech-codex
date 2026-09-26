import { CalendarClock, Check, ListChecks, NotebookPen, UserRound } from "lucide-react";

import type { MemoChecklistItem, MemoListItem, StoreMemo } from "@/features/memos/model/contracts";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { getMemoPresentationCopy, translateMemoPresentation } from "@/shared/i18n/messages";

import { formatMemoDate, MemoStatus } from "./memo-status";
import { MemoChecklistInline } from "./memo-checklist-inline";

export function MemoCard({
  memo,
  busy,
  expanded,
  detail,
  detailLoading,
  detailError,
  search,
  onOpen,
  onExpand,
  onRetryDetail,
  onToggleChecklistItem,
  onTransition,
}: {
  memo: MemoListItem;
  busy?: boolean;
  expanded?: boolean;
  detail?: StoreMemo;
  detailLoading?: boolean;
  detailError?: boolean;
  search?: string;
  onOpen: () => void;
  onExpand?: () => void;
  onRetryDetail?: () => void;
  onToggleChecklistItem?: (item: MemoChecklistItem, completed: boolean) => Promise<void>;
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
    <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border-panel)] bg-card shadow-[var(--shadow-card)]">
      <article className="group grid min-w-0 grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-1.5 px-2.5 py-2 sm:gap-2 sm:px-3 sm:py-2.5">
        {memo.kind === "todo" ? (
          memo.checklist_total > 0 ? (
            <button
              type="button"
              className="grid min-h-8 min-w-8 place-items-center rounded-lg px-1 font-mono text-[10px] font-semibold tabular-nums text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={translateMemoPresentation(locale, "checklistProgressAria", {
                completed: memo.checklist_completed,
                total: memo.checklist_total,
              })}
              aria-expanded={expanded}
              onClick={onExpand}
            >
              <ListChecks className="size-4" aria-hidden="true" />
              <span>
                {memo.checklist_completed}/{memo.checklist_total}
              </span>
            </button>
          ) : memo.capabilities.canTransition ? (
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
            {memo.assignee_name ? (
              <span className="flex min-w-0 items-center gap-1">
                <UserRound className="size-3 shrink-0" aria-hidden="true" />
                <span className="max-w-32 truncate">{memo.assignee_name}</span>
              </span>
            ) : null}
            {memo.kind === "todo" ? (
              memo.due_at ? (
                <span
                  className={cn(
                    "flex items-center gap-1 whitespace-nowrap",
                    overdue && "font-medium text-status-danger-foreground",
                  )}
                >
                  <CalendarClock className="size-3 shrink-0" aria-hidden="true" />
                  {formatMemoDate(memo.due_at, locale)}
                </span>
              ) : null
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
      {expanded && memo.checklist_total > 0 && onToggleChecklistItem ? (
        <MemoChecklistInline
          memo={detail}
          loading={detailLoading}
          error={detailError}
          busy={busy}
          search={search}
          onRetry={onRetryDetail ?? (() => undefined)}
          onToggle={onToggleChecklistItem}
        />
      ) : null}
    </div>
  );
}
