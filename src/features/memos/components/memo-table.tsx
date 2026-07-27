import type { MemoListItem } from "@/features/memos/model/contracts";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatMemoDate, MemoStatus } from "./memo-status";

export function MemoTable({
  items,
  busy,
  busyId,
  onOpen,
  onTransition,
}: {
  items: MemoListItem[];
  busy?: boolean;
  busyId?: string;
  onOpen: (memo: MemoListItem) => void;
  onTransition: (memo: MemoListItem) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-panel)] bg-card shadow-[var(--shadow-card)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">类型/状态</TableHead>
            <TableHead>标题与摘要</TableHead>
            <TableHead className="w-36">负责人</TableHead>
            <TableHead className="w-32">到期</TableHead>
            <TableHead className="w-40">作者/更新</TableHead>
            <TableHead className="w-24 text-right">动作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((memo) => (
            <TableRow key={memo.id}>
              <TableCell>
                <MemoStatus memo={memo} />
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  className="block min-h-11 w-full min-w-0 rounded-md py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onOpen(memo)}
                >
                  <span className="block truncate text-sm font-medium">{memo.title}</span>
                  <span className="block text-xs text-muted-foreground">打开查看正文</span>
                </button>
              </TableCell>
              <TableCell className="truncate text-xs">{memo.assignee_name ?? "未分配"}</TableCell>
              <TableCell className="text-xs">
                {memo.kind === "todo" ? formatMemoDate(memo.due_at) : "—"}
              </TableCell>
              <TableCell className="text-xs">
                <span className="block truncate">{memo.created_by_name_snapshot}</span>
                <span className="text-muted-foreground">{formatMemoDate(memo.updated_at)}</span>
              </TableCell>
              <TableCell className="text-right">
                {memo.capabilities.canTransition ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={busy || busyId === memo.id}
                    onClick={() => onTransition(memo)}
                  >
                    {memo.todo_status === "completed" ? "重开" : "完成"}
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
