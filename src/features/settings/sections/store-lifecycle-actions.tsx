"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  lifecycleMfaRequired,
  verifyRecentLifecycleAal2,
} from "@/features/settings/model/store-lifecycle-mfa";
import {
  StoreCloseConfirmOverlay,
  StoreCloseImpactList,
} from "@/features/settings/sections/store-close-confirm-overlay";
import {
  formatRemaining,
  getStoreIdSuffix,
  LifecycleUnavailable,
  PersistentCloseResult,
  StepCard,
  StoreCloseBlockerList,
} from "@/features/settings/sections/store-lifecycle-close-status";
import {
  clearTenantScopedQueryCache,
  refreshStoreContextQueries,
} from "@/features/stores/api/tenant-cache";
import { storesKeys } from "@/features/stores/api/query-keys";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getStoreLifecycleOperationStatus,
  getStoreLifecycleState,
  issueStoreLifecycleChallenge,
  requestStoreClose,
} from "@/lib/repairdesk/api";
import type {
  ActorStoreMembership,
  StoreLifecycleActionCapability,
  StoreLifecycleMutationResult,
  StoreLifecyclePreflight,
} from "@/lib/repairdesk/types";
import { useLocale } from "@/shared/i18n/locale-provider";
import { translateSettingsOperations } from "@/shared/i18n/messages";

interface StoreLifecycleActionsProps {
  store: ActorStoreMembership;
  capability: StoreLifecycleActionCapability;
  preflight?: StoreLifecyclePreflight;
  isPreflighting: boolean;
  preflightError?: string;
  onRunPreflight: () => void;
}

