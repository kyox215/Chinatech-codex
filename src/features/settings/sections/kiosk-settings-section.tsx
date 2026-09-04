"use client";

import { useEffect, useMemo, useRef, useState, type ElementType, type RefObject } from "react";
import {
  Check,
  Clock3,
  Copy,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TabletSmartphone,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { RepairOsBusinessCard, RepairOsSectionHeader } from "@/shared/ui";
import { kioskReturnDraftKey } from "@/features/settings/model/kiosk-return-draft";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import type { KioskDevice, KioskSession } from "@/lib/repairdesk/types";
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

export interface KioskPairingDisplay {
  code: string;
  expiresAt: string;
  deviceLabel: string;
  storeName: string;
}

export interface KioskSettingsSectionProps {
  storeName: string;
  devices: KioskDevice[];
  sessions: KioskSession[];
  pairing?: KioskPairingDisplay;
  canManageDevices: boolean;
  canReviewSessions: boolean;
  devicesLoading: boolean;
  devicesError: boolean;
  sessionsLoading: boolean;
  sessionsError: boolean;
  returnReasons: Record<string, string>;
  onRetryDevices: () => void;
  onRetrySessions: () => void;
  onReturnReasonChange: (session: KioskSession, value: string) => void;
  onReturnReasonConsumed: (session: KioskSession) => void;
  onCreatePairing: (label: string) => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
  onAcceptSession: (session: KioskSession) => Promise<void>;
  onReturnSession: (session: KioskSession, reason: string) => Promise<void>;
  onCopyCode: () => void;
}

type ConfirmTarget =
  | { kind: "revoke"; device: KioskDevice }
  | { kind: "accept"; session: KioskSession }
  | { kind: "return"; session: KioskSession; reason: string };

export function KioskSettingsSection({
  storeName,
  devices,
  sessions,
  pairing,
  canManageDevices,
  canReviewSessions,
  devicesLoading,
  devicesError,
  sessionsLoading,
  sessionsError,
  returnReasons,
  onRetryDevices,
  onRetrySessions,
  onReturnReasonChange,
  onReturnReasonConsumed,
  onCreatePairing,
  onRevoke,
  onAcceptSession,
  onReturnSession,
  onCopyCode,
}: KioskSettingsSectionProps) {
  const { copy } = useOperationsCopy();
  const [deviceLabel, setDeviceLabel] = useState("前台 iPad");
  const [pairingPending, setPairingPending] = useState(false);
  const pairingPendingRef = useRef(false);
  const [pairingError, setPairingError] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const confirmPendingRef = useRef(false);
  const [confirmError, setConfirmError] = useState("");
  const confirmErrorRef = useRef<HTMLParagraphElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onReturnReasonChangeRef = useRef(onReturnReasonChange);
  onReturnReasonChangeRef.current = onReturnReasonChange;
  const activeDevices = useMemo(
    () => devices.filter((device) => device.status === "active"),
    [devices],
  );
  const submittedSessions = useMemo(
    () => sessions.filter((session) => session.status === "submitted"),
    [sessions],
  );
  const recentSessions = useMemo(
    () =>
      sessions
        .filter((session) =>
          ["accepted", "returned", "cancelled", "expired"].includes(session.status),
        )
        .slice(0, 5),
    [sessions],
  );
  const deviceSummary = canManageDevices
    ? copy("{count} 台已授权", { count: activeDevices.length })
    : copy("设备无管理权限");
  const reviewSummary = canReviewSessions
    ? copy("{count} 项待审核", { count: submittedSessions.length })
    : copy("审核无权限");

  useEffect(() => {
    if (!confirmError) return;
    const frame = requestAnimationFrame(() => confirmErrorRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [confirmError]);

  useEffect(() => {
    if (!canManageDevices) {
      setPairingError("");
      setConfirmTarget((current) => (current?.kind === "revoke" ? null : current));
    }
  }, [canManageDevices]);

  useEffect(() => {
    if (!canReviewSessions) {
      setConfirmError("");
      setConfirmTarget((current) =>
        current?.kind === "accept" || current?.kind === "return" ? null : current,
      );
      for (const session of sessions) {
        if (returnReasons[kioskReturnDraftKey(session)]) {
          onReturnReasonChangeRef.current(session, "");
        }
      }
    }
  }, [canReviewSessions, returnReasons, sessions]);

  const createPairing = async () => {
    const label = deviceLabel.trim();
    if (!canManageDevices || !label || pairingPendingRef.current) return;
    pairingPendingRef.current = true;
    setPairingPending(true);
    setPairingError("");
    try {
      await onCreatePairing(label);
    } catch {
      setPairingError(copy("生成配对码失败，请重试"));
    } finally {
      pairingPendingRef.current = false;
      setPairingPending(false);
    }
  };

  const closeConfirm = () => {
    setConfirmTarget(null);
    setConfirmError("");
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  };

  const submitConfirmedAction = async () => {
    if (!confirmTarget || confirmPendingRef.current) return;
    if (confirmTarget.kind === "revoke" && !canManageDevices) return;
    if (confirmTarget.kind !== "revoke" && !canReviewSessions) return;
    confirmPendingRef.current = true;
    setConfirmPending(true);
    setConfirmError("");
    try {
      if (confirmTarget.kind === "revoke") await onRevoke(confirmTarget.device.id);
      if (confirmTarget.kind === "accept") {
        await onAcceptSession(confirmTarget.session);
        onReturnReasonConsumed(confirmTarget.session);
      }
      if (confirmTarget.kind === "return") {
        await onReturnSession(confirmTarget.session, confirmTarget.reason);
        onReturnReasonConsumed(confirmTarget.session);
      }
      closeConfirm();
    } catch {
      setConfirmError(copy("操作失败，请重试"));
    } finally {
      confirmPendingRef.current = false;
      setConfirmPending(false);
    }
  };

  const openConfirm = (target: ConfirmTarget, trigger: HTMLElement) => {
    if (confirmPendingRef.current) return;
    returnFocusRef.current = trigger;
    setConfirmError("");
    setConfirmTarget(target);
  };

  return (
    <section id="settings-kiosk" className={cn(repairOs.adminSection, "p-3 sm:p-4")}>
      <RepairOsSectionHeader
        icon={TabletSmartphone}
        iconFrame={false}
        title={copy("客户 iPad")}
        description={`${storeName} · ${deviceSummary} · ${reviewSummary}`}
      />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
        <div className="grid min-w-0 content-start gap-4">
          <KioskPairingPanel
            pairing={canManageDevices ? pairing : undefined}
            canManage={canManageDevices}
            deviceLabel={deviceLabel}
            pending={pairingPending}
            error={pairingError}
            onDeviceLabelChange={setDeviceLabel}
            onCreate={() => void createPairing()}
            onCopyCode={onCopyCode}
          />
          <KioskDeviceList
            devices={devices}
            canManage={canManageDevices}
            loading={devicesLoading}
            error={devicesError}
            onRetry={onRetryDevices}
            onRevoke={(device, trigger) => openConfirm({ kind: "revoke", device }, trigger)}
          />
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <KioskReviewQueue
            sessions={submittedSessions}
            canReview={canReviewSessions}
            loading={sessionsLoading}
            error={sessionsError}
            returnReasons={returnReasons}
            onRetry={onRetrySessions}
            onReasonChange={onReturnReasonChange}
            onAccept={(session, trigger) => openConfirm({ kind: "accept", session }, trigger)}
            onReturn={(session, reason, trigger) =>
              openConfirm({ kind: "return", session, reason }, trigger)
            }
          />
          <KioskRecentActivity
            sessions={recentSessions}
            canReview={canReviewSessions}
            loading={sessionsLoading}
            error={sessionsError}
          />
        </div>
      </div>

      <KioskActionConfirm
        target={confirmTarget}
        pending={confirmPending}
        error={confirmError}
        errorRef={confirmErrorRef}
        onOpenChange={(open) => {
          if (!open && !confirmPendingRef.current) closeConfirm();
        }}
        onCancel={closeConfirm}
        onConfirm={() => void submitConfirmedAction()}
      />
    </section>
  );
}

function KioskPairingPanel({
  pairing,
  canManage,
  deviceLabel,
  pending,
  error,
  onDeviceLabelChange,
  onCreate,
  onCopyCode,
}: {
  pairing?: KioskPairingDisplay;
  canManage: boolean;
  deviceLabel: string;
  pending: boolean;
  error: string;
  onDeviceLabelChange: (value: string) => void;
  onCreate: () => void;
  onCopyCode: () => void;
}) {
  const { copy } = useOperationsCopy();
  const remaining = usePairingCountdown(pairing?.expiresAt);
  return (
    <div className="grid min-w-0 gap-3 rounded-xl border border-[var(--border-panel)] bg-card p-3 shadow-[var(--shadow-card)]">
      <div>
        <p className="text-sm font-semibold">{copy("设备配对")}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {copy("配对码只显示本次，15 分钟后过期。不会通过短信或邮件自动发送。")}
        </p>
      </div>

      {canManage ? (
        <div className="grid gap-2">
          <Label htmlFor="kiosk-device-label">{copy("新 iPad 名称")}</Label>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              id="kiosk-device-label"
              className="h-[38px] min-h-11 text-base sm:min-h-10 sm:text-sm"
              value={deviceLabel}
              maxLength={80}
              disabled={pending}
              onChange={(event) => onDeviceLabelChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onCreate();
                }
              }}
            />
            <Button
              type="button"
              className="min-h-11 sm:min-h-10"
              disabled={pending || !deviceLabel.trim()}
              onClick={onCreate}
            >
              <Plus className="size-4" />
              {pending ? copy("正在生成") : copy("生成配对码")}
            </Button>
          </div>
        </div>
      ) : (
        <PermissionNotice label={copy("当前账号不能生成或撤销客户 iPad。")} />
      )}

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-status-danger/10 px-3 py-2 text-sm text-status-danger-foreground"
        >
          {error}
        </p>
      ) : null}

      {pairing ? (
        <div className="grid min-w-0 gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-primary">{copy("本次配对码")}</p>
              <p
                data-kiosk-pairing-code
                className="mt-1 break-all font-mono text-2xl font-semibold tracking-[0.12em]"
              >
                {pairing.code}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 sm:min-h-9"
              onClick={onCopyCode}
            >
              <Copy className="size-4" /> {copy("复制")}
            </Button>
          </div>
          <dl className="grid gap-1 text-xs text-muted-foreground">
            <div className="flex min-w-0 justify-between gap-3">
              <dt>{copy("目标店铺")}</dt>
              <dd className="min-w-0 break-words text-right font-medium text-foreground">
                {pairing.storeName}
              </dd>
            </div>
            <div className="flex min-w-0 justify-between gap-3">
              <dt>{copy("目标设备")}</dt>
              <dd className="min-w-0 break-words text-right font-medium text-foreground">
                {pairing.deviceLabel}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>{copy("剩余时间")}</dt>
              <dd className="inline-flex items-center gap-1 font-mono font-medium text-foreground">
                <Clock3 className="size-3.5" /> {remaining}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}

function KioskDeviceList({
  devices,
  canManage,
  loading,
  error,
  onRetry,
  onRevoke,
}: {
  devices: KioskDevice[];
  canManage: boolean;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onRevoke: (device: KioskDevice, trigger: HTMLElement) => void;
}) {
  const { locale, copy } = useOperationsCopy();
  return (
    <div className="grid min-w-0 gap-2">
      <SectionTitle label={copy("设备列表")} count={devices.length} />
      {!canManage ? (
        <PermissionNotice label={copy("当前账号没有设备管理权限，页面不会请求或显示设备资料。")} />
      ) : loading ? (
        <DomainSkeleton />
      ) : error ? (
        <DomainError label={copy("设备读取失败")} onRetry={onRetry} />
      ) : devices.length ? (
        <div className="grid min-w-0 gap-2">
          {devices.map((device) => (
            <RepairOsBusinessCard
              key={device.id}
              as="div"
              data-kiosk-device-id={device.id}
              className="grid-cols-1 gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              trailing={
                device.status !== "revoked" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 text-destructive hover:text-destructive"
                    onClick={(event) => onRevoke(device, event.currentTarget)}
                  >
                    {copy("撤销设备")}
                  </Button>
                ) : null
              }
              trailingClassName="min-w-0"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <TabletSmartphone className="size-4" />
                </span>
                <p className="min-w-0 break-words text-sm font-semibold">{device.label}</p>
                <Badge variant={device.status === "active" ? "default" : "outline"}>
                  {kioskDeviceStatusLabel(device, locale)}
                </Badge>
              </div>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                {device.last_seen_at
                  ? copy("最后连接 {date}", {
                      date: formatKioskDateTime(device.last_seen_at, locale),
                    })
                  : device.paired_at
                    ? copy("已配对 {date}", {
                        date: formatKioskDateTime(device.paired_at, locale),
                      })
                    : copy("尚未完成配对")}
              </p>
            </RepairOsBusinessCard>
          ))}
        </div>
      ) : (
        <EmptyBlock label={copy("当前店铺暂无 iPad 设备")} />
      )}
    </div>
  );
}

