"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, SlidersHorizontal, WifiOff, X } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  MemoListInput,
  MemoListItem,
  MemoMutationResult,
  MemoView,
  StoreMemo,
} from "@/features/memos/model/contracts";
import { MemoCard } from "@/features/memos/components/memo-card";
import {
  MemoDeniedState,
  MemoEmptyState,
  MemoErrorState,
  getMemoFilterCount,
  getMemoFilterLabels,
  MemoFiltersOverlay,
  MemoLoadMore,
  MemoLoading,
  MemoLoadingRows,
} from "@/features/memos/components/memo-list-support";
import { MemoEditor, type MemoEditorSaveInput } from "@/features/memos/forms/memo-editor";
import { memoAssigneesQueryOptions, memosKeys } from "@/features/memos/api";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import {
  archiveMemo,
  createMemo,
  getMemo,
  listMemos,
  restoreMemo,
  transitionMemo,
  updateMemo,
} from "@/lib/repairdesk/api";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { RepairOsBusinessCard, RepairOsListScaffold } from "@/shared/ui";
import { useLocale } from "@/shared/i18n/locale-provider";
import { getMemoPresentationCopy, translateMemoPresentation } from "@/shared/i18n/messages";
import { APP_TIME_ZONE } from "@/shared/i18n/locales";

