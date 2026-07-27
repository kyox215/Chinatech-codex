"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Filter, Plus, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type {
  MemoListInput,
  MemoListItem,
  MemoMutationResult,
  MemoView,
  StoreMemo,
} from "@/features/memos/model/contracts";
import { MemoCard } from "@/features/memos/components/memo-card";
import { MemoTable } from "@/features/memos/components/memo-table";
import {
  MemoDeniedState,
  MemoEmptyState,
  MemoErrorState,
  MemoFilterControls,
  MemoLoading,
  MemoLoadingRows,
  MemoPagination,
  memoViews,
} from "@/features/memos/components/memo-list-support";
import { MemoEditor, type MemoEditorSaveInput } from "@/features/memos/forms/memo-editor";
import {
  memoAssigneesQueryOptions,
  memoListQueryOptions,
  memoSummaryQueryOptions,
  memosKeys,
} from "@/features/memos/api";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import {
  archiveMemo,
  createMemo,
  getMemo,
  restoreMemo,
  transitionMemo,
  updateMemo,
} from "@/lib/repairdesk/api";
import {
  RepairOsBusinessCard,
  RepairOsHeaderActionButton,
  RepairOsListScaffold,
} from "@/shared/ui";

export function MemosScreen() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const shell = useStoreShellContext();
  const storeId = shell.activeStore?.id;
  const [view, setView] = useState<MemoView>("active");
  const [kind, setKind] = useState<MemoListInput["kind"]>("all");
  const [assigneeId, setAssigneeId] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [page, setPage] = useState(1);
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
      page,
      pageSize: 20,
    }),
    [assigneeId, deferredSearch, kind, page, view],
  );
  const listQuery = useQuery({
    ...memoListQueryOptions(input, storeId),
    enabled: Boolean(storeId && shell.permissions?.canReadMemos),
  });
  const summaryQuery = useQuery({
    ...memoSummaryQueryOptions(storeId),
    enabled: Boolean(storeId && shell.permissions?.canReadMemos),
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
  useEffect(() => setPage(1), [assigneeId, deferredSearch, kind, view]);
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
      toast.success("备忘录已更新");
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
      toast.error(error instanceof Error ? error.message : "备忘录操作失败");
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
  const summary = summaryQuery.data;
  const chips = memoViews.map((item) => ({
    key: item.value,
    label: item.label,
    shortLabel: item.short,
    active: view === item.value,
    count:
      item.value === "pending"
        ? summary?.pending
        : item.value === "mine"
          ? summary?.mine
          : item.value === "overdue"
            ? summary?.overdue
            : item.value === "completed"
              ? summary?.completed
              : undefined,
    onClick: () => setView(item.value),
  }));
  const createAction = shell.permissions?.canCreateMemos ? (
    <RepairOsHeaderActionButton
      onClick={openCreate}
      ariaLabel="新建备忘"
      disabled={!online || mutation.isPending}
    >
      <Plus className="size-4" />
    </RepairOsHeaderActionButton>
  ) : null;
  if (shell.isLoading) return <MemoLoading />;
  if (!storeId || !shell.permissions?.canReadMemos) return <MemoDeniedState />;
  const filterControls = (
    <MemoFilterControls
      search={search}
      kind={kind}
      assigneeId={assigneeId}
      assignees={assigneesQuery.data ?? []}
      onSearchChange={setSearch}
      onKindChange={setKind}
      onAssigneeChange={setAssigneeId}
      onRefresh={() => void refresh()}
    />
  );

  return (
    <RepairOsListScaffold
      title="备忘录"
      subtitle={listQuery.isFetching ? "正在同步…" : `${listQuery.data?.total ?? 0} 条记录`}
      action={createAction}
      desktopAction={
        shell.permissions?.canCreateMemos ? (
          <Button onClick={openCreate} disabled={!online || mutation.isPending}>
            <Plus className="size-4" />
            新建备忘
          </Button>
        ) : null
      }
      desktopHeaderAddon={filterControls}
      searchValue={search}
      searchPlaceholder="搜索标题或正文"
      onSearchChange={setSearch}
      filterAction={
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 rounded-xl"
          aria-label="筛选"
          aria-expanded={filtersOpen}
          aria-controls="memo-mobile-filters"
          onClick={() => setFiltersOpen((value) => !value)}
        >
          <Filter className="size-4" />
        </Button>
      }
      chips={chips}
      chipsLabel="备忘录视图"
    >
      {!online ? (
        <Alert className="mb-2">
          <WifiOff className="size-4" />
          <AlertTitle>{listQuery.data ? "当前离线" : "离线且没有缓存"}</AlertTitle>
          <AlertDescription>
            {listQuery.data
              ? "已显示缓存内容，恢复网络后会自动同步；离线期间不能保存。"
              : "此设备没有可用的备忘录缓存，请恢复网络后重试。"}
          </AlertDescription>
        </Alert>
      ) : null}
      {filtersOpen ? (
        <div
          id="memo-mobile-filters"
          className="mb-2 rounded-xl border border-[var(--border-panel)] bg-card p-2 lg:hidden"
        >
          {filterControls}
        </div>
      ) : null}
      {shell.activeStore?.role === "viewer" ? (
        <Alert className="mb-2">
          <AlertTitle>只读模式</AlertTitle>
          <AlertDescription>你可以查看本店铺的活动和归档记录，但不能创建或修改。</AlertDescription>
        </Alert>
      ) : null}
      {editorOpen && selected && detailQuery.isFetching && !detailMemo ? (
        <Alert className="mb-2" aria-live="polite">
          <AlertTitle>正在载入备忘详情</AlertTitle>
          <AlertDescription>正在读取最新正文和状态，请稍候。</AlertDescription>
        </Alert>
      ) : null}
      {detailQuery.isError ? (
        <MemoErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />
      ) : null}
      {offlineWithoutCache ? (
        <RepairOsBusinessCard className="grid min-h-52 place-items-center p-5 text-center">
          <div>
            <WifiOff className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold">无法载入备忘录</p>
            <p className="mt-1 text-xs text-muted-foreground">恢复网络后即可查看或新建记录。</p>
          </div>
        </RepairOsBusinessCard>
      ) : listQuery.isError ? (
        <MemoErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      ) : listQuery.isLoading ? (
        <MemoLoadingRows />
      ) : listQuery.data?.items.length ? (
        <>
          <div className="grid gap-2 md:grid-cols-2 lg:hidden">
            {listQuery.data.items.map((memo) => (
              <MemoCard
                key={memo.id}
                memo={memo}
                busy={!online || mutation.isPending}
                onOpen={() => openExisting(memo)}
                onTransition={() => void runTransition(memo).catch(() => undefined)}
              />
            ))}
          </div>
          <div className="hidden lg:block">
            <MemoTable
              items={listQuery.data.items}
              busy={!online || mutation.isPending}
              busyId={mutation.isPending ? selected?.id : undefined}
              onOpen={openExisting}
              onTransition={(memo) => void runTransition(memo).catch(() => undefined)}
            />
          </div>
          <MemoPagination
            page={listQuery.data.page}
            pageCount={listQuery.data.pageCount}
            onPageChange={setPage}
          />
        </>
      ) : (
        <MemoEmptyState
          filtered={Boolean(search || kind !== "all" || assigneeId || view !== "active")}
          canCreate={Boolean(shell.permissions?.canCreateMemos)}
          onCreate={openCreate}
        />
      )}
      <MemoEditor
        open={editorOpen && (!selected || Boolean(detailMemo))}
        memo={detailMemo}
        latestVersion={
          conflictMemoId === detailMemo?.id
            ? latestDetail?.version
            : (latestDetail?.version ?? detailMemo?.version)
        }
        assignees={assigneesQuery.data ?? []}
        canAssignAny={Boolean(listQuery.data?.capabilities.canAssignAny)}
        membershipId={listQuery.data?.capabilities.membershipId}
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