function KioskReviewQueue({
  sessions,
  canReview,
  loading,
  error,
  returnReasons,
  onRetry,
  onReasonChange,
  onAccept,
  onReturn,
}: {
  sessions: KioskSession[];
  canReview: boolean;
  loading: boolean;
  error: boolean;
  returnReasons: Record<string, string>;
  onRetry: () => void;
  onReasonChange: (session: KioskSession, value: string) => void;
  onAccept: (session: KioskSession, trigger: HTMLElement) => void;
  onReturn: (session: KioskSession, reason: string, trigger: HTMLElement) => void;
}) {
  const { copy } = useOperationsCopy();
  return (
    <div className="grid min-w-0 gap-2">
      <SectionTitle
        label={copy("待员工审核")}
        count={sessions.length}
        important={sessions.length > 0}
      />
      {!canReview ? (
        <PermissionNotice
          label={copy("当前账号没有客户提交审核权限，页面不会请求或显示提交内容。")}
        />
      ) : loading ? (
        <DomainSkeleton />
      ) : error ? (
        <DomainError label={copy("审核任务读取失败")} onRetry={onRetry} />
      ) : sessions.length ? (
        <div className="grid min-w-0 gap-3">
          {sessions.map((session) => {
            const reason = returnReasons[kioskReturnDraftKey(session)] ?? "";
            return (
              <KioskReviewCard
                key={`${session.id}:${session.submission_version}`}
                session={session}
                reason={reason}
                onReasonChange={(value) => onReasonChange(session, value)}
                onAccept={(trigger) => onAccept(session, trigger)}
                onReturn={(trigger) => onReturn(session, reason.trim(), trigger)}
              />
            );
          })}
        </div>
      ) : (
        <EmptyBlock label={copy("暂无待审核提交")} />
      )}
    </div>
  );
}