export function MemosScreen() {
  const { locale, t } = useLocale();
  const copy = getMemoPresentationCopy(locale);
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext();
  const storeId = shell.activeStore?.id;
  const [view, setView] = useState<MemoView>("active");
  const [kind, setKind] = useState<MemoListInput["kind"]>("all");
  const [assigneeId, setAssigneeId] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selected, setSelected] = useState<MemoListItem | StoreMemo | null>(null);
  const [editingMemo, setEditingMemo] = useState<StoreMemo | null>(null);
  const [conflictMemoId, setConflictMemoId] = useState<string | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const input = useMemo<MemoListInput>(
    () => ({
      view,
      kind,
      assigneeMembershipId: assigneeId || undefined,
      search: deferredSearch || undefined,
      pageSize: 20,
    }),
    [assigneeId, deferredSearch, kind, view],
  );
  const listQuery = useInfiniteQuery({
    queryKey: memosKeys.list(storeId, input),
    queryFn: ({ pageParam, signal }) => listMemos({ ...input, page: pageParam }, { signal }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pageCount ? lastPage.page + 1 : undefined,
    enabled: Boolean(storeId && shell.permissions?.canReadMemos),
    staleTime: 15_000,
  });
  const assigneesQuery = useQuery({
    ...memoAssigneesQueryOptions(storeId),
    enabled: Boolean(storeId && shell.permissions?.canReadMemos),
  });
  const detailQuery = useQuery({
    queryKey: memosKeys.detail(storeId, selected?.id ?? "none"),
    queryFn: ({ signal }) => getMemo(selected!.id, { signal }),
    enabled: Boolean(storeId && selected?.id && editorOpen),
  });
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
  useEffect(() => {
    if (searchParams.get("new") === "1" && shell.permissions?.canCreateMemos) {
      setSelected(null);
      setEditingMemo(null);
      setEditorOpen(true);
    }
  }, [searchParams, shell.permissions?.canCreateMemos]);
  useEffect(() => {
    if (!editorOpen || !selected || !detailQuery.data) return;
    setEditingMemo((current) => (current?.id === selected.id ? current : detailQuery.data));
  }, [detailQuery.data, editorOpen, selected]);
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: memosKeys.store(storeId) });
  };
  const mutation = useMutation({
    mutationFn: async (operation: () => Promise<MemoMutationResult>) => operation(),
    onSuccess: async (result) => {
      setConflictMemoId(null);
      toast.success(copy.updatedToast);
      setSelected(result.memo);
      queryClient.setQueryData(memosKeys.detail(storeId, result.memo.id), result.memo);
      await refresh();
    },
    onError: (error) => {
      if (
        selected?.id &&
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        error.status === 409
      ) {
        setConflictMemoId(selected.id);
        void detailQuery.refetch();
      }
      toast.error(error instanceof Error ? error.message : copy.operationFailed);
    },
  });
  const openCreate = () => {
    setConflictMemoId(null);
    setSelected(null);
    setEditingMemo(null);
    setEditorOpen(true);
  };
  const openExisting = (memo: MemoListItem) => {
    setConflictMemoId(null);
    setSelected(memo);
    setEditingMemo(null);
    setEditorOpen(true);
  };
  const saveEditor = async (value: MemoEditorSaveInput) => {
    await mutation.mutateAsync(() => ("kind" in value ? createMemo(value) : updateMemo(value)));
    setEditorOpen(false);
  };
  const runTransition = async (
    memo: MemoListItem,
    transition?: "claim" | "complete" | "reopen",
  ) => {
    const next = transition ?? (memo.todo_status === "completed" ? "reopen" : "complete");
    const result = await mutation.mutateAsync(() =>
      transitionMemo({
        operationId: crypto.randomUUID(),
        id: memo.id,
        expectedVersion: memo.version,
        transition: next,
      }),
    );
    if (editorOpen && editingMemo?.id === memo.id) setEditingMemo(result.memo);
  };
  const detailMemo = editingMemo ?? (selected && "content" in selected ? selected : null);
  const latestDetail = detailQuery.data;
  const offlineWithoutCache = !online && !listQuery.data;
  const createAction = shell.permissions?.canCreateMemos ? (
    <Button
      type="button"
      size="iconDense"
      className="size-9 rounded-lg bg-foreground text-background shadow-none hover:bg-foreground/90"
      onClick={openCreate}
      aria-label={copy.newMemo}
      disabled={!online || mutation.isPending}
    >
      <Plus className="size-4" />
    </Button>
  ) : null;
  if (shell.isLoading) return <MemoLoading />;
  if (!storeId) return <MemoDeniedState noStore />;
  if (!shell.permissions?.canReadMemos) return <MemoDeniedState />;
  const listMeta = listQuery.data?.pages[0];
  const visibleItems = listQuery.data?.pages.flatMap((result) => result.items) ?? [];
  const filterValue = { view, kind, assigneeId };
  const filterCount = getMemoFilterCount(filterValue);
  const activeFilterLabels = getMemoFilterLabels(filterValue, assigneesQuery.data ?? [], locale);
  const visibleTodoCount = visibleItems.filter((memo) => memo.kind === "todo").length;
  const visibleCompletedCount = visibleItems.filter(
    (memo) => memo.kind === "todo" && memo.todo_status === "completed",
  ).length;
  const visiblePendingCount = visibleTodoCount - visibleCompletedCount;
  const visibleNoteCount = visibleItems.length - visibleTodoCount;
  const visibleCompletionPercent = visibleTodoCount
    ? Math.round((visibleCompletedCount / visibleTodoCount) * 100)
    : 0;
  const todayLabel = new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
  const desktopCreateAction = shell.permissions?.canCreateMemos ? (
    <Button
      type="button"
      onClick={openCreate}
      disabled={!online || mutation.isPending}
      className="h-10 rounded-xl bg-foreground px-3 text-background shadow-none hover:bg-foreground/90"
    >
      <Plus className="size-4" />
      {copy.newMemo}
    </Button>
  ) : null;
  const filterButton = (compact = false) => (
    <Button
      type="button"
      variant="outline"
      size={compact ? "iconDense" : "default"}
      className={cn(
        compact ? "size-9" : "h-10 px-3",
        "relative rounded-xl border-[var(--border-panel)] bg-card shadow-none",
        filterCount > 0 && "border-foreground text-foreground",
      )}
      aria-label={
        filterCount
          ? translateMemoPresentation(locale, "filterSelected", { count: filterCount })
          : copy.filter
      }
      aria-expanded={filtersOpen}
      onClick={() => setFiltersOpen(true)}
    >
      <SlidersHorizontal className="size-4" />
      {compact ? null : <span>{copy.filter}</span>}
      {filterCount > 0 ? (
        <span
          className={cn(
            "grid size-5 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background lg:text-[11px] lg:leading-4",
            compact && "absolute -right-1 -top-1",
          )}
        >
          {filterCount}
        </span>
      ) : null}
    </Button>
  );
  const activeFilterSummary = activeFilterLabels.length ? (
    <div className="flex min-w-0 items-center gap-2" aria-label={copy.currentFilters}>
      <span className="inline-flex min-w-0 items-center rounded-full bg-[var(--surface-panel-muted)] px-3 py-1.5 text-[11px] font-medium text-muted-foreground lg:text-xs lg:leading-4">
        <span className="truncate">{activeFilterLabels.join(" · ")}</span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="iconDense"
        className="size-8 shrink-0 rounded-full text-muted-foreground"
        aria-label={copy.clearFilters}
        onClick={() => {
          setView("active");
          setKind("all");
          setAssigneeId("");
        }}
      >
        <X className="size-4" />
      </Button>
    </div>
  ) : null;
  const desktopToolbar = (
    <div className="mx-auto mb-6 max-w-4xl space-y-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className={cn(repairOs.searchBar, "h-10 min-w-0 flex-1 rounded-xl shadow-none")}>
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            type="search"
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchPlaceholder}
            className={cn(repairOs.searchInput, "h-10 text-sm")}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {filterButton()}
        {desktopCreateAction}
      </div>
      {search.trim() || activeFilterSummary ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {search.trim() ? (
            <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-[var(--surface-panel-muted)] px-3 py-1.5 text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
              <span className="shrink-0">{copy.searchPrefix}</span>
              <span className="truncate font-mono text-foreground">{search.trim()}</span>
            </span>
          ) : null}
          {activeFilterSummary}
        </div>
      ) : null}
    </div>
  );

  return (
    <RepairOsListScaffold
      title={t("memos.title")}
      subtitle={
        listQuery.isFetching
          ? t("page.syncing")
          : t("page.recordsTotal", { count: listMeta?.total ?? 0 })
      }
      action={createAction}
      desktopHeader={desktopToolbar}
      searchValue={search}
      searchPlaceholder={copy.searchPlaceholder}
      onSearchChange={setSearch}
      searchFrame="embedded"
      filterAction={filterButton(true)}
    >
      <div className={cn(repairOs.listReadableWidth, repairOs.listModuleStack)}>
        {activeFilterSummary ? <div className="lg:hidden">{activeFilterSummary}</div> : null}
        {!online ? (
          <Alert>
            <WifiOff className="size-4" />
            <AlertTitle>
              {listQuery.data ? copy.offlineCachedTitle : copy.offlineNoCacheTitle}
            </AlertTitle>
            <AlertDescription>
              {listQuery.data ? copy.offlineCachedDescription : copy.offlineNoCacheDescription}
            </AlertDescription>
          </Alert>
        ) : null}
        {shell.activeStore?.role === "viewer" ? (
          <Alert>
            <AlertTitle>{copy.readonlyTitle}</AlertTitle>
            <AlertDescription>{copy.readonlyDescription}</AlertDescription>
          </Alert>
        ) : null}
        {editorOpen && selected && detailQuery.isFetching && !detailMemo ? (
          <Alert aria-live="polite">
            <AlertTitle>{copy.detailLoadingTitle}</AlertTitle>
            <AlertDescription>{copy.detailLoadingDescription}</AlertDescription>
          </Alert>
        ) : null}
        {detailQuery.isError ? (
          <MemoErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />
        ) : null}
        {offlineWithoutCache ? (
          <RepairOsBusinessCard className="grid min-h-32 place-items-center p-3 text-center sm:min-h-52 sm:p-5">
            <div>
              <WifiOff className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold">{copy.unavailableTitle}</p>
              <p className="mt-1 text-xs text-muted-foreground">{copy.unavailableDescription}</p>
            </div>
          </RepairOsBusinessCard>
        ) : listQuery.isError ? (
          <MemoErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
        ) : listQuery.isLoading ? (
          <MemoLoadingRows />
        ) : visibleItems.length ? (
          <>
            <section
              className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border-panel)] bg-card shadow-[var(--shadow-card)]"
              aria-label={copy.storeListAria}
            >
              <header className="border-b border-border/50 px-3 py-3 sm:px-4">
                <div className="flex min-w-0 items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary lg:text-[11px] lg:leading-4 lg:tracking-normal">
                      {copy.today}
                    </p>
                    <h2 className="truncate text-lg font-semibold tracking-tight">{todayLabel}</h2>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-xs font-semibold tabular-nums">
                      {translateMemoPresentation(locale, "visibleCount", {
                        count: visibleItems.length,
                      })}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
                      {translateMemoPresentation(locale, "visibleSummary", {
                        todos: visiblePendingCount,
                        notes: visibleNoteCount,
                      })}
                    </p>
                  </div>
                </div>
                {visibleTodoCount ? (
                  <div className="mt-2 flex items-center gap-2">
                    <div
                      className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-label={copy.progressAria}
                      aria-valuemin={0}
                      aria-valuemax={visibleTodoCount}
                      aria-valuenow={visibleCompletedCount}
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${visibleCompletionPercent}%` }}
                      />
                    </div>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground lg:text-[11px] lg:leading-4">
                      {visibleCompletionPercent}%
                    </span>
                  </div>
                ) : null}
              </header>
              <div className="min-w-0">
                {visibleItems.map((memo) => (
                  <MemoCard
                    key={memo.id}
                    memo={memo}
                    busy={!online || mutation.isPending}
                    onOpen={() => openExisting(memo)}
                    onTransition={() => void runTransition(memo).catch(() => undefined)}
                  />
                ))}
              </div>
            </section>
            <MemoLoadMore
              hasMore={Boolean(listQuery.hasNextPage)}
              loading={listQuery.isFetchingNextPage}
              onLoadMore={() => void listQuery.fetchNextPage()}
            />
          </>
        ) : (
          <MemoEmptyState
            filtered={Boolean(search || kind !== "all" || assigneeId || view !== "active")}
            canCreate={Boolean(shell.permissions?.canCreateMemos)}
            onCreate={openCreate}
          />
        )}
      </div>
      <MemoFiltersOverlay
        open={filtersOpen}
        value={filterValue}
        assignees={assigneesQuery.data ?? []}
        onOpenChange={setFiltersOpen}
        onApply={(nextValue) => {
          setView(nextValue.view);
          setKind(nextValue.kind);
          setAssigneeId(nextValue.assigneeId);
        }}
      />
      <MemoEditor
        open={editorOpen && (!selected || Boolean(detailMemo))}
        memo={detailMemo}
        latestVersion={
          conflictMemoId === detailMemo?.id
            ? latestDetail?.version
            : (latestDetail?.version ?? detailMemo?.version)
        }
        assignees={assigneesQuery.data ?? []}
        canAssignAny={Boolean(listMeta?.capabilities.canAssignAny)}
        membershipId={listMeta?.capabilities.membershipId}
        busy={mutation.isPending || !online}
        onOpenChange={(nextOpen) => {
          setEditorOpen(nextOpen);
          if (!nextOpen) setEditingMemo(null);
        }}
        onSave={saveEditor}
        onReloadLatest={
          conflictMemoId === detailMemo?.id && latestDetail
            ? () => {
                setEditingMemo(latestDetail);
                setSelected(latestDetail);
                setConflictMemoId(null);
              }
            : undefined
        }
        onClaim={detailMemo ? () => runTransition(detailMemo, "claim") : undefined}
        onArchive={
          detailMemo
            ? async () => {
                await mutation.mutateAsync(() =>
                  archiveMemo({
                    operationId: crypto.randomUUID(),
                    id: detailMemo.id,
                    expectedVersion: detailMemo.version,
                  }),
                );
                setEditorOpen(false);
              }
            : undefined
        }
        onRestore={
          detailMemo
            ? async () => {
                await mutation.mutateAsync(() =>
                  restoreMemo({
                    operationId: crypto.randomUUID(),
                    id: detailMemo.id,
                    expectedVersion: detailMemo.version,
                  }),
                );
                setEditorOpen(false);
              }
            : undefined
        }
      />
    </RepairOsListScaffold>
  );
}
