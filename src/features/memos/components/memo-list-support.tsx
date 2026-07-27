import { AlertCircle, NotebookPen, Plus, RefreshCcw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { MemoAssignee, MemoListInput, MemoView } from "@/features/memos/model/contracts";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import { RepairOsBusinessCard, RepairOsListScaffold } from "@/shared/ui";

export const memoViews: { value: MemoView; label: string; short: string }[] = [
  { value: "active", label: "全部", short: "全" },
  { value: "pending", label: "待处理", short: "待" },
  { value: "mine", label: "我的", short: "我" },
  { value: "overdue", label: "超期", short: "超" },
  { value: "completed", label: "已完成", short: "完" },
  { value: "archived", label: "已归档", short: "档" },
];

export function MemoPagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>
        第 {page} / {pageCount} 页
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}

export function MemoFilterControls({
  search,
  kind,
  assigneeId,
  assignees,
  onSearchChange,
  onKindChange,
  onAssigneeChange,
  onRefresh,
}: {
  search: string;
  kind: MemoListInput["kind"];
  assigneeId: string;
  assignees: MemoAssignee[];
  onSearchChange: (value: string) => void;
  onKindChange: (value: MemoListInput["kind"]) => void;
  onAssigneeChange: (value: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_160px_190px_auto]">
      <Input
        value={search}
        placeholder="搜索标题或正文"
        aria-label="搜索备忘录标题或正文"
        className="h-11 text-base sm:h-9 sm:text-sm"
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <select
        value={kind}
        aria-label="备忘类型"
        className="h-11 rounded-md border border-input bg-background px-3 text-base sm:h-9 sm:text-sm"
        onChange={(event) => onKindChange(event.target.value as MemoListInput["kind"])}
      >
        <option value="all">全部类型</option>
        <option value="note">普通记录</option>
        <option value="todo">待办</option>
      </select>
      <select
        value={assigneeId}
        aria-label="负责人"
        className="h-11 rounded-md border border-input bg-background px-3 text-base sm:h-9 sm:text-sm"
        onChange={(event) => onAssigneeChange(event.target.value)}
      >
        <option value="">全部负责人</option>
        {assignees.map((assignee) => (
          <option key={assignee.membershipId} value={assignee.membershipId}>
            {assignee.displayName}
          </option>
        ))}
      </select>
      <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onRefresh}>
        <RefreshCcw className="size-4" /> 刷新
      </Button>
    </div>
  );
}

export function MemoDeniedState() {
  return (
    <RepairOsListScaffold title="备忘录" subtitle="需要本店铺访问权限">
      <RepairOsBusinessCard className="p-4">
        <p className="text-sm font-semibold">当前账号不能查看备忘录</p>
        <p className="mt-1 text-xs text-muted-foreground">请选择已开通此功能且仍在营业的店铺。</p>
      </RepairOsBusinessCard>
    </RepairOsListScaffold>
  );
}

export function MemoLoading() {
  return (
    <RepairOsListScaffold title="备忘录" subtitle="正在确认店铺权限">
      <MemoLoadingRows />
    </RepairOsListScaffold>
  );
}

export function MemoLoadingRows() {
  return (
    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-1" aria-busy="true">
      <span className="sr-only" role="status">
        正在载入备忘录
      </span>
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

export function MemoEmptyState({
  filtered,
  canCreate,
  onCreate,
}: {
  filtered: boolean;
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <RepairOsBusinessCard className="grid min-h-52 place-items-center p-5 text-center">
      <div>
        <NotebookPen className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-semibold">
          {filtered ? "没有符合条件的记录" : "还没有备忘录"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {filtered ? "调整搜索或筛选条件后重试。" : "把交班事项和待办集中记录在这里。"}
        </p>
        {canCreate && !filtered ? (
          <Button className="mt-3 min-h-11" onClick={onCreate}>
            <Plus className="size-4" /> 新建备忘
          </Button>
        ) : null}
      </div>
    </RepairOsBusinessCard>
  );
}

export function MemoErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const forbidden = error instanceof RepairDeskApiError && error.status === 403;
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>{forbidden ? "没有读取权限" : "备忘录读取失败"}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
        <span>{error instanceof Error ? error.message : "请稍后重试"}</span>
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onRetry}>
          重试
        </Button>
      </AlertDescription>
    </Alert>
  );
}
