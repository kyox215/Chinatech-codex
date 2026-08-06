"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArchiveRestore,
  CheckCircle2,
  Clock3,
  Loader2,
  ShieldAlert,
  Store,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  lifecycleMfaRequired,
  verifyRecentLifecycleAal2,
} from "@/features/settings/model/store-lifecycle-mfa";
import {
  clearTenantScopedQueryCache,
  refreshStoreContextQueries,
} from "@/features/stores/api/tenant-cache";
import { storesKeys } from "@/features/stores/api/query-keys";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getStoreContext,
  getStoreLifecycleOperationStatus,
  getStoreLifecycleState,
  getStorePurgeRequest,
  issueStoreLifecycleChallenge,
  cancelStorePurgeRequest,
  confirmStorePurgeRequest,
  createStoreLifecyclePreflight,
  requestStorePurge,
  restoreStoreWorkspace,
} from "@/lib/repairdesk/api";
import type { ActorStoreMembership, StoreLifecycleActionCapability } from "@/lib/repairdesk/types";
import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";
import { RepairOsBusinessCard, RepairOsListScaffold } from "@/shared/ui";

export function ClosedStoresScreen() {
  const contextQuery = useQuery({
    queryKey: storesKeys.context,
    queryFn: ({ signal }) => getStoreContext({ signal }),
  });
  const recoveryStores = contextQuery.data?.recoveryStores ?? [];

  return (
    <RepairOsListScaffold
      title="已关闭与删除"
      subtitle="已关闭店铺可以恢复；永久删除必须经过冷静期、备份验证和二次身份确认。"
      eyebrow="设置 / 已关闭与删除"
    >
      <div className="mx-auto w-full max-w-3xl space-y-2 py-2 sm:space-y-3 sm:py-4">
        {contextQuery.isLoading ? (
          <RepairOsBusinessCard as="div" className="flex items-center gap-2 p-2.5 sm:gap-3 sm:p-4">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">正在读取店铺状态…</span>
          </RepairOsBusinessCard>
        ) : null}
        {contextQuery.isError ? (
          <RepairOsBusinessCard
            as="div"
            role="alert"
            className="border-status-danger-foreground/25 bg-status-danger/10 p-2.5 sm:p-4"
          >
            <p className="text-sm font-semibold">暂时无法读取已关闭店铺</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={() => contextQuery.refetch()}
            >
              重新加载
            </Button>
          </RepairOsBusinessCard>
        ) : null}
        {contextQuery.isSuccess && recoveryStores.length === 0 ? (
          <RepairOsBusinessCard as="div" className="p-3 text-center sm:p-5">
            <Store className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">没有可恢复的已关闭店铺</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              正常营业的店铺仍在店铺设置中管理。
            </p>
            <Button asChild type="button" variant="outline" className="mt-4">
              <Link href="/settings?section=store">返回店铺设置</Link>
            </Button>
          </RepairOsBusinessCard>
        ) : null}
        {recoveryStores.map((store) => (
          <ClosedStoreCard key={store.id} store={store} />
        ))}
      </div>
    </RepairOsListScaffold>
  );
}

