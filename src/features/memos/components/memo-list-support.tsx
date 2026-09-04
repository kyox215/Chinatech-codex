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
import { useLocale } from "@/shared/i18n/locale-provider";
import { getMemoPresentationCopy, type MemoPresentationKey } from "@/shared/i18n/messages";
import type { AppLocale } from "@/shared/i18n/locales";

export const memoViewOptions: { value: MemoView; copyKey: MemoPresentationKey }[] = [
  { value: "active", copyKey: "currentView" },
  { value: "pending", copyKey: "pendingView" },
  { value: "mine", copyKey: "mineView" },
  { value: "overdue", copyKey: "overdueView" },
  { value: "completed", copyKey: "completedView" },
  { value: "archived", copyKey: "archivedView" },
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
  locale: AppLocale = "zh-CN",
) {
  const copy = getMemoPresentationCopy(locale);
  const labels: string[] = [];
  if (view !== "active") {
    const option = memoViewOptions.find((candidate) => candidate.value === view);
    labels.push(option ? copy[option.copyKey] : copy.viewScope);
  }
  if (kind !== "all") labels.push(kind === "todo" ? copy.todo : copy.note);
  if (assigneeId) {
    labels.push(
      assignees.find((assignee) => assignee.membershipId === assigneeId)?.displayName ??
        copy.assignee,
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
  const { locale } = useLocale();
  const copy = getMemoPresentationCopy(locale);
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
  const { locale } = useLocale();
  const copy = getMemoPresentationCopy(locale);
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
        <legend className="text-xs font-medium text-muted-foreground">{copy.viewScope}</legend>
        <div className="flex flex-wrap gap-2">
          {memoViewOptions.map((option) => (
            <FilterPill
              key={option.value}
              selected={draft.view === option.value}
              onClick={() => setDraft((current) => ({ ...current, view: option.value }))}
            >
              {option.value === "active" ? copy.currentViewShort : copy[option.copyKey]}
            </FilterPill>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2.5">
        <legend className="text-xs font-medium text-muted-foreground">{copy.type}</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", copy.all],
              ["todo", copy.todo],
              ["note", copy.note],
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
        <span>{copy.assignee}</span>
        <select
          value={draft.assigneeId}
          aria-label={copy.assignee}
          className="h-[38px] w-full rounded-lg border border-[var(--border-panel)] bg-background px-3 text-base text-foreground shadow-none"
          onChange={(event) =>
            setDraft((current) => ({ ...current, assigneeId: event.target.value }))
          }
        >
          <option value="">{copy.allAssignees}</option>
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
          className="min-h-8 rounded-lg px-2 text-muted-foreground"
          onClick={() => setDraft({ view: "active", kind: "all", assigneeId: "" })}
        >
          {copy.clearConditions}
        </Button>
        <Button
          type="button"
          className="min-h-10 rounded-lg bg-foreground px-4 text-background hover:bg-foreground/90"
          onClick={() => {
            onApply(draft);
            onOpenChange(false);
          }}
        >
          {copy.viewResults}
        </Button>
      </div>
    </div>
  );

  if (compact) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          closeLabel={copy.closeFilters}
          className="max-h-[82svh] overflow-y-auto rounded-t-[20px] border-x-0 border-b-0 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
        >
          <SheetHeader className="mb-5 text-left">
            <SheetTitle className="text-base">{copy.filtersTitle}</SheetTitle>
            <SheetDescription>{copy.filtersDescription}</SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={copy.closeFilters} className="max-w-lg rounded-2xl p-3 sm:p-5">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base">{copy.filtersTitle}</DialogTitle>
          <DialogDescription>{copy.filtersDescription}</DialogDescription>
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
  const { locale } = useLocale();
  const copy = getMemoPresentationCopy(locale);
  if (!hasMore) return null;

  return (
    <div className="flex justify-center pt-2">
      <Button
        type="button"
        variant="outline"
        className="min-h-9 rounded-full border-[var(--border-panel)] bg-card px-4 shadow-none"
        disabled={loading}
        onClick={onLoadMore}
      >
        {loading ? copy.loading : copy.loadMore}
      </Button>
    </div>
  );
}

export function MemoDeniedState({ noStore = false }: { noStore?: boolean }) {
  const { locale } = useLocale();
  const copy = getMemoPresentationCopy(locale);
  return (
    <RepairOsListScaffold title={copy.title} subtitle={copy.readRequiredSubtitle}>
      <RepairOsBusinessCard className="p-2.5 sm:p-4">
        <p className="text-sm font-semibold">{noStore ? copy.noStoreTitle : copy.deniedTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {noStore ? copy.noStoreDescription : copy.deniedDescription}
        </p>
      </RepairOsBusinessCard>
    </RepairOsListScaffold>
  );
}

export function MemoLoading() {
  const { locale } = useLocale();
  const copy = getMemoPresentationCopy(locale);
  return (
    <RepairOsListScaffold title={copy.title} subtitle={copy.permissionLoadingSubtitle}>
      <MemoLoadingRows />
    </RepairOsListScaffold>
  );
}

export function MemoLoadingRows() {
  const { locale } = useLocale();
  const copy = getMemoPresentationCopy(locale);
  return (
    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-1" aria-busy="true">
      <span className="sr-only" role="status">
        {copy.loadingAria}
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
  const { locale } = useLocale();
  const copy = getMemoPresentationCopy(locale);
  return (
    <RepairOsBusinessCard className="grid min-h-32 place-items-center p-3 text-center sm:min-h-52 sm:p-5">
      <div>
        <NotebookPen className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-semibold">
          {filtered ? copy.emptyFilteredTitle : copy.emptyTitle}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {filtered ? copy.emptyFilteredDescription : copy.emptyDescription}
        </p>
        {canCreate && !filtered ? (
          <Button className="mt-3 min-h-10" onClick={onCreate}>
            <Plus className="size-4" /> {copy.newMemo}
          </Button>
        ) : null}
      </div>
    </RepairOsBusinessCard>
  );
}

export function MemoErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { locale } = useLocale();
  const copy = getMemoPresentationCopy(locale);
  const forbidden = error instanceof RepairDeskApiError && error.status === 403;
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>{forbidden ? copy.forbiddenTitle : copy.readFailedTitle}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
        <span>{error instanceof Error ? error.message : copy.readFailedDescription}</span>
        <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={onRetry}>
          {copy.retry}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
