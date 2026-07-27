import { CalendarClock, UserRound } from "lucide-react";

import type { MemoListItem } from "@/features/memos/model/contracts";
import { Button } from "@/components/ui/button";
import { RepairOsBusinessCard } from "@/shared/ui";

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
  return (
    <RepairOsBusinessCard className="min-w-0 p-2.5">
      <div className="flex min-w-0 items-start gap-2">
        <button
          type="button"
          className="min-h-11 min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onOpen}
        >
          <span className="flex items-center gap-1.5">
            <MemoStatus memo={memo} />
            <span className="truncate text-[11px] text-muted-foreground">
              {memo.created_by_name_snapshot}
            </span>
          </span>
          <span className="mt-1 block truncate text-sm font-semibold leading-5">{memo.title}</span>
          <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
            打开查看正文
          </span>
        </button>
        {memo.capabilities.canTransition ? (
          <Button
            type="button"
            variant={memo.todo_status === "completed" ? "outline" : "default"}
            size="sm"
            className="min-h-11 shrink-0 px-2 text-[11px]"
            disabled={busy}
            onClick={onTransition}
          >
            {memo.todo_status === "completed" ? "重开" : "完成"}
          </Button>
        ) : null}
      </div>
      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/50 pt-1.5 text-[10px] text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1">
          <UserRound className="size-3" />
          <span className="truncate">{memo.assignee_name ?? "未分配"}</span>
        </span>
        {memo.kind === "todo" ? (
          <span className="flex items-center gap-1">
            <CalendarClock className="size-3" />
            {memo.due_at ? formatMemoDate(memo.due_at) : "无到期时间"}
          </span>
        ) : null}
        <span className="ml-auto">更新 {formatMemoDate(memo.updated_at)}</span>
      </div>
    </RepairOsBusinessCard>
  );
}
