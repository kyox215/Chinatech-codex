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
import { StorePurgeManager } from "@/features/settings/sections/store-purge-manager";
import { useLocale } from "@/shared/i18n/locale-provider";
import { translateSettingsOperations } from "@/shared/i18n/messages";
import type { AppLocale } from "@/shared/i18n/locales";

function useOperationsCopy() {
  const { locale } = useLocale();
  return {
    locale,
    copy: (
      source: Parameters<typeof translateSettingsOperations>[1],
      values?: Record<string, string | number>,
    ) => translateSettingsOperations(locale, source, values),
  };
}

export function ClosedStoresScreen() {
  const { copy } = useOperationsCopy();
  const contextQuery = useQuery({
    queryKey: storesKeys.context,
    queryFn: ({ signal }) => getStoreContext({ signal }),
  });
  const recoveryStores = contextQuery.data?.recoveryStores ?? [];

  return (
    <RepairOsListScaffold
      title={copy("已关闭与删除")}
      subtitle={copy("已关闭店铺可以恢复；永久删除必须经过冷静期、备份验证和二次身份确认。")}
      eyebrow={copy("设置 / 已关闭与删除")}
    >
      <div className="mx-auto w-full max-w-3xl space-y-2 py-2 sm:space-y-3 sm:py-4">
        {contextQuery.isLoading ? (
          <RepairOsBusinessCard as="div" className="flex items-center gap-2 p-2.5 sm:gap-3 sm:p-4">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">{copy("正在读取店铺状态…")}</span>
          </RepairOsBusinessCard>
        ) : null}
        {contextQuery.isError ? (
          <RepairOsBusinessCard
            as="div"
            role="alert"
            className="border-status-danger-foreground/25 bg-status-danger/10 p-2.5 sm:p-4"
          >
            <p className="text-sm font-semibold">{copy("暂时无法读取已关闭店铺")}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={() => contextQuery.refetch()}
            >
              {copy("重新加载")}
            </Button>
          </RepairOsBusinessCard>
        ) : null}
        {contextQuery.isSuccess && recoveryStores.length === 0 ? (
          <RepairOsBusinessCard as="div" className="p-3 text-center sm:p-5">
            <Store className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">{copy("没有可恢复的已关闭店铺")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {copy("正常营业的店铺仍在店铺设置中管理。")}
            </p>
            <Button asChild type="button" variant="outline" className="mt-4">
              <Link href="/settings?section=store">{copy("返回店铺设置")}</Link>
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
  const { locale, copy } = useOperationsCopy();
  const [restored, setRestored] = useState(false);
  const phase = store.lifecycle?.phase;
  const statusLabel =
    phase === "closing"
      ? copy("正在关闭，可以恢复")
      : phase === "archived"
        ? copy("已关闭，可以恢复或申请永久删除")
        : phase === "purge_scheduled"
          ? copy("永久删除已排程，尚未开始时可以取消")
          : phase === "purging"
            ? copy("正在永久清除，已不可恢复")
            : phase === "purge_failed"
              ? copy("永久清除已暂停，等待平台处理")
              : copy("店铺已关闭");
  const timestamp = store.lifecycle?.close_requested_at ?? store.lifecycle?.archived_at;
  return (
    <RepairOsBusinessCard as="div" role="region" aria-label={store.name} className="p-2.5 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold">{store.name}</p>
          <p className="mt-1 text-xs font-medium text-status-warn-foreground">{statusLabel}</p>
          {timestamp ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {copy("关闭时间：{date}", { date: formatClosedStoreTimestamp(timestamp, locale) })}
            </p>
          ) : null}
          <p className="mt-1 font-mono text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
            {copy("识别码尾号 {suffix}", {
              suffix: store.id.replaceAll("-", "").slice(-8),
            })}
          </p>
        </div>
        {restored ? (
          <Button asChild type="button">
            <Link href="/">{copy("进入店铺")}</Link>
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
            <p className="font-semibold">{copy("店铺已恢复使用")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {copy("旧邀请、旧链接、客户 iPad 凭据和已停用员工没有自动恢复。")}
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
  const { copy } = useOperationsCopy();
  const isMobile = useIsMobile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [operationId, setOperationId] = useState("");
  const [persistentError, setPersistentError] = useState("");
  const requestSentRef = useRef(false);
  const restoreSubmittingRef = useRef(false);
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
    restoreSubmittingRef.current = false;
    setOperationId(crypto.randomUUID());
  }, [open]);

  useEffect(() => {
    if (capability.allowed) return;
    setOpen(false);
    setTotpCode("");
    setOperationId("");
  }, [capability.allowed]);

  const finishRestore = async (result: Awaited<ReturnType<typeof restoreStoreWorkspace>>) => {
    queryClient.setQueryData(storesKeys.lifecycle(store.id), result.lifecycle);
    await clearTenantScopedQueryCache(queryClient);
    await refreshStoreContextQueries(queryClient);
    setOpen(false);
    onRestored();
    toast.success(copy("店铺已恢复使用"));
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
    const message = copy("暂时无法确认恢复结果。请稍后刷新本页，不要重复提交恢复请求。");
    setPersistentError(message);
    toast.error(message);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const lifecycle = lifecycleQuery.data ?? store.lifecycle;
      if (!lifecycle) throw new Error(copy("店铺状态还没有读取完成"));
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
    onError: async (_error) => {
      if (requestSentRef.current && operationId) {
        await reconcileRestore();
        return;
      }
      const message = copy("恢复店铺失败");
      setPersistentError(message);
      toast.error(message);
    },
    onSettled: () => {
      restoreSubmittingRef.current = false;
      setTotpCode("");
    },
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
        {restoreUnavailableCopy(capability.code, copy)}
      </div>
    );
  }

  const body = (
    <div className="space-y-2 sm:space-y-4">
      <div className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-2.5 text-xs sm:p-3 sm:text-sm">
        <p className="font-semibold">{copy("恢复后")}</p>
        <ul className="mt-1.5 space-y-1 text-xs leading-4 text-muted-foreground sm:mt-2 sm:space-y-1.5 sm:leading-5">
          <li>{copy("• 可以重新进入店铺并创建、修改业务资料")}</li>
          <li>{copy("• 现有订单、客户和库存资料继续保留")}</li>
          <li>{copy("• 旧邀请、旧链接、客户 iPad 凭据和已停用员工不会自动恢复")}</li>
        </ul>
      </div>
      {requiresTotp ? (
        <div className="space-y-1.5">
          <Label htmlFor={`store-restore-totp-${store.id}`}>
            {copy("身份验证器中的 6 位安全验证码")}
          </Label>
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
        {copy("取消")}
      </Button>
      <Button
        type="button"
        disabled={!ready}
        onClick={() => {
          if (restoreSubmittingRef.current) return;
          restoreSubmittingRef.current = true;
          mutation.mutate();
        }}
      >
        {mutation.isPending ? copy("正在恢复…") : copy("确认恢复营业")}
      </Button>
    </>
  );

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <ArchiveRestore className="mr-1.5 size-4" />
        {copy("查看与恢复")}
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
            closeLabel={copy("关闭恢复窗口")}
            className={cn(componentOverlay.bottomSheet, "flex h-[min(88dvh,46rem)] flex-col gap-0")}
          >
            <SheetHeader className="shrink-0 pb-2 text-left sm:pb-3">
              <SheetTitle>{copy("恢复 {store}？", { store: store.name })}</SheetTitle>
              <SheetDescription>{copy("店铺资料仍然保留，确认后可重新营业。")}</SheetDescription>
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
          <DialogContent
            className={componentOverlay.modalSm}
            closeLabel={copy("关闭")}
            showCloseButton={!mutation.isPending}
          >
            <DialogHeader>
              <DialogTitle>{copy("恢复 {store}？", { store: store.name })}</DialogTitle>
              <DialogDescription>{copy("店铺资料仍然保留，确认后可重新营业。")}</DialogDescription>
            </DialogHeader>
            {body}
            <DialogFooter className="gap-2 sm:space-x-0">{footer}</DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function restoreUnavailableCopy(
  code: StoreLifecycleActionCapability["code"],
  copy: ReturnType<typeof useOperationsCopy>["copy"],
) {
  if (code === "feature_disabled") return copy("恢复功能正在准备中，目前不会改动店铺。");
  if (code === "enforcement_unhealthy") return copy("店铺写入保护尚未启用，当前不能恢复。");
  if (code === "migration_unavailable") return copy("店铺保护尚未安装完成，当前不能恢复。");
  if (code === "primary_owner_required") return copy("只有系统登记的店铺主账号可以恢复。");
  return copy("当前店铺暂时不能恢复。");
}

export function formatClosedStoreTimestamp(value: string, locale: AppLocale) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return translateSettingsOperations(locale, "时间不可用");
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(timestamp);
}
