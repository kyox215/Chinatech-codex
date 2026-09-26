"use client";

import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  MemoChecklistItem,
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
  updateMemoChecklistItem,
  updateMemo,
} from "@/lib/repairdesk/api";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { RepairOsBusinessCard, RepairOsListScaffold } from "@/shared/ui";
import { useLocale } from "@/shared/i18n/locale-provider";
import { getMemoPresentationCopy, translateMemoPresentation } from "@/shared/i18n/messages";
import { APP_TIME_ZONE } from "@/shared/i18n/locales";

export function MemosScreen() {
  const shell = useStoreShellContext();
  const scopeKey = `${shell.activeStore?.id ?? "none"}:${shell.authorityFingerprint ?? ""}:${Boolean(shell.permissions?.canReadMemos)}`;
  return <MemoWorkspace key={scopeKey} shell={shell} />;
}

function MemoWorkspace({ shell }: { shell: ReturnType<typeof useStoreShellContext> }) {
  const { locale, t } = useLocale();
  const copy = getMemoPresentationCopy(locale);
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const storeId = shell.activeStore?.id;
  const workspaceActive = useRef(false);
  useLayoutEffect(() => {
    workspaceActive.current = true;
    return () => {
      workspaceActive.current = false;
    };
  }, []);
  const [view, setView] = useState<MemoView>("active");
  const [kind, setKind] = useState<MemoListInput["kind"]>("all");
  const [assigneeId, setAssigneeId] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selected, setSelected] = useState<MemoListItem | StoreMemo | null>(null);
  const [editingMemo, setEditingMemo] = useState<StoreMemo | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [conflictMemoId, setConflictMemoId] = useState<string | null>(null);
  const [expandedMemoId, setExpandedMemoId] = useState<string | null>(null);
  const [expandedAnchor, setExpandedAnchor] = useState<MemoListItem | StoreMemo | null>(null);
  const [pendingChecklistMemoIds, setPendingChecklistMemoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const pendingChecklistMemoIdsRef = useRef(new Set<string>());
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
  const inlineDetailQuery = useQuery({
    queryKey: memosKeys.detail(storeId, expandedMemoId ?? "none"),
    queryFn: ({ signal }) => getMemo(expandedMemoId!, { signal }),
    enabled: Boolean(storeId && expandedMemoId),
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
    setEditingMemo((current) =>
      current?.id === selected.id && editorDirty ? current : detailQuery.data,
    );
  }, [detailQuery.data, editorDirty, editorOpen, selected]);
  const refresh = async () => {
    if (!workspaceActive.current) return;
    await queryClient.invalidateQueries({ queryKey: memosKeys.store(storeId) });
  };
  const acceptMemoResult = (memo: StoreMemo) => {
    const key = memosKeys.detail(storeId, memo.id);
    const cached = queryClient.getQueryData<StoreMemo>(key);
    if (cached && cached.version > memo.version) return cached;
    queryClient.setQueryData(key, memo);
    return memo;
  };
  const mutation = useMutation({
    mutationFn: async (operation: () => Promise<MemoMutationResult>) => operation(),
    onSuccess: async (result) => {
      if (!workspaceActive.current || result.memo.store_id !== storeId) return;
      const nextMemo = acceptMemoResult(result.memo);
      setConflictMemoId(null);
      toast.success(copy.updatedToast);
      setSelected(nextMemo);
      setExpandedAnchor((current) =>
        current?.id === nextMemo.id && current.version <= nextMemo.version ? nextMemo : current,
      );
      setEditingMemo((current) =>
        current?.id === nextMemo.id && current.version <= nextMemo.version ? nextMemo : current,
      );

      await refresh();
    },
    onError: (error) => {
      if (!workspaceActive.current) return;
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
    setEditorDirty(false);
    setEditorOpen(true);
  };
  const openExisting = (memo: MemoListItem) => {
    setConflictMemoId(null);
    setSelected(memo);
    setEditingMemo(null);
    setEditorDirty(false);
    setEditorOpen(true);
  };
  const toggleExpanded = (memo: MemoListItem) => {
    if (expandedMemoId === memo.id) {
      setExpandedMemoId(null);
      setExpandedAnchor(null);
      void refresh();
      return;
    }
    setExpandedMemoId(memo.id);
    setExpandedAnchor(memo);
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
    if (workspaceActive.current && editorOpen && editingMemo?.id === memo.id) {
      const nextMemo = acceptMemoResult(result.memo);
      setEditingMemo((current) =>
        current && current.version > nextMemo.version ? current : nextMemo,
      );
    }
  };
  const toggleChecklistItem = async (
    memo: StoreMemo,
    item: MemoChecklistItem,
    completed: boolean,
  ) => {
    if (!online || pendingChecklistMemoIdsRef.current.has(memo.id)) return;
    pendingChecklistMemoIdsRef.current.add(memo.id);
    setPendingChecklistMemoIds(new Set(pendingChecklistMemoIdsRef.current));
    try {
      const result = await updateMemoChecklistItem({
        operationId: crypto.randomUUID(),
        id: memo.id,
        expectedVersion: memo.version,
        itemId: item.id,
        completed,
      });
      if (!workspaceActive.current || result.memo.store_id !== storeId) return;
      const nextMemo = acceptMemoResult(result.memo);
      setConflictMemoId(null);
      setExpandedAnchor((current) =>
        current?.id === nextMemo.id && current.version <= nextMemo.version ? nextMemo : current,
      );
      setSelected((current) =>
        current?.id === nextMemo.id && current.version <= nextMemo.version ? nextMemo : current,
      );
      setEditingMemo((current) =>
        current?.id === nextMemo.id && !editorDirty && current.version <= nextMemo.version
          ? nextMemo
          : current,
      );

      toast.success(copy.updatedToast);
      await refresh();
    } catch (error) {
      if (!workspaceActive.current) return;
      if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        error.status === 409
      ) {
        setConflictMemoId(memo.id);
        await queryClient.invalidateQueries({ queryKey: memosKeys.detail(storeId, memo.id) });
      }
      toast.error(error instanceof Error ? error.message : copy.operationFailed);
      throw error;
    } finally {
      pendingChecklistMemoIdsRef.current.delete(memo.id);
      if (workspaceActive.current) {
        setPendingChecklistMemoIds(new Set(pendingChecklistMemoIdsRef.current));
      }
    }
  };
  const detailMemo = editingMemo ?? (selected && "content" in selected ? selected : null);
  const latestDetail = detailQuery.data;
  const offlineWithoutCache = !online && !listQuery.data;
  const createAction = shell.permissions?.canCreateMemos ? (
    <Button
      type="button"
      size="iconDense"
      className="size-9 rounded-lg"
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
  const displayItems =
    expandedMemoId && expandedAnchor && !visibleItems.some((memo) => memo.id === expandedMemoId)
      ? [expandedAnchor, ...visibleItems]
      : visibleItems;
  const filterValue = { view, kind, assigneeId };
  const filterCount = getMemoFilterCount(filterValue);
  const activeFilterLabels = getMemoFilterLabels(filterValue, assigneesQuery.data ?? [], locale);
  const visibleTodoCount = visibleItems.filter((memo) => memo.kind === "todo").length;
  const visibleCompletedCount = visibleItems.filter(
    (memo) => memo.kind === "todo" && memo.todo_status === "completed",
  ).length;
  const visiblePendingCount = visibleTodoCount - visibleCompletedCount;
  const visibleNoteCount = visibleItems.length - visibleTodoCount;
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
      className="h-10 rounded-xl px-3"
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
        filterCount > 0 && "border-primary bg-primary/10 text-primary",
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
            "grid size-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground lg:text-[11px] lg:leading-4",
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
        ) : displayItems.length ? (
          <>
            <section
              className="min-w-0 rounded-xl bg-card px-4 sm:px-6"
              aria-label={copy.storeListAria}
            >
              <header className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border/60 py-4">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{copy.today}</p>
                    <h2 className="mt-1 truncate text-base font-semibold leading-6">
                      {todayLabel}
                    </h2>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums">
                      {translateMemoPresentation(locale, "visibleCount", {
                        count: visibleItems.length,
                      })}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {translateMemoPresentation(locale, "visibleSummary", {
                        todos: visiblePendingCount,
                        notes: visibleNoteCount,
                      })}
                    </p>
                  </div>
                </div>
              </header>
              <div className="min-w-0 divide-y divide-border/60">
                {displayItems.map((memo) => (
                  <MemoCard
                    key={memo.id}
                    memo={memo}
                    busy={!online || mutation.isPending || pendingChecklistMemoIds.has(memo.id)}
                    expanded={expandedMemoId === memo.id}
                    detail={
                      expandedMemoId === memo.id && inlineDetailQuery.data?.id === memo.id
                        ? inlineDetailQuery.data
                        : undefined
                    }
                    detailLoading={expandedMemoId === memo.id && inlineDetailQuery.isFetching}
                    detailError={expandedMemoId === memo.id && inlineDetailQuery.isError}
                    search={deferredSearch}
                    onOpen={() => openExisting(memo)}
                    onExpand={() => toggleExpanded(memo)}
                    onRetryDetail={() => void inlineDetailQuery.refetch()}
                    onToggleChecklistItem={async (item, completed) => {
                      const detail = inlineDetailQuery.data;
                      if (!detail || detail.id !== memo.id) return;
                      await toggleChecklistItem(detail, item, completed);
                    }}
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
          if (!nextOpen) {
            setEditingMemo(null);
            setEditorDirty(false);
          }
        }}
        checklistSearch={deferredSearch}
        onDirtyChange={setEditorDirty}
        onToggleChecklistItem={
          detailMemo
            ? (item, completed) => toggleChecklistItem(detailMemo, item, completed)
            : undefined
        }
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
