import { CalendarClock, Check, ChevronDown, NotebookPen, UserRound } from "lucide-react";

import type { MemoChecklistItem, MemoListItem, StoreMemo } from "@/features/memos/model/contracts";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { getMemoPresentationCopy, translateMemoPresentation } from "@/shared/i18n/messages";

import { formatMemoDate, MemoStatus } from "./memo-status";
import { MemoChecklistInline } from "./memo-checklist-inline";
import { MemoChecklistProgress } from "./memo-checklist-controls";

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
  const hasChecklist = memo.kind === "todo" && memo.checklist_total > 0;
  const overdue =
    memo.kind === "todo" &&
    memo.todo_status === "pending" &&
    Boolean(memo.due_at && new Date(memo.due_at).getTime() < Date.now());
  const completionMark = (
    <span
      className={cn(
        "grid size-5 place-items-center rounded-full border-2 transition-colors duration-150 motion-reduce:transition-none",
        completed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/60",
      )}
      aria-hidden="true"
    >
      {completed ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
    </span>
  );

  return (
    <article className="min-w-0 py-2.5 sm:py-3" data-memo-id={memo.id}>
      <div className="flex min-w-0 items-start gap-2">
        {!hasChecklist ? (
          memo.kind === "todo" ? (
            memo.capabilities.canTransition ? (
              <button
                type="button"
                className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full outline-none transition-colors duration-150 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                aria-label={translateMemoPresentation(
                  locale,
                  completed ? "reopenTodoAria" : "completeTodoAria",
                  { title: memo.title },
                )}
                aria-pressed={completed}
                disabled={busy}
                onClick={onTransition}
              >
                {completionMark}
              </button>
            ) : (
              <span
                className="-ml-2 grid size-11 shrink-0 place-items-center"
                aria-label={completed ? copy.completedTodoAria : copy.pendingTodoAria}
              >
                {completionMark}
              </span>
            )
          ) : (
            <span
              className="-ml-2 grid size-11 shrink-0 place-items-center text-muted-foreground"
              aria-label={copy.normalNoteAria}
            >
              <NotebookPen className="size-5" aria-hidden="true" />
            </span>
          )
        ) : null}
        <button
          type="button"
          className="min-h-10 min-w-0 flex-1 rounded-md py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={translateMemoPresentation(locale, "openMemoAria", { title: memo.title })}
          onClick={onOpen}
        >
          <span
            className={cn(
              "block break-words text-base font-semibold leading-5 [overflow-wrap:anywhere]",
              completed && "text-muted-foreground line-through decoration-muted-foreground/40",
            )}
          >
            {memo.title}
          </span>
          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] leading-4 text-muted-foreground">
            {memo.assignee_name ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="max-w-40 truncate">{memo.assignee_name}</span>
              </span>
            ) : null}
            {memo.kind === "todo" ? (
              memo.due_at ? (
                <span
                  className={cn(
                    "flex items-center gap-1.5",
                    overdue && "font-medium text-status-danger-foreground",
                  )}
                >
                  <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
                  {formatMemoDate(memo.due_at, locale)}
                </span>
              ) : null
            ) : (
              <span>
                {translateMemoPresentation(locale, "recordedBy", {
                  name: memo.created_by_name_snapshot,
                })}
              </span>
            )}
            <span>
              {translateMemoPresentation(locale, "updatedAt", {
                date: formatMemoDate(memo.updated_at, locale),
              })}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {hasChecklist ? (
            <button
              type="button"
              className="-mr-2 grid size-11 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
              aria-label={translateMemoPresentation(locale, "checklistProgressAria", {
                completed: memo.checklist_completed,
                total: memo.checklist_total,
              })}
              aria-expanded={Boolean(expanded)}
              onClick={onExpand}
            >
              <ChevronDown
                className={cn(
                  "size-4 -rotate-90 transition-transform duration-150 motion-reduce:transition-none",
                  expanded && "rotate-0",
                )}
                aria-hidden="true"
              />
            </button>
          ) : null}
          {!hasChecklist || overdue || memo.archived_at ? (
            <MemoStatus
              memo={memo}
              className="mt-1 border-transparent bg-transparent px-0 text-[11px]"
            />
          ) : null}
        </div>
      </div>
      {hasChecklist ? (
        <MemoChecklistProgress
          completed={memo.checklist_completed}
          total={memo.checklist_total}
          className="mt-1.5"
        />
      ) : null}
      {expanded && hasChecklist && onToggleChecklistItem ? (
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
    </article>
  );
}
