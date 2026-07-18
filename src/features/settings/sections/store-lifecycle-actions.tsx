"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, PencilLine, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clearTenantScopedQueryCache,
  refreshStoreContextQueries,
} from "@/features/stores/api/tenant-cache";
import { storesKeys } from "@/features/stores/api/query-keys";
import {
  getStoreLifecycleState,
  issueStoreLifecycleChallenge,
  renameStoreWorkspace,
  requestStoreClose,
  restoreStoreWorkspace,
} from "@/lib/repairdesk/api";
import type {
  ActorStoreMembership,
  StoreLifecycleChallengeKind,
  StoreLifecyclePreflight,
} from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";

export function StoreLifecycleActions({
  store,
  preflight,
}: {
  store: ActorStoreMembership;
  preflight?: StoreLifecyclePreflight;
}) {
  const queryClient = useQueryClient();
  const [renameName, setRenameName] = useState(store.name);
  const [syncCustomerName, setSyncCustomerName] = useState(true);
  const [closeName, setCloseName] = useState("");
  const [closeSuffix, setCloseSuffix] = useState("");
  const [closeReason, setCloseReason] = useState("duplicate_store");
  const [totpCode, setTotpCode] = useState("");
  const [actionError, setActionError] = useState("");
  const lifecycleQuery = useQuery({
    queryKey: storesKeys.lifecycle(store.id),
    queryFn: () => getStoreLifecycleState(store.id),
  });
  const lifecycle = lifecycleQuery.data ?? preflight?.lifecycle;
  const expectedSuffix = store.id.replaceAll("-", "").slice(-8);

  useEffect(() => setRenameName(store.name), [store.id, store.name]);
  useEffect(() => {
    setCloseName("");
    setCloseSuffix("");
    setTotpCode("");
    setActionError("");
  }, [store.id]);

  const mutation = useMutation({
    mutationFn: async (request: LifecycleUiAction) => {
      if (!lifecycle) throw new Error("生命周期状态尚未加载");
      await verifyRecentAal2(totpCode);
      setTotpCode("");
      const operationKind: StoreLifecycleChallengeKind =
        request.kind === "close" ? "request_close" : request.kind;
      const challenge = await issueStoreLifecycleChallenge({
        expectedStoreId: store.id,
        expectedRevision: lifecycle.revision,
        operationKind,
        ...(request.kind === "close" && preflight
          ? { preflightSnapshotHash: preflight.snapshot_hash }
          : {}),
      });
      const base = {
        expectedStoreId: store.id,
        expectedRevision: lifecycle.revision,
        operationId: crypto.randomUUID(),
        reauthChallengeId: challenge.id,
      };
      if (request.kind === "rename") {
        return renameStoreWorkspace({
          ...base,
          name: renameName,
          syncCustomerFacingName: syncCustomerName,
        });
      }
      if (request.kind === "close") {
        if (!preflight) throw new Error("关闭店铺前需要重新运行安全预检");
        return requestStoreClose({
          ...base,
          preflightSnapshotHash: preflight.snapshot_hash,
          confirmationStoreName: closeName,
          confirmationStoreIdSuffix: closeSuffix,
          reasonCode: closeReason,
        });
      }
      return restoreStoreWorkspace(base);
    },
    onMutate: () => setActionError(""),
    onSuccess: async (result, request) => {
      setTotpCode("");
      queryClient.setQueryData(storesKeys.lifecycle(store.id), result.lifecycle);
      if (request.kind === "close") await clearTenantScopedQueryCache(queryClient);
      await refreshStoreContextQueries(queryClient);
      toast.success(
        request.kind === "rename"
          ? "工作区名称已更新"
          : request.kind === "close"
            ? "店铺已进入可恢复关闭流程"
            : "店铺已恢复，旧邀请和 Kiosk 凭据不会自动复活",
      );
    },
    onError: (error) => {
      setTotpCode("");
      const message = error instanceof Error ? error.message : "店铺生命周期操作失败";
      setActionError(message);
      toast.error(message);
    },
  });

  const closeReady = useMemo(
    () =>
      preflight?.state === "eligible" &&
      preflight.store_id === store.id &&
      preflight.lifecycle.revision === lifecycle?.revision &&
      Date.parse(preflight.expires_at) > Date.now() &&
      closeName === store.name &&
      closeSuffix.toLowerCase() === expectedSuffix.toLowerCase() &&
      closeReason.trim().length >= 2,
    [
      closeName,
      closeReason,
      closeSuffix,
      expectedSuffix,
      lifecycle?.revision,
      preflight,
      store.id,
      store.name,
    ],
  );
  const requiresTotp = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const actionDisabled =
    mutation.isPending || !lifecycle || (requiresTotp && totpCode.length !== 6);

  return (
    <div
      className="space-y-3 border-t border-[var(--border-panel)] pt-3"
      data-store-lifecycle-actions
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-semibold">
          当前阶段：{lifecycle ? lifecyclePhaseLabel(lifecycle.phase) : "读取中"}
        </span>
        {lifecycle ? (
          <span className="text-muted-foreground">revision {lifecycle.revision}</span>
        ) : null}
      </div>

      {lifecycle?.phase === "active" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <LifecycleActionPanel icon={PencilLine} title="完整工作区重命名">
            <label className="space-y-1 text-[11px] font-medium" htmlFor="lifecycle-rename-name">
              新工作区名称
              <Input
                id="lifecycle-rename-name"
                value={renameName}
                maxLength={80}
                onChange={(event) => setRenameName(event.target.value)}
              />
            </label>
            <label className="flex items-start gap-2 text-[11px] leading-4">
              <input
                type="checkbox"
                checked={syncCustomerName}
                onChange={(event) => setSyncCustomerName(event.target.checked)}
              />
              同步收据、打印和客户消息中的店铺名称
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={
                actionDisabled || renameName.trim().length < 2 || renameName.trim() === store.name
              }
              onClick={() => mutation.mutate({ kind: "rename" })}
            >
              {mutation.isPending ? "处理中…" : "安全重命名"}
            </Button>
          </LifecycleActionPanel>

          <LifecycleActionPanel icon={ShieldAlert} title="可恢复关闭" danger>
            <p className="text-[11px] leading-4 text-muted-foreground">
              关闭会立即冻结写入并撤销邀请与 Kiosk 凭据；至少等待一小时后才归档。
            </p>
            <Input
              aria-label="输入当前工作区名称确认关闭"
              placeholder={`输入 ${store.name}`}
              value={closeName}
              onChange={(event) => setCloseName(event.target.value)}
            />
            <Input
              aria-label="输入店铺 UUID 尾号确认关闭"
              placeholder={`UUID 尾号 ${expectedSuffix}`}
              value={closeSuffix}
              maxLength={8}
              onChange={(event) => setCloseSuffix(event.target.value)}
            />
            <label className="space-y-1 text-[11px] font-medium">
              关闭原因
              <Select value={closeReason} onValueChange={setCloseReason}>
                <SelectTrigger aria-label="关闭原因">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="duplicate_store">重复或误创建的店铺</SelectItem>
                  <SelectItem value="business_closed">停止营业</SelectItem>
                  <SelectItem value="temporary_closure">暂时停业</SelectItem>
                  <SelectItem value="other">其他原因</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <Button
              type="button"
              variant="destructive"
              disabled={actionDisabled || !closeReady}
              onClick={() => mutation.mutate({ kind: "close" })}
            >
              {mutation.isPending ? "处理中…" : "确认进入关闭流程"}
            </Button>
          </LifecycleActionPanel>
        </div>
      ) : null}

      {lifecycle?.phase === "closing" || lifecycle?.phase === "archived" ? (
        <LifecycleActionPanel icon={ArchiveRestore} title="恢复店铺">
          <p className="text-[11px] leading-4 text-muted-foreground">
            恢复业务访问不会恢复已撤销的邀请码、邀请链接、Kiosk Token 或配对码。
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={actionDisabled}
            onClick={() => mutation.mutate({ kind: "restore" })}
          >
            {mutation.isPending ? "恢复中…" : "安全恢复店铺"}
          </Button>
        </LifecycleActionPanel>
      ) : null}

      {lifecycle &&
      ["purge_scheduled", "purging", "purge_failed", "purged"].includes(lifecycle.phase) ? (
        <div className="rounded-lg border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2 text-[11px] leading-4">
          当前阶段不能通过浏览器恢复或清除；永久清除只由审批锁定的后台 worker 执行。
        </div>
      ) : null}

      {requiresTotp ? (
        <label className="block space-y-1 text-[11px] font-medium" htmlFor="lifecycle-totp-code">
          双重验证码（操作后立即清空）
          <Input
            id="lifecycle-totp-code"
            value={totpCode}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="6 位验证码"
            onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </label>
      ) : null}

      {lifecycleQuery.isError ? (
        <p role="alert" className="text-[11px] text-status-danger-foreground">
          无法读取生命周期状态：
          {lifecycleQuery.error instanceof Error ? lifecycleQuery.error.message : "未知错误"}
        </p>
      ) : null}
      {actionError ? (
        <p role="alert" className="text-[11px] text-status-danger-foreground">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}

type LifecycleUiAction = { kind: "rename" | "close" | "restore" };

function LifecycleActionPanel({
  icon: Icon,
  title,
  danger = false,
  children,
}: {
  icon: typeof PencilLine;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "space-y-2 rounded-xl border p-3",
        danger
          ? "border-status-danger-foreground/20 bg-status-danger/5"
          : "border-[var(--border-panel)] bg-[var(--surface-panel-muted)]",
      )}
    >
      <h3 className="flex items-center gap-2 text-xs font-semibold">
        <Icon className="size-4" aria-hidden="true" />
        {title}
      </h3>
      {children}
    </section>
  );
}

async function verifyRecentAal2(code: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
  if (!/^\d{6}$/.test(code)) throw new Error("请输入 6 位双重验证码");
  const supabase = createClient();
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) throw new Error("读取双重验证方式失败");
  const factor = factors.totp[0];
  if (!factor) throw new Error("当前账号尚未设置已验证的 TOTP 双重验证");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) throw new Error("双重验证码无效或已过期");
}

function lifecyclePhaseLabel(phase: string) {
  return (
    {
      active: "正常营业",
      closing: "关闭冷静期",
      archived: "已归档",
      purge_scheduled: "已安排永久清除",
      purging: "永久清除中",
      purge_failed: "清除失败待复核",
      purged: "已永久清除",
    }[phase] ?? phase
  );
}
