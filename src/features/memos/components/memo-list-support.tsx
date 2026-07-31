import { useEffect, useState, type ReactNode } from "react";
import { AlertCircle, NotebookPen, Plus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { MemoAssignee, MemoListInput, MemoView } from "@/features/memos/model/contracts";
import { useIsCompactWorkspace } from "@/hooks/use-mobile";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import { RepairOsBusinessCard, RepairOsListScaffold } from "@/shared/ui";

export const memoViewOptions: { value: MemoView; label: string }[] = [
  { value: "active", label: "当前记录" },
  { value: "pending", label: "待处理" },
  { value: "mine", label: "我的" },
  { value: "overdue", label: "超期" },
  { value: "completed", label: "已完成" },
  { value: "archived", label: "已归档" },
];

export type MemoFilterValue = {
  view: MemoView;
  kind: MemoListInput["kind"];
  assigneeId: string;
};

export function getMemoFilterCount({ view, kind, assigneeId }: MemoFilterValue) {
  return Number(view !== "active") + Number(kind !== "all") + Number(Boolean(assigneeId));
}

export function getMemoFilterLabels(
  { view, kind, assigneeId }: MemoFilterValue,
  assignees: MemoAssignee[],
) {
  const labels: string[] = [];
  if (view !== "active") {
    labels.push(memoViewOptions.find((option) => option.value === view)?.label ?? "查看范围");
  }
  if (kind !== "all") labels.push(kind === "todo" ? "待办" : "记录");
  if (assigneeId) {
    labels.push(
      assignees.find((assignee) => assignee.membershipId === assigneeId)?.displayName ?? "负责人",
    );
  }
  return labels;
}

function FilterPill({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "min-h-10 rounded-full border-[var(--border-panel)] px-3 text-sm shadow-none",
        selected
          ? "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background"
          : "bg-background text-muted-foreground hover:text-foreground",
      )}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function MemoFiltersOverlay({
  open,
  value,
  assignees,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  value: MemoFilterValue;
  assignees: MemoAssignee[];
  onOpenChange: (open: boolean) => void;
  onApply: (value: MemoFilterValue) => void;
}) {
  const compact = useIsCompactWorkspace();
  const { view: currentView, kind: currentKind, assigneeId: currentAssigneeId } = value;
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) {
      setDraft({ view: currentView, kind: currentKind, assigneeId: currentAssigneeId });
    }
  }, [currentAssigneeId, currentKind, currentView, open]);

  const content = (
    <div className="space-y-3 sm:space-y-5">
      <fieldset className="space-y-2.5">
        <legend className="text-xs font-medium text-muted-foreground">查看范围</legend>
        <div className="flex flex-wrap gap-2">
          {memoViewOptions.map((option) => (
            <FilterPill
              key={option.value}
              selected={draft.view === option.value}
              onClick={() => setDraft((current) => ({ ...current, view: option.value }))}
            >
              {option.label.replace("当前记录", "当前")}
            </FilterPill>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2.5">
        <legend className="text-xs font-medium text-muted-foreground">类型</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "全部"],
              ["todo", "待办"],
              ["note", "记录"],
            ] as const
          ).map(([nextKind, label]) => (
            <FilterPill
              key={nextKind}
              selected={draft.kind === nextKind}
              onClick={() => setDraft((current) => ({ ...current, kind: nextKind }))}
            >
              {label}
            </FilterPill>
          ))}
        </div>
      </fieldset>
      <label className="block space-y-2.5 text-xs font-medium text-muted-foreground">
        <span>负责人</span>
        <select
          value={draft.assigneeId}
          aria-label="负责人"
          className="h-11 w-full rounded-xl border border-[var(--border-panel)] bg-background px-3 text-base text-foreground shadow-none"
          onChange={(event) =>
            setDraft((current) => ({ ...current, assigneeId: event.target.value }))
          }
        >
          <option value="">全部负责人</option>
          {assignees.map((assignee) => (
            <option key={assignee.membershipId} value={assignee.membershipId}>
              {assignee.displayName}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 rounded-xl px-2 text-muted-foreground"
          onClick={() => setDraft({ view: "active", kind: "all", assigneeId: "" })}
        >
          清除条件
        </Button>
        <Button
          type="button"
          className="min-h-11 rounded-xl bg-foreground px-5 text-background hover:bg-foreground/90"
          onClick={() => {
            onApply(draft);
            onOpenChange(false);
          }}
        >
          查看结果
        </Button>
      </div>
    </div>
  );

  if (compact) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[82svh] overflow-y-auto rounded-t-[20px] border-x-0 border-b-0 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
        >
          <SheetHeader className="mb-5 text-left">
            <SheetTitle className="text-base">筛选备忘录</SheetTitle>
            <SheetDescription>只保留现在需要查看的内容</SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-3 sm:p-5">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base">筛选备忘录</DialogTitle>
          <DialogDescription>只保留现在需要查看的内容</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

export function MemoLoadMore({
  hasMore,
  loading,
  onLoadMore,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}) {
  if (!hasMore) return null;

  return (
    <div className="flex justify-center pt-2">
      <Button
        type="button"
        variant="outline"
        className="min-h-11 rounded-full border-[var(--border-panel)] bg-card px-5 shadow-none"
        disabled={loading}
        onClick={onLoadMore}
      >
        {loading ? "加载中…" : "加载更多"}
      </Button>
    </div>
  );
}

export function MemoDeniedState() {
  return (
    <RepairOsListScaffold title="备忘录" subtitle="需要本店铺访问权限">
      <RepairOsBusinessCard className="p-2.5 sm:p-4">
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
    <RepairOsBusinessCard className="grid min-h-32 place-items-center p-3 text-center sm:min-h-52 sm:p-5">
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