function ClosedStoreCard({ store }: { store: ActorStoreMembership }) {
  const [restored, setRestored] = useState(false);
  const phase = store.lifecycle?.phase;
  const statusLabel =
    phase === "closing"
      ? "正在关闭，可以恢复"
      : phase === "archived"
        ? "已关闭，可以恢复或申请永久删除"
        : phase === "purge_scheduled"
          ? "永久删除已排程，尚未开始时可以取消"
          : phase === "purging"
            ? "正在永久清除，已不可恢复"
            : phase === "purge_failed"
              ? "永久清除已暂停，等待平台处理"
              : "店铺已关闭";
  const timestamp = store.lifecycle?.close_requested_at ?? store.lifecycle?.archived_at;
  return (
    <RepairOsBusinessCard as="div" role="region" aria-label={store.name} className="p-2.5 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold">{store.name}</p>
          <p className="mt-1 text-xs font-medium text-status-warn-foreground">{statusLabel}</p>
          {timestamp ? (
            <p className="mt-1 text-xs text-muted-foreground">
              关闭时间：{new Date(timestamp).toLocaleString("zh-CN")}
            </p>
          ) : null}
          <p className="mt-1 font-mono text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
            识别码尾号 {store.id.replaceAll("-", "").slice(-8)}
          </p>
        </div>
        {restored ? (
          <Button asChild type="button">
            <Link href="/">进入店铺</Link>
          </Button>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <StoreRestoreOverlay
              store={store}
              capability={
                store.lifecycleAccess?.restore ?? {
                  allowed: false,
                  code: "store_unavailable",
                }
              }
              onRestored={() => setRestored(true)}
            />
            {phase === "archived" ||
            phase === "purge_scheduled" ||
            phase === "purging" ||
            phase === "purge_failed" ? (
              <StorePurgeManager
                store={store}
                capability={
                  store.lifecycleAccess?.purge ?? {
                    allowed: false,
                    code: "store_unavailable",
                  }
                }
              />
            ) : null}
          </div>
        )}
      </div>
      {restored ? (
        <div
          role="status"
          className="mt-3 flex items-start gap-2 rounded-xl border border-status-success-foreground/25 bg-status-success/10 p-3 text-sm"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">店铺已恢复使用</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              旧邀请、旧链接、客户 iPad 凭据和已停用员工没有自动恢复。
            </p>
          </div>
        </div>
      ) : null}
    </RepairOsBusinessCard>
  );
}