function KioskReviewCard({
  session,
  reason,
  onReasonChange,
  onAccept,
  onReturn,
}: {
  session: KioskSession;
  reason: string;
  onReasonChange: (value: string) => void;
  onAccept: (trigger: HTMLElement) => void;
  onReturn: (trigger: HTMLElement) => void;
}) {
  const { locale, copy } = useOperationsCopy();
  const orderNo = kioskPayloadText(session.request_payload, "order_public_no");
  const deviceLabel = kioskPayloadText(session.request_payload, "device_label");
  const customerName = kioskPayloadText(session.submission_payload, "customer_name");
  const customerPhone = kioskPayloadText(session.submission_payload, "customer_phone");
  const backupPhone = kioskPayloadText(session.submission_payload, "backup_phone");
  const note = kioskPayloadText(session.submission_payload, "note");
  const hasSignature = session.submission_payload?.has_signature === true;
  const confirmed = session.submission_payload?.confirmation_checked === true;

  return (
    <article
      data-kiosk-review-id={session.id}
      className="min-w-0 rounded-xl border border-primary/20 bg-card p-3 shadow-[var(--shadow-card)]"
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="break-words text-sm font-semibold">
              {kioskSessionTypeLabel(session.session_type, locale)}
            </h3>
            <Badge>{copy("待审核")}</Badge>
          </div>
          <p className="mt-1 break-words text-xs text-muted-foreground">
            {session.device?.label ?? copy("客户 iPad")}
            {orderNo ? ` · ${copy("工单 {order}", { order: orderNo })}` : ""}
            {deviceLabel ? ` · ${deviceLabel}` : ""}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {session.submitted_at
            ? formatKioskDateTime(session.submitted_at, locale)
            : copy("刚提交")}
        </p>
      </div>

      <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
        <KioskReviewField label={copy("姓名")} value={customerName} />
        <KioskReviewField label={copy("电话")} value={customerPhone} icon={Phone} />
        <KioskReviewField label={copy("备用电话")} value={backupPhone} />
        <KioskReviewField
          label={copy("客户确认")}
          value={confirmed ? copy("已勾选") : copy("未勾选")}
        />
        <KioskReviewField
          label={copy("签名")}
          value={hasSignature ? copy("已签名") : copy("未签名")}
        />
        <KioskReviewField label={copy("备注")} value={note} icon={MessageSquare} wide />
      </div>

      <div className="mt-3 grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`kiosk-return-${session.id}`}>{copy("给客户的退回原因")}</Label>
          <span className="text-xs text-muted-foreground">{reason.length}/240</span>
        </div>
        <Textarea
          id={`kiosk-return-${session.id}`}
          className="min-h-24 text-base sm:text-sm"
          value={reason}
          maxLength={240}
          placeholder={copy("例如：电话号码不清楚，请客户重新填写")}
          onChange={(event) => onReasonChange(event.target.value)}
        />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 sm:min-h-9"
          disabled={!reason.trim()}
          onClick={(event) => onReturn(event.currentTarget)}
        >
          <RotateCcw className="size-4" /> {copy("退回重填")}
        </Button>
        <Button
          type="button"
          className="min-h-11 sm:min-h-10"
          onClick={(event) => onAccept(event.currentTarget)}
        >
          <Check className="size-4" /> {copy("接受并更新")}
        </Button>
      </div>
    </article>
  );
}

