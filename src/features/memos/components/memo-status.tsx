import { Archive, CheckCircle2, Circle, NotebookPen } from "lucide-react";

import type { MemoListItem } from "@/features/memos/model/contracts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function MemoStatus({ memo, className }: { memo: MemoListItem; className?: string }) {
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
    ? "已归档"
    : memo.kind === "note"
      ? "记录"
      : completed
        ? "已完成"
        : overdue
          ? "已超期"
          : "待处理";
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

export function formatMemoDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