function StorePurgeManager({
  store,
  capability,
}: {
  store: ActorStoreMembership;
  capability: StoreLifecycleActionCapability;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"request" | "confirm">("request");
  const [storeName, setStoreName] = useState("");
  const [uuidSuffix, setUuidSuffix] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [preflight, setPreflight] = useState<Awaited<
    ReturnType<typeof createStoreLifecyclePreflight>
  > | null>(null);
  const requestQuery = useQuery({
    queryKey: [...storesKeys.lifecycle(store.id), "purge-request"],
    queryFn: () => getStorePurgeRequest(store.id),
    enabled: capability.allowed,
    refetchInterval: 30_000,
  });
  const purgeRequest = requestQuery.data;
  const requiresTotp = lifecycleMfaRequired();
  const expectedSuffix = store.id.replaceAll("-", "").slice(-8);

  const begin = async (nextMode: "request" | "confirm") => {
    setMode(nextMode);
    setStoreName("");
    setUuidSuffix("");
    setTotpCode("");
    setAcknowledged(false);
    setPreflight(null);
    setOpen(true);
    try {
      setPreflight(await createStoreLifecyclePreflight(store.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "无法完成删除前安全预检");
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const lifecycle = preflight?.lifecycle ?? store.lifecycle;
      if (!preflight || !lifecycle) throw new Error("删除前安全预检尚未完成");
      await verifyRecentLifecycleAal2(totpCode);
      const operationKind = mode === "request" ? "request_purge" : "confirm_purge";
      const challenge = await issueStoreLifecycleChallenge({
        expectedStoreId: store.id,
        expectedRevision: lifecycle.revision,
        operationKind,
        preflightSnapshotHash: preflight.snapshot_hash,
      });
      const common = {
        expectedStoreId: store.id,
        expectedRevision: lifecycle.revision,
        reauthChallengeId: challenge.id,
        preflightSnapshotHash: preflight.snapshot_hash,
        confirmationStoreName: storeName,
        confirmationStoreIdSuffix: uuidSuffix,
      };
      if (mode === "confirm") {
        if (!purgeRequest) throw new Error("找不到待确认的永久删除申请");
        return confirmStorePurgeRequest({ ...common, requestId: purgeRequest.request_id });
      }
      return requestStorePurge(common);
    },
    onSuccess: async (result) => {
      queryClient.setQueryData([...storesKeys.lifecycle(store.id), "purge-request"], result);
      setOpen(false);
      toast.success(
        mode === "request"
          ? "永久删除申请已建立，可在冷静期内取消"
          : "最终确认已记录，后台将开始清除",
      );
      await refreshStoreContextQueries(queryClient);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "提交失败"),
  });

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!purgeRequest) throw new Error("找不到可取消的删除申请");
      return cancelStorePurgeRequest({
        expectedStoreId: store.id,
        requestId: purgeRequest.request_id,
      });
    },
    onSuccess: (result) => {
      queryClient.setQueryData([...storesKeys.lifecycle(store.id), "purge-request"], result);
      toast.success("永久删除申请已取消");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "取消失败"),
  });

  if (!capability.allowed) {
    return (
      <span className="max-w-52 text-right text-xs leading-5 text-muted-foreground">
        {capability.code === "feature_disabled" ? "永久删除功能尚未开放" : "当前无法申请永久删除"}
      </span>
    );
  }

  const cancellable =
    purgeRequest &&
    ["cooling", "preparing_export", "ready_for_confirmation", "scheduled"].includes(
      purgeRequest.state,
    ) &&
    !purgeRequest.destructive_step_started;
  const readyForConfirmation = purgeRequest?.state === "ready_for_confirmation";
  const ready =
    Boolean(preflight) &&
    preflight?.state === "eligible" &&
    storeName === store.name &&
    uuidSuffix.toLowerCase() === expectedSuffix.toLowerCase() &&
    acknowledged &&
    (!requiresTotp || totpCode.length === 6) &&
    !submitMutation.isPending;

  return (
    <>
      {purgeRequest && purgeRequest.state !== "cancelled" && purgeRequest.state !== "completed" ? (
        <div className="w-full rounded-xl border border-status-warn-foreground/25 bg-status-warn/10 p-3 text-left sm:max-w-md">
          <div className="flex items-start gap-2">
            <Clock3 className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">{purgeStatusCopy(purgeRequest.state)}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                冷静期截止：{new Date(purgeRequest.cooling_until).toLocaleString("zh-CN")}
                {purgeRequest.export_state ? ` · 备份：${purgeRequest.export_state}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {cancellable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate()}
                  >
                    取消永久删除
                  </Button>
                ) : null}
                {readyForConfirmation ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => void begin("confirm")}
                  >
                    二次确认并永久删除
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Button type="button" variant="destructive" onClick={() => void begin("request")}>
          <Trash2 className="mr-1.5 size-4" />
          申请永久删除
        </Button>
      )}

      <Dialog open={open} onOpenChange={(next) => !submitMutation.isPending && setOpen(next)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === "request" ? "申请永久删除店铺" : "最终确认永久删除"}
            </DialogTitle>
            <DialogDescription>
              {mode === "request"
                ? "申请后至少等待 24 小时，期间可以取消。系统还会完成加密备份和恢复验证。"
                : "这是不可逆确认。后台开始清除后将无法恢复店铺、订单、客户、库存和附件。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <div className="rounded-xl border border-status-danger-foreground/25 bg-status-danger/10 p-3 text-xs leading-5">
              <p className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="size-4" />
                核对删除目标
              </p>
              <p className="mt-2">店铺：{store.name}</p>
              <p className="break-all font-mono">UUID：{store.id}</p>
              <p className="mt-1 text-muted-foreground">
                安全预检：
                {preflight ? (preflight.state === "eligible" ? "已通过" : "存在阻塞") : "正在检查…"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`purge-name-${store.id}`}>输入完整店铺名称</Label>
              <Input
                id={`purge-name-${store.id}`}
                value={storeName}
                autoComplete="off"
                onChange={(event) => setStoreName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`purge-suffix-${store.id}`}>输入 UUID 尾号 {expectedSuffix}</Label>
              <Input
                id={`purge-suffix-${store.id}`}
                value={uuidSuffix}
                maxLength={8}
                autoComplete="off"
                onChange={(event) =>
                  setUuidSuffix(event.target.value.replace(/[^0-9a-f]/gi, "").slice(0, 8))
                }
              />
            </div>
            {requiresTotp ? (
              <div className="space-y-1.5">
                <Label htmlFor={`purge-totp-${store.id}`}>身份验证器中的 6 位安全验证码</Label>
                <Input
                  id={`purge-totp-${store.id}`}
                  value={totpCode}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  onChange={(event) =>
                    setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
              </div>
            ) : null}
            <label className="flex items-start gap-2 text-xs leading-5">
              <input
                type="checkbox"
                className="mt-1"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              <span>我确认目标 UUID 正确，并理解后台开始清除后数据无法恢复。</span>
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitMutation.isPending}
              onClick={() => setOpen(false)}
            >
              返回
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!ready}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending
                ? "正在提交…"
                : mode === "request"
                  ? "建立删除申请"
                  : "确认永久删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function purgeStatusCopy(state: string) {
  switch (state) {
    case "cooling":
      return "永久删除冷静期中";
    case "preparing_export":
      return "正在准备加密备份";
    case "ready_for_confirmation":
      return "可以进行最终确认";
    case "scheduled":
      return "已最终确认，等待后台清除";
    case "purging":
      return "正在永久清除，已不可取消";
    case "failed":
      return "后台清除暂停，需要平台处理";
    default:
      return "永久删除处理中";
  }
}

function StoreRestoreOverlay({
  store,
  capability,
  onRestored,
}: {
  store: ActorStoreMembership;
  capability: StoreLifecycleActionCapability;
  onRestored: () => void;
}) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [operationId, setOperationId] = useState("");
  const [persistentError, setPersistentError] = useState("");
  const requestSentRef = useRef(false);
  const lifecycleQuery = useQuery({
    queryKey: storesKeys.lifecycle(store.id),
    queryFn: () => getStoreLifecycleState(store.id),
    enabled: open && capability.allowed,
  });

  useEffect(() => {
    if (!open) return;
    setTotpCode("");
    setPersistentError("");
    requestSentRef.current = false;
    setOperationId(crypto.randomUUID());
  }, [open]);

  const finishRestore = async (result: Awaited<ReturnType<typeof restoreStoreWorkspace>>) => {
    queryClient.setQueryData(storesKeys.lifecycle(store.id), result.lifecycle);
    await clearTenantScopedQueryCache(queryClient);
    await refreshStoreContextQueries(queryClient);
    setOpen(false);
    onRestored();
    toast.success("店铺已恢复使用");
    router.refresh();
  };

  const reconcileRestore = async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const status = await getStoreLifecycleOperationStatus({
          expectedStoreId: store.id,
          operationId,
        });
        if (status.state === "completed" && status.lifecycle) {
          await finishRestore({
            operation_id: operationId,
            replayed: true,
            lifecycle: status.lifecycle,
            ...(status.next_active_store_id
              ? { next_active_store_id: status.next_active_store_id }
              : {}),
          });
          return;
        }
        if (status.state === "failed") break;
      } catch {
        // The status read is safe to retry with the same operation id.
      }
      await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
    }
    const message = "暂时无法确认恢复结果。请稍后刷新本页，不要重复提交恢复请求。";
    setPersistentError(message);
    toast.error(message);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const lifecycle = lifecycleQuery.data ?? store.lifecycle;
      if (!lifecycle) throw new Error("店铺状态还没有读取完成");
      await verifyRecentLifecycleAal2(totpCode);
      const challenge = await issueStoreLifecycleChallenge({
        expectedStoreId: store.id,
        expectedRevision: lifecycle.revision,
        operationKind: "restore",
      });
      requestSentRef.current = true;
      return restoreStoreWorkspace({
        expectedStoreId: store.id,
        expectedRevision: lifecycle.revision,
        operationId,
        reauthChallengeId: challenge.id,
      });
    },
    onSuccess: finishRestore,
    onError: async (error) => {
      if (requestSentRef.current && operationId) {
        await reconcileRestore();
        return;
      }
      const message = error instanceof Error ? error.message : "恢复店铺失败";
      setPersistentError(message);
      toast.error(message);
    },
    onSettled: () => setTotpCode(""),
  });
  const requiresTotp = lifecycleMfaRequired();
  const ready =
    capability.allowed &&
    Boolean(lifecycleQuery.data ?? store.lifecycle) &&
    Boolean(operationId) &&
    (!requiresTotp || totpCode.length === 6) &&
    !requestSentRef.current &&
    !mutation.isPending;

  if (!capability.allowed) {
    return (
      <div className="max-w-xs text-right text-xs leading-5 text-muted-foreground">
        {restoreUnavailableCopy(capability.code)}
      </div>
    );
  }

  const body = (
    <div className="space-y-2 sm:space-y-4">
      <div className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-2.5 text-xs sm:p-3 sm:text-sm">
        <p className="font-semibold">恢复后</p>
        <ul className="mt-1.5 space-y-1 text-xs leading-4 text-muted-foreground sm:mt-2 sm:space-y-1.5 sm:leading-5">
          <li>• 可以重新进入店铺并创建、修改业务资料</li>
          <li>• 现有订单、客户和库存资料继续保留</li>
          <li>• 旧邀请、旧链接、客户 iPad 凭据和已停用员工不会自动恢复</li>
        </ul>
      </div>
      {requiresTotp ? (
        <div className="space-y-1.5">
          <Label htmlFor={`store-restore-totp-${store.id}`}>身份验证器中的 6 位安全验证码</Label>
          <Input
            id={`store-restore-totp-${store.id}`}
            value={totpCode}
            className="min-h-11 text-base md:text-sm"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            disabled={mutation.isPending}
            onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </div>
      ) : null}
      {persistentError ? (
        <p role="alert" className="text-xs leading-5 text-status-danger-foreground">
          {persistentError}
        </p>
      ) : null}
    </div>
  );
  const footer = (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={mutation.isPending}
        onClick={() => setOpen(false)}
      >
        取消
      </Button>
      <Button type="button" disabled={!ready} onClick={() => mutation.mutate()}>
        {mutation.isPending ? "正在恢复…" : "确认恢复营业"}
      </Button>
    </>
  );

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <ArchiveRestore className="mr-1.5 size-4" />
        查看与恢复
      </Button>
      {isMobile ? (
        <Sheet
          open={open}
          onOpenChange={(next) => {
            if (!mutation.isPending) setOpen(next);
          }}
        >
          <SheetContent
            side="bottom"
            closeLabel="关闭恢复窗口"
            className={cn(componentOverlay.bottomSheet, "flex h-[min(88dvh,46rem)] flex-col gap-0")}
          >
            <SheetHeader className="shrink-0 pb-2 text-left sm:pb-3">
              <SheetTitle>恢复 {store.name}？</SheetTitle>
              <SheetDescription>店铺资料仍然保留，确认后可重新营业。</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto pb-2 sm:pb-4">{body}</div>
            <SheetFooter className="shrink-0 gap-1.5 border-t border-[var(--border-panel)] pt-2 sm:space-x-0 sm:gap-2 sm:pt-3">
              {footer}
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (!mutation.isPending) setOpen(next);
          }}
        >
          <DialogContent className={componentOverlay.modalSm} showCloseButton={!mutation.isPending}>
            <DialogHeader>
              <DialogTitle>恢复 {store.name}？</DialogTitle>
              <DialogDescription>店铺资料仍然保留，确认后可重新营业。</DialogDescription>
            </DialogHeader>
            {body}
            <DialogFooter className="gap-2 sm:space-x-0">{footer}</DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function restoreUnavailableCopy(code: StoreLifecycleActionCapability["code"]) {
  if (code === "feature_disabled") return "恢复功能正在准备中，目前不会改动店铺。";
  if (code === "enforcement_unhealthy") return "店铺写入保护尚未启用，当前不能恢复。";
  if (code === "migration_unavailable") return "店铺保护尚未安装完成，当前不能恢复。";
  if (code === "primary_owner_required") return "只有系统登记的店铺主账号可以恢复。";
  return "当前店铺暂时不能恢复。";
}