function KioskRecentActivity({
  sessions,
  canReview,
  loading,
  error,
}: {
  sessions: KioskSession[];
  canReview: boolean;
  loading: boolean;
  error: boolean;
}) {
  const { locale, copy } = useOperationsCopy();
  if (!canReview || loading || error) return null;
  return (
    <div className="grid min-w-0 gap-2">
      <SectionTitle label={copy("最近处理")} count={sessions.length} />
      {sessions.length ? (
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="min-w-0 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2"
            >
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <p className="break-words text-xs font-semibold">
                  {kioskSessionTypeLabel(session.session_type, locale)}
                </p>
                <Badge variant="outline">{kioskSessionStatusLabel(session.status, locale)}</Badge>
              </div>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                {session.device?.label ?? copy("客户 iPad")} ·{" "}
                {formatKioskDateTime(session.updated_at, locale)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyBlock label={copy("暂无最近处理记录")} />
      )}
    </div>
  );
}

function KioskActionConfirm({
  target,
  pending,
  error,
  errorRef,
  onOpenChange,
  onCancel,
  onConfirm,
}: {
  target: ConfirmTarget | null;
  pending: boolean;
  error: string;
  errorRef: RefObject<HTMLParagraphElement | null>;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { copy } = useOperationsCopy();
  const title =
    target?.kind === "revoke"
      ? copy("撤销这台客户 iPad？")
      : target?.kind === "return"
        ? copy("确认退回给客户重填？")
        : copy("确认接受客户提交？");
  const description =
    target?.kind === "revoke"
      ? copy("撤销后，此设备 token 会立即失效；已有任务和历史记录仍会保留。")
      : target?.kind === "return"
        ? copy("客户会看到退回原因：“{reason}”。提交内容不会在这里静默修改。", {
            reason: target.reason,
          })
        : copy("接受后会更新绑定的客户资料，并在有签名时写入工单附件。");

  return (
    <AlertDialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="break-words">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="rounded-lg bg-status-danger/10 px-3 py-2 text-sm text-status-danger-foreground"
          >
            {copy("操作失败，请重试")}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-12" disabled={pending} onClick={onCancel}>
            {copy("取消")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className={cn(
              "min-h-12",
              target?.kind === "revoke" && "bg-destructive text-destructive-foreground",
            )}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {pending
              ? copy("正在处理")
              : target?.kind === "revoke"
                ? copy("确认撤销")
                : copy("确认提交")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DomainSkeleton() {
  return (
    <div className="grid gap-2" aria-busy="true">
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  );
}

function DomainError({ label, onRetry }: { label: string; onRetry: () => void }) {
  const { copy } = useOperationsCopy();
  return (
    <RepairOsBusinessCard
      as="div"
      role="alert"
      className="grid-cols-1 gap-2 border-status-danger-foreground/25 bg-status-danger/10 px-3 py-3 text-status-danger-foreground sm:grid-cols-[minmax(0,1fr)_auto]"
      trailing={
        <Button type="button" variant="outline" className="min-h-11 sm:min-h-9" onClick={onRetry}>
          <RefreshCw className="size-4" /> {copy("重新读取")}
        </Button>
      }
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs">{copy("另一类 iPad 数据不受影响。")}</p>
    </RepairOsBusinessCard>
  );
}

function PermissionNotice({ label }: { label: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-xl border border-[var(--border-panel)] bg-card px-3 py-3 text-sm text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0" />
      <p className="min-w-0 break-words">{label}</p>
    </div>
  );
}

function SectionTitle({
  label,
  count,
  important = false,
}: {
  label: string;
  count: number;
  important?: boolean;
}) {
  const { copy } = useOperationsCopy();
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-xs font-semibold text-muted-foreground">{label}</h2>
      <Badge variant={important ? "default" : "outline"}>{count}</Badge>
    </div>
  );
}

function KioskReviewField({
  label,
  value,
  icon: Icon,
  wide = false,
}: {
  label: string;
  value?: string;
  icon?: ElementType;
  wide?: boolean;
}) {
  const { copy } = useOperationsCopy();
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2 py-2",
        wide && "sm:col-span-2",
      )}
    >
      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {Icon ? <Icon className="size-3.5" /> : null}
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">
        {value || copy("未填写")}
      </p>
    </div>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="grid min-h-20 place-items-center rounded-xl border border-dashed border-[var(--border-panel)] bg-card px-3 py-5 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function usePairingCountdown(expiresAt?: string) {
  const { copy } = useOperationsCopy();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);
  if (!expiresAt) return "--:--";
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  const totalSeconds = Math.floor(remaining / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return remaining > 0 ? `${minutes}:${String(seconds).padStart(2, "0")}` : copy("已过期");
}

function kioskPayloadText(payload: Record<string, unknown> | undefined, key: string) {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function kioskDeviceStatusLabel(device: KioskDevice, locale: AppLocale) {
  if (
    device.status === "pairing" &&
    device.pairing_code_expires_at &&
    new Date(device.pairing_code_expires_at).getTime() <= Date.now()
  ) {
    return translateSettingsOperations(locale, "配对已过期");
  }
  const labels = {
    pairing: "配对中",
    active: "已授权",
    suspended: "已暂停",
    revoked: "已撤销",
  } as const satisfies Record<
    KioskDevice["status"],
    Parameters<typeof translateSettingsOperations>[1]
  >;
  return translateSettingsOperations(locale, labels[device.status]);
}

function kioskSessionTypeLabel(type: KioskSession["session_type"], locale: AppLocale) {
  const labels = {
    intake_contact: "客户资料",
    order_contact_signature: "工单资料",
    pickup_signature: "取机确认",
  } as const satisfies Record<
    KioskSession["session_type"],
    Parameters<typeof translateSettingsOperations>[1]
  >;
  return translateSettingsOperations(locale, labels[type]);
}

function kioskSessionStatusLabel(status: KioskSession["status"], locale: AppLocale) {
  const labels = {
    queued: "等待",
    active: "填写中",
    submitted: "已提交",
    accepted: "已接受",
    returned: "已退回",
    cancelled: "已取消",
    expired: "已过期",
  } as const satisfies Record<
    KioskSession["status"],
    Parameters<typeof translateSettingsOperations>[1]
  >;
  return translateSettingsOperations(locale, labels[status]);
}

export function formatKioskDateTime(value: string, locale: AppLocale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return translateSettingsOperations(locale, "时间不可用");
  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(date);
}