export function StoreLifecycleActions({
  store,
  capability,
  preflight,
  isPreflighting,
  preflightError,
  onRunPreflight,
}: StoreLifecycleActionsProps) {
  const { locale } = useLocale();
  const copy = (
    source: Parameters<typeof translateSettingsOperations>[1],
    values?: Record<string, string | number>,
  ) => translateSettingsOperations(locale, source, values);
  const router = useRouter();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [now, setNow] = useState(() => Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [suffix, setSuffix] = useState("");
  const [reason, setReason] = useState("business_closed");
  const [acknowledged, setAcknowledged] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [operationId, setOperationId] = useState("");
  const [persistentResult, setPersistentResult] = useState<
    "idle" | "reconciling" | "success" | "unknown"
  >("idle");
  const [persistentError, setPersistentError] = useState("");
  const requestSentRef = useRef(false);
  const closeSubmittingRef = useRef(false);
  const lifecycleQuery = useQuery({
    queryKey: storesKeys.lifecycle(store.id),
    queryFn: () => getStoreLifecycleState(store.id),
    enabled: capability.allowed,
  });
  const lifecycle = lifecycleQuery.data ?? preflight?.lifecycle ?? store.lifecycle;
  const expectedSuffix = getStoreIdSuffix(store.id);
  const preflightMatches =
    preflight?.store_id === store.id && preflight.lifecycle.revision === lifecycle?.revision;
  const expiresAt = preflight ? Date.parse(preflight.expires_at) : 0;
  const preflightExpired = Boolean(preflight && expiresAt <= now);
  const validEligible = preflightMatches && preflight?.state === "eligible" && !preflightExpired;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setConfirmOpen(false);
    setSuffix("");
    setTotpCode("");
    setAcknowledged(false);
    setOperationId("");
    setPersistentResult("idle");
    setPersistentError("");
    requestSentRef.current = false;
    closeSubmittingRef.current = false;
  }, [store.id, lifecycle?.revision]);

  useEffect(() => {
    if (preflightExpired) {
      setConfirmOpen(false);
      setSuffix("");
      setTotpCode("");
      setAcknowledged(false);
    }
  }, [preflightExpired]);

  const finishClose = async (result: StoreLifecycleMutationResult) => {
    queryClient.setQueryData(storesKeys.lifecycle(store.id), result.lifecycle);
    await clearTenantScopedQueryCache(queryClient);
    await refreshStoreContextQueries(queryClient);
    setPersistentResult("success");
    setConfirmOpen(false);
    setTotpCode("");
    toast.success(copy("店铺已进入可恢复关闭流程"));
    if (result.active_store_cleared) {
      router.replace("/settings/closed-stores");
      router.refresh();
    }
  };

  const reconcileOperation = async () => {
    setPersistentResult("reconciling");
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const status = await getStoreLifecycleOperationStatus({
          expectedStoreId: store.id,
          operationId,
        });
        if (status.state === "completed" && status.lifecycle) {
          await finishClose({
            operation_id: operationId,
            replayed: true,
            lifecycle: status.lifecycle,
            ...(status.next_active_store_id
              ? { next_active_store_id: status.next_active_store_id }
              : {}),
            ...(status.active_store_cleared ? { active_store_cleared: true } : {}),
          });
          return;
        }
        if (status.state === "failed") break;
      } catch {
        // Keep the same operation id and retry only the read-only status check.
      }
      await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
    }
    setPersistentResult("unknown");
    setPersistentError("unknown");
  };

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!lifecycle || !preflight || !validEligible) {
        throw new Error(copy("检查结果已过期，请重新检查"));
      }
      await verifyRecentLifecycleAal2(totpCode);
      const challenge = await issueStoreLifecycleChallenge({
        expectedStoreId: store.id,
        expectedRevision: lifecycle.revision,
        operationKind: "request_close",
        preflightSnapshotHash: preflight.snapshot_hash,
      });
      requestSentRef.current = true;
      return requestStoreClose({
        expectedStoreId: store.id,
        expectedRevision: lifecycle.revision,
        operationId,
        reauthChallengeId: challenge.id,
        preflightSnapshotHash: preflight.snapshot_hash,
        confirmationStoreName: preflight.store_name,
        confirmationStoreIdSuffix: suffix.toLowerCase(),
        reasonCode: reason,
      });
    },
    onSuccess: finishClose,
    onError: async (error) => {
      setTotpCode("");
      if (requestSentRef.current && operationId) {
        await reconcileOperation();
        return;
      }
      const message = copy("关闭店铺失败");
      setPersistentError(message);
      toast.error(message);
    },
    onSettled: () => {
      closeSubmittingRef.current = false;
    },
  });

  const openConfirmation = () => {
    if (!validEligible) return;
    setSuffix("");
    setTotpCode("");
    setAcknowledged(false);
    setPersistentError("");
    setOperationId(crypto.randomUUID());
    requestSentRef.current = false;
    setConfirmOpen(true);
  };

  const requiresTotp = lifecycleMfaRequired();
  const closeReady =
    validEligible &&
    suffix.toLowerCase() === expectedSuffix &&
    acknowledged &&
    reason.length >= 2 &&
    Boolean(operationId) &&
    (!requiresTotp || totpCode.length === 6) &&
    !closeMutation.isPending;

  if (!capability.allowed) {
    return <LifecycleUnavailable capability={capability} />;
  }

  if (persistentResult !== "idle") {
    return (
      <PersistentCloseResult
        state={persistentResult}
        error={persistentError}
        onCheckAgain={() => void reconcileOperation()}
      />
    );
  }

  return (
    <div className="space-y-3" data-store-lifecycle-actions>
      {!preflight && !isPreflighting && !preflightError ? (
        <StepCard
          icon={ShieldCheck}
          title={copy("先检查是否可以关闭")}
          description={copy("检查只会读取未完成工单、欠款和仍在店里的设备，不会修改任何资料。")}
        >
          <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={onRunPreflight}>
            {copy("检查是否可以关闭")}
          </Button>
        </StepCard>
      ) : null}

      {isPreflighting ? (
        <StepCard
          icon={Loader2}
          iconClassName="animate-spin"
          title={copy("正在检查店铺…")}
          description={copy("这通常只需要几秒钟。检查期间不会关闭店铺。")}
        />
      ) : null}

      {preflightError ? (
        <StepCard
          icon={AlertTriangle}
          tone="danger"
          title={copy("暂时无法完成检查")}
          description={copy("没有对店铺做任何更改。你可以稍后重新检查。")}
        >
          <p role="alert" className="text-xs text-status-danger-foreground">
            {copy("店铺安全预检失败，请重试")}
          </p>
          <Button type="button" variant="outline" onClick={onRunPreflight}>
            {copy("重新检查")}
          </Button>
        </StepCard>
      ) : null}

      {preflight && preflightExpired ? (
        <StepCard
          icon={Clock3}
          tone="warn"
          title={copy("检查结果已过期")}
          description={copy("为了防止关错店铺，需要重新检查最新情况。")}
        >
          <Button type="button" variant="outline" onClick={onRunPreflight}>
            {copy("重新检查")}
          </Button>
        </StepCard>
      ) : null}

      {preflight && !preflightExpired && preflight.state === "blocked" ? (
        <StepCard
          icon={AlertTriangle}
          tone="warn"
          title={copy("这家店现在还不能关闭")}
          description={copy("请先处理以下事项，完成后再重新检查。")}
        >
          <StoreCloseBlockerList blockers={preflight.blockers} />
          <Button type="button" variant="outline" onClick={onRunPreflight}>
            {copy("处理后重新检查")}
          </Button>
        </StepCard>
      ) : null}

      {preflight && validEligible ? (
        <StepCard
          icon={CheckCircle2}
          tone="success"
          title={copy("可以继续关闭")}
          description={copy("检查结果还可使用 {time}。", {
            time: formatRemaining(expiresAt - now, locale),
          })}
        >
          <StoreCloseImpactList preflight={preflight} />
          <Button type="button" variant="destructive" onClick={openConfirmation}>
            {copy("继续关闭")}
          </Button>
        </StepCard>
      ) : null}

      {persistentError ? (
        <p role="alert" className="text-sm text-status-danger-foreground">
          {copy("关闭店铺失败")}
        </p>
      ) : null}

      <StoreCloseConfirmOverlay
        mobile={isMobile}
        open={confirmOpen}
        store={store}
        suffix={suffix}
        reason={reason}
        acknowledged={acknowledged}
        totpCode={totpCode}
        requiresTotp={requiresTotp}
        pending={closeMutation.isPending}
        ready={closeReady}
        onOpenChange={(next) => {
          if (!closeMutation.isPending) setConfirmOpen(next);
        }}
        onSuffixChange={setSuffix}
        onReasonChange={setReason}
        onAcknowledgedChange={setAcknowledged}
        onTotpChange={setTotpCode}
        onConfirm={() => {
          if (closeSubmittingRef.current) return;
          closeSubmittingRef.current = true;
          closeMutation.mutate();
        }}
      />
    </div>
  );
}
