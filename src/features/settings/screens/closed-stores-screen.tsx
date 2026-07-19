"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, CheckCircle2, Loader2, Store } from "lucide-react";
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
  issueStoreLifecycleChallenge,
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
      title="已关闭店铺"
      subtitle="这里的店铺资料仍然保留，店铺主账号可以恢复营业。"
      eyebrow="设置 / 已关闭店铺"
    >
      <div className="mx-auto w-full max-w-3xl space-y-3 py-4">
        {contextQuery.isLoading ? (
          <RepairOsBusinessCard as="div" className="flex items-center gap-3 p-4">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">正在读取店铺状态…</span>
          </RepairOsBusinessCard>
        ) : null}
        {contextQuery.isError ? (
          <RepairOsBusinessCard
            as="div"
            role="alert"
            className="border-status-danger-foreground/25 bg-status-danger/10 p-4"
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
          <RepairOsBusinessCard as="div" className="p-5 text-center">
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
  const statusLabel = phase === "closing" ? "正在关闭，可以恢复" : "已关闭，可以恢复";
  const timestamp = store.lifecycle?.close_requested_at ?? store.lifecycle?.archived_at;
  return (
    <RepairOsBusinessCard as="div" role="region" aria-label={store.name} className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold">{store.name}</p>
          <p className="mt-1 text-xs font-medium text-status-warn-foreground">{statusLabel}</p>
          {timestamp ? (
            <p className="mt-1 text-xs text-muted-foreground">
              关闭时间：{new Date(timestamp).toLocaleString("zh-CN")}
            </p>
          ) : null}
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            识别码尾号 {store.id.replaceAll("-", "").slice(-8)}
          </p>
        </div>
        {restored ? (
          <Button asChild type="button">
            <Link href="/">进入店铺</Link>
          </Button>
        ) : (
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
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3 text-sm">
        <p className="font-semibold">恢复后</p>
        <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
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
            <SheetHeader className="shrink-0 pb-3 text-left">
              <SheetTitle>恢复 {store.name}？</SheetTitle>
              <SheetDescription>店铺资料仍然保留，确认后可重新营业。</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto pb-4">{body}</div>
            <SheetFooter className="shrink-0 gap-2 border-t border-[var(--border-panel)] pt-3 sm:space-x-0">
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
