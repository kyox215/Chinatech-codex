import { CalendarClock, Check, NotebookPen, UserRound } from "lucide-react";

import type { MemoListItem } from "@/features/memos/model/contracts";
import { cn } from "@/lib/utils";

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
  const completed = memo.kind === "todo" && memo.todo_status === "completed";
  const overdue =
    memo.kind === "todo" &&
    memo.todo_status === "pending" &&
    Boolean(memo.due_at && new Date(memo.due_at).getTime() < Date.now());

  return (
    <article className="group grid min-w-0 grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-2 border-b border-border/45 px-2 py-2.5 last:border-b-0 sm:px-3">
      {memo.kind === "todo" ? (
        memo.capabilities.canTransition ? (
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`${completed ? "重新打开" : "完成"}待办：${memo.title}`}
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
            className="grid size-11 place-items-center"
            aria-label={completed ? "已完成待办" : "待处理待办"}
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
        <span className="grid size-11 place-items-center" aria-label="普通记录">
          <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
            <NotebookPen className="size-4" aria-hidden="true" />
          </span>
        </span>
      )}

      <button
        type="button"
        className="min-h-11 min-w-0 rounded-lg py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`打开备忘：${memo.title}`}
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
        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] leading-4 text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1">
            <UserRound className="size-3 shrink-0" aria-hidden="true" />
            <span className="max-w-32 truncate">{memo.assignee_name ?? "未分配"}</span>
          </span>
          {memo.kind === "todo" ? (
            <span
              className={cn(
                "flex items-center gap-1 whitespace-nowrap",
                overdue && "font-medium text-status-danger-foreground",
              )}
            >
              <CalendarClock className="size-3 shrink-0" aria-hidden="true" />
              {memo.due_at ? formatMemoDate(memo.due_at) : "无到期时间"}
            </span>
          ) : (
            <span className="truncate">由 {memo.created_by_name_snapshot} 记录</span>
          )}
          <span className="whitespace-nowrap">更新 {formatMemoDate(memo.updated_at)}</span>
        </span>
      </button>

      <MemoStatus memo={memo} className="mt-1 border-transparent bg-transparent px-0" />
    </article>
  );
}
