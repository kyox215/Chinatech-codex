"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  ShieldCheck,
  Store,
  UserPlus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  approveOnboardingRequest,
  listPlatformOnboardingRequests,
  rejectOnboardingRequest,
  type OnboardingRequest,
} from "@/lib/repairdesk/api";
import {
  RepairOsBusinessCard,
  RepairOsInfoTile,
  RepairOsListScaffold,
  RepairOsMetricStrip,
  RepairOsSectionHeader,
} from "@/shared/ui";
import { brandGradientStyle, controls, density, repairOs } from "@/lib/ui-patterns";
import { componentOverlay } from "@/lib/component-patterns";
import { platformKeys } from "@/features/platform/api/query-keys";
import {
  buildOnboardingQueueSummary,
  sortOnboardingRequests,
} from "@/features/platform/model/onboarding-queue";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { APP_TIME_ZONE, type AppLocale } from "@/shared/i18n/locales";

const platformCopy = {
  "zh-CN": {
    approved: "已批准申请",
    approveFailed: "批准失败",
    rejected: "已拒绝申请",
    rejectFailed: "拒绝失败",
    rejectReason: "拒绝申请需要填写原因",
    pending: "待审核",
    pendingShort: "审",
    createStore: "创建店铺",
    createShort: "店",
    joinStore: "加入店铺",
    joinShort: "员",
    platformAdmin: "平台管理员",
    close: "关闭平台申请",
    allRequests: "全部申请",
    newStore: "新门店",
    memberJoin: "成员加入",
    queueClear: "审批队列已清空",
    noRequests: "暂无新店铺或成员加入申请。",
    checkStore: "先核对店铺名称，再批准创建店铺。",
    checkRole: "核对目标店铺和角色后批准加入。",
    earliest: "最早等待 {wait} · 优先处理最早提交申请",
    noWait: "无等待",
    pendingTitle: "待处理申请",
    pendingDescription: "审核后账号才可进入对应店铺工作台",
    reload: "重新加载",
    loadFailed: "审批队列加载失败",
    readFailed: "读取审批列表失败",
    empty: "暂无待审核申请",
    emptyHint: "新店铺和成员加入申请会显示在这里。",
    applicant: "申请人",
    type: "类型",
    target: "目标",
    role: "角色",
    time: "时间",
    actions: "操作",
    handle: "处理",
    targetPrefix: "目标：",
    rolePrefix: "角色：",
    viewHandle: "查看并处理",
    dialogTitle: "处理平台申请",
    dialogDescription: "先核对申请人、目标店铺和角色，再批准或拒绝。拒绝申请必须填写原因。",
    email: "邮箱",
    reviewScope: "审核范围",
    storeOwner: "店铺负责人",
    platform: "平台",
    requestedRole: "申请角色",
    requestNote: "申请备注",
    submittedAt: "提交时间",
    decisionNote: "审批备注 / 拒绝原因",
    notePlaceholder: "例如：已电话核对店铺；或说明拒绝原因。",
    noteHint: "批准备注可选；拒绝申请时必须填写，方便后续追踪。",
    reject: "拒绝",
    approve: "批准",
    rejectRequired: "拒绝申请前需要填写原因",
    newTarget: "新店铺",
    pendingOwner: "待负责人确认",
    dateUnavailable: "时间不可用",
    owner: "店主",
    manager: "经理",
    technician: "维修",
    sales: "前台/销售",
    viewer: "只读",
  },
  "it-IT": {
    approved: "Richiesta approvata",
    approveFailed: "Approvazione non riuscita",
    rejected: "Richiesta rifiutata",
    rejectFailed: "Rifiuto non riuscito",
    rejectReason: "Inserisci un motivo per rifiutare la richiesta",
    pending: "Da verificare",
    pendingShort: "Ver.",
    createStore: "Crea negozio",
    createShort: "Neg.",
    joinStore: "Entra nel negozio",
    joinShort: "Mem.",
    platformAdmin: "Amministratore piattaforma",
    close: "Chiudi richiesta piattaforma",
    allRequests: "Tutte le richieste",
    newStore: "Nuovo negozio",
    memberJoin: "Nuovo membro",
    queueClear: "Coda approvazioni vuota",
    noRequests: "Nessuna nuova richiesta di negozio o membro.",
    checkStore: "Verifica il nome del negozio prima di approvarne la creazione.",
    checkRole: "Verifica negozio e ruolo prima di approvare l’accesso.",
    earliest: "Attesa più lunga: {wait} · gestisci prima la richiesta meno recente",
    noWait: "Nessuna attesa",
    pendingTitle: "Richieste da gestire",
    pendingDescription: "L’account potrà entrare nel negozio solo dopo l’approvazione",
    reload: "Ricarica",
    loadFailed: "Caricamento coda approvazioni non riuscito",
    readFailed: "Lettura delle richieste non riuscita",
    empty: "Nessuna richiesta da verificare",
    emptyHint: "Le richieste di nuovi negozi e membri appariranno qui.",
    applicant: "Richiedente",
    type: "Tipo",
    target: "Destinazione",
    role: "Ruolo",
    time: "Data",
    actions: "Azioni",
    handle: "Gestisci",
    targetPrefix: "Destinazione:",
    rolePrefix: "Ruolo:",
    viewHandle: "Visualizza e gestisci",
    dialogTitle: "Gestisci richiesta piattaforma",
    dialogDescription:
      "Verifica richiedente, negozio e ruolo prima di approvare o rifiutare. Il rifiuto richiede un motivo.",
    email: "Email",
    reviewScope: "Ambito revisione",
    storeOwner: "Responsabile negozio",
    platform: "Piattaforma",
    requestedRole: "Ruolo richiesto",
    requestNote: "Nota richiesta",
    submittedAt: "Invio",
    decisionNote: "Nota di approvazione / motivo del rifiuto",
    notePlaceholder:
      "Ad esempio: negozio verificato telefonicamente; oppure indica il motivo del rifiuto.",
    noteHint:
      "La nota di approvazione è facoltativa; il motivo del rifiuto è obbligatorio per la tracciabilità.",
    reject: "Rifiuta",
    approve: "Approva",
    rejectRequired: "Inserisci un motivo prima di rifiutare",
    newTarget: "Nuovo negozio",
    pendingOwner: "In attesa del responsabile",
    dateUnavailable: "Data non disponibile",
    owner: "Titolare",
    manager: "Responsabile",
    technician: "Tecnico",
    sales: "Accettazione/vendite",
    viewer: "Sola lettura",
  },
  en: {
    approved: "Request approved",
    approveFailed: "Approval failed",
    rejected: "Request rejected",
    rejectFailed: "Rejection failed",
    rejectReason: "Enter a reason to reject the request",
    pending: "Pending review",
    pendingShort: "Review",
    createStore: "Create store",
    createShort: "Store",
    joinStore: "Join store",
    joinShort: "Member",
    platformAdmin: "Platform administrator",
    close: "Close platform request",
    allRequests: "All requests",
    newStore: "New store",
    memberJoin: "Member join",
    queueClear: "Approval queue is clear",
    noRequests: "No new store or member requests.",
    checkStore: "Verify the store name before approving creation.",
    checkRole: "Verify the target store and role before approving access.",
    earliest: "Oldest wait {wait} · handle the earliest request first",
    noWait: "No wait",
    pendingTitle: "Requests to review",
    pendingDescription: "Accounts can enter the store workspace only after approval",
    reload: "Reload",
    loadFailed: "Could not load the approval queue",
    readFailed: "Could not read the approval list",
    empty: "No requests awaiting review",
    emptyHint: "New store and member join requests will appear here.",
    applicant: "Applicant",
    type: "Type",
    target: "Target",
    role: "Role",
    time: "Time",
    actions: "Actions",
    handle: "Review",
    targetPrefix: "Target:",
    rolePrefix: "Role:",
    viewHandle: "View and review",
    dialogTitle: "Review platform request",
    dialogDescription:
      "Verify the applicant, target store, and role before approving or rejecting. Rejections require a reason.",
    email: "Email",
    reviewScope: "Review scope",
    storeOwner: "Store owner",
    platform: "Platform",
    requestedRole: "Requested role",
    requestNote: "Request note",
    submittedAt: "Submitted",
    decisionNote: "Approval note / rejection reason",
    notePlaceholder: "For example: store verified by phone; or explain the rejection reason.",
    noteHint: "An approval note is optional; a rejection reason is required for follow-up.",
    reject: "Reject",
    approve: "Approve",
    rejectRequired: "Enter a reason before rejecting",
    newTarget: "New store",
    pendingOwner: "Awaiting owner confirmation",
    dateUnavailable: "Date unavailable",
    owner: "Owner",
    manager: "Manager",
    technician: "Technician",
    sales: "Front desk/sales",
    viewer: "Read-only",
  },
} as const;

export function PlatformAdminScreen() {
  const { locale, t } = useLocale();
  const copy = platformCopy[locale];
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<OnboardingRequest | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const requestsQuery = useQuery({
    queryKey: platformKeys.onboardingRequests,
    queryFn: listPlatformOnboardingRequests,
  });

  const approveMutation = useMutation({
    mutationFn: approveOnboardingRequest,
    onSuccess: async () => {
      toast.success(copy.approved);
      resetDecisionDialog();
      await queryClient.invalidateQueries({ queryKey: platformKeys.onboardingRequests });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : copy.approveFailed),
  });

  const rejectMutation = useMutation({
    mutationFn: rejectOnboardingRequest,
    onSuccess: async () => {
      toast.success(copy.rejected);
      resetDecisionDialog();
      await queryClient.invalidateQueries({ queryKey: platformKeys.onboardingRequests });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : copy.rejectFailed),
  });

  const requests = useMemo(
    () => sortOnboardingRequests(requestsQuery.data ?? []),
    [requestsQuery.data],
  );
  const summary = useMemo(() => buildOnboardingQueueSummary(requests), [requests]);
  const isDecisionBusy = approveMutation.isPending || rejectMutation.isPending;

  function openDecisionDialog(request: OnboardingRequest) {
    setSelectedRequest(request);
    setDecisionNote("");
  }

  function resetDecisionDialog() {
    setSelectedRequest(null);
    setDecisionNote("");
  }

  function approveSelectedRequest() {
    if (!selectedRequest) return;
    approveMutation.mutate({
      id: selectedRequest.id,
      note: decisionNote.trim() || undefined,
    });
  }

  function rejectSelectedRequest() {
    if (!selectedRequest) return;
    const note = decisionNote.trim();
    if (!note) {
      toast.error(copy.rejectReason);
      return;
    }
    rejectMutation.mutate({
      id: selectedRequest.id,
      note,
    });
  }

  return (
    <RepairOsListScaffold
      title={t("platform.title")}
      subtitle={t("platform.pendingCount", { count: requests.length })}
      eyebrow={t("page.systemPlatform")}
      chips={[
        {
          key: "pending",
          label: copy.pending,
          shortLabel: copy.pendingShort,
          count: requests.length,
        },
        {
          key: "create",
          label: copy.createStore,
          shortLabel: copy.createShort,
          count: summary.createStoreCount,
        },
        {
          key: "join",
          label: copy.joinStore,
          shortLabel: copy.joinShort,
          count: summary.joinStoreCount,
        },
      ]}
      desktopAction={
        <Badge variant="outline" className="gap-1.5">
          <ShieldCheck className="size-3.5" />
          {copy.platformAdmin}
        </Badge>
      }
      desktopHeaderAddon={
        <RepairOsMetricStrip
          className="lg:[&>div>p:last-child]:text-xs lg:[&>div>p:last-child]:leading-4"
          metrics={[
            {
              label: copy.pending,
              value: requests.length,
              hint: copy.allRequests,
              icon: ShieldCheck,
            },
            {
              label: copy.createStore,
              value: summary.createStoreCount,
              hint: copy.newStore,
              icon: Store,
              tone: "green",
            },
            {
              label: copy.joinStore,
              value: summary.joinStoreCount,
              hint: copy.memberJoin,
              icon: UserPlus,
              tone: "amber",
            },
          ]}
        />
      }
    >
      <section className={cn(repairOs.adminSection, "mt-3 p-3")}>
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-xl",
              summary.attentionTone === "danger"
                ? "bg-status-danger text-status-danger-foreground"
                : summary.attentionTone === "warn"
                  ? "bg-status-warn text-status-warn-foreground"
                  : "bg-status-info text-status-info-foreground",
            )}
          >
            <Clock3 className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {platformSummaryHeadline(requests, locale)}
            </p>
            <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
              {requests.length === 0
                ? copy.noRequests
                : summary.createStoreCount > 0
                  ? copy.checkStore
                  : copy.checkRole}
            </p>
          </div>
          <Badge
            variant="secondary"
            className="shrink-0 font-mono text-[11px] lg:text-xs lg:leading-4"
          >
            {formatPlatformWait(requests[0]?.created_at, locale)}
          </Badge>
        </div>
      </section>

      <section className={cn(repairOs.adminSection, "mt-3 overflow-hidden p-0")}>
        <RepairOsSectionHeader
          title={copy.pendingTitle}
          description={copy.pendingDescription}
          className="mb-0 border-b border-[var(--border-panel)] px-3 py-2.5"
          action={
            <Badge variant="secondary" className="font-mono text-[11px] lg:text-xs lg:leading-4">
              {requests.length}
            </Badge>
          }
        />
        {requestsQuery.isLoading ? (
          <div className="space-y-1.5 p-2.5 sm:space-y-2 sm:p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : requestsQuery.isError ? (
          <RepairOsBusinessCard
            as="div"
            data-ui="platform-onboarding-load-error"
            className="m-3 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2.5 text-status-danger-foreground shadow-none hover:bg-status-danger/10 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
            leading={
              <span className="grid size-8 place-items-center rounded-lg bg-status-danger/10">
                <AlertTriangle className="size-4" />
              </span>
            }
            trailing={
              <Button
                size="sm"
                variant="outline"
                className="h-8 bg-[var(--surface-workspace-strong)]"
                disabled={requestsQuery.isFetching}
                onClick={() => void requestsQuery.refetch()}
              >
                {copy.reload}
              </Button>
            }
            leadingClassName="self-center"
            trailingClassName="col-span-2 justify-self-start sm:col-span-1 sm:justify-self-end"
            aria-live="polite"
          >
            <span className="block text-sm font-semibold">{copy.loadFailed}</span>
            <span className="mt-0.5 block break-words text-xs leading-5 text-status-danger-foreground/80">
              {requestsQuery.error instanceof Error ? requestsQuery.error.message : copy.readFailed}
            </span>
          </RepairOsBusinessCard>
        ) : requests.length === 0 ? (
          <RepairOsBusinessCard
            as="div"
            data-ui="platform-onboarding-empty-state"
            className="m-3 grid-cols-[auto_minmax(0,1fr)] items-center rounded-xl border-dashed px-3 py-2.5 text-muted-foreground shadow-none"
            leading={
              <span className="grid size-8 place-items-center rounded-lg bg-[var(--surface-panel-muted)] text-primary">
                <ShieldCheck className="size-4" />
              </span>
            }
            leadingClassName="self-center"
          >
            <span className="block text-sm font-semibold text-foreground">{copy.empty}</span>
            <span className="mt-0.5 block truncate text-[11px] leading-4 lg:text-xs lg:leading-4">
              {copy.emptyHint}
            </span>
          </RepairOsBusinessCard>
        ) : (
          <>
            <div className="hidden min-w-0 max-w-full overflow-x-auto lg:block">
              <Table className={`${density.tableDense} min-w-[680px] table-fixed`}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">{copy.applicant}</TableHead>
                    <TableHead className="w-[92px]">{copy.type}</TableHead>
                    <TableHead>{copy.target}</TableHead>
                    <TableHead className="w-[76px]">{copy.role}</TableHead>
                    <TableHead className="w-[96px]">{copy.time}</TableHead>
                    <TableHead className="w-[116px] text-right">{copy.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <RequestRow
                      key={request.id}
                      request={request}
                      isBusy={isDecisionBusy}
                      onOpen={() => openDecisionDialog(request)}
                      locale={locale}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-1.5 p-2 lg:hidden">
              {requests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  isBusy={isDecisionBusy}
                  onOpen={() => openDecisionDialog(request)}
                  locale={locale}
                />
              ))}
            </div>
          </>
        )}
      </section>
      <OnboardingDecisionDialog
        request={selectedRequest}
        note={decisionNote}
        isBusy={isDecisionBusy}
        onNoteChange={setDecisionNote}
        onOpenChange={(open) => {
          if (!open && !isDecisionBusy) resetDecisionDialog();
        }}
        onApprove={approveSelectedRequest}
        onReject={rejectSelectedRequest}
        locale={locale}
      />
    </RepairOsListScaffold>
  );
}

function RequestRow({
  request,
  isBusy,
  onOpen,
  locale,
}: {
  request: OnboardingRequest;
  isBusy: boolean;
  onOpen: () => void;
  locale: AppLocale;
}) {
  const copy = platformCopy[locale];
  return (
    <TableRow>
      <TableCell className="min-w-0">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{request.display_name || request.email}</p>
          <p className="truncate text-xs text-muted-foreground">{request.email}</p>
        </div>
      </TableCell>
      <TableCell>
        <RequestTypeBadge request={request} locale={locale} />
      </TableCell>
      <TableCell className="min-w-0 truncate">{requestTarget(request, locale)}</TableCell>
      <TableCell className="truncate">{requestedRoleLabel(request, locale)}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {formatPlatformDate(request.created_at, locale)}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="outline" disabled={isBusy} onClick={onOpen}>
            <Eye className="size-4" />
            {copy.handle}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function RequestCard({
  request,
  isBusy,
  onOpen,
  locale,
}: {
  request: OnboardingRequest;
  isBusy: boolean;
  onOpen: () => void;
  locale: AppLocale;
}) {
  const copy = platformCopy[locale];
  return (
    <RepairOsBusinessCard
      className={cn(repairOs.businessCardDense, "grid-cols-[minmax(0,1fr)] gap-1.5 py-2")}
      bodyClassName="grid gap-1.5"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={repairOs.cardTitle}>{request.display_name || request.email}</p>
          <p className="truncate text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
            {request.email}
          </p>
        </div>
        <RequestTypeBadge request={request} locale={locale} />
      </div>
      <div className="grid min-w-0 gap-0.5 text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
        <p className="truncate">
          {copy.targetPrefix}
          {requestTarget(request, locale)}
        </p>
        <p className="truncate">
          {copy.rolePrefix}
          {requestedRoleLabel(request, locale)} · {formatPlatformDate(request.created_at, locale)}
        </p>
      </div>
      <div className="grid grid-cols-1">
        <Button
          size="sm"
          className={cn("h-8 gap-1.5", controls.brandButton)}
          style={brandGradientStyle}
          disabled={isBusy}
          onClick={onOpen}
        >
          <Eye className="size-3.5" />
          {copy.viewHandle}
        </Button>
      </div>
    </RepairOsBusinessCard>
  );
}

function OnboardingDecisionDialog({
  request,
  note,
  isBusy,
  onNoteChange,
  onOpenChange,
  onApprove,
  onReject,
  locale,
}: {
  request: OnboardingRequest | null;
  note: string;
  isBusy: boolean;
  onNoteChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
  locale: AppLocale;
}) {
  const copy = platformCopy[locale];
  const isRejectDisabled = isBusy || note.trim().length === 0;

  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={copy.close}
        className={cn(componentOverlay.modalMd, "max-h-[calc(100svh-24px)] gap-3 overflow-y-auto")}
      >
        <DialogHeader className="pr-9">
          <DialogTitle>{copy.dialogTitle}</DialogTitle>
          <DialogDescription>{copy.dialogDescription}</DialogDescription>
        </DialogHeader>

        {request ? (
          <div className="space-y-3">
            <div className="grid gap-2 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3 text-sm sm:grid-cols-2">
              <InfoLine label={copy.applicant} value={request.display_name || request.email} />
              <InfoLine label={copy.email} value={request.email} />
              <InfoLine label={copy.type} value={requestTypeLabel(request, locale)} />
              <InfoLine label={copy.target} value={requestTarget(request, locale)} />
              <InfoLine
                label={copy.reviewScope}
                value={request.review_scope === "store" ? copy.storeOwner : copy.platform}
              />
              <InfoLine label={copy.requestedRole} value={requestedRoleLabel(request, locale)} />
              <InfoLine label={copy.requestNote} value={request.request_note || "-"} />
              <InfoLine
                label={copy.submittedAt}
                value={formatPlatformDate(request.created_at, locale)}
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="platform-decision-note"
              >
                {copy.decisionNote}
              </label>
              <Textarea
                id="platform-decision-note"
                value={note}
                disabled={isBusy}
                placeholder={copy.notePlaceholder}
                className="min-h-24 resize-none"
                onChange={(event) => onNoteChange(event.target.value)}
              />
              <p className="text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
                {copy.noteHint}
              </p>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" disabled={isRejectDisabled} onClick={onReject}>
            <XCircle className="size-4" />
            {copy.reject}
          </Button>
          <Button
            className={controls.brandButton}
            style={brandGradientStyle}
            disabled={isBusy}
            onClick={onApprove}
          >
            <CheckCircle2 className="size-4" />
            {copy.approve}
          </Button>
          {isRejectDisabled ? <span className="sr-only">{copy.rejectRequired}</span> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <RepairOsInfoTile
      label={label}
      value={value}
      frame="plain"
      className="min-w-0"
      labelClassName="text-[11px] leading-4 lg:text-xs lg:leading-4"
      valueClassName="mt-0 truncate text-sm font-medium leading-5 text-foreground"
    />
  );
}

function RequestTypeBadge({ request, locale }: { request: OnboardingRequest; locale: AppLocale }) {
  const isCreate = request.request_type === "create_store";
  return (
    <Badge variant={isCreate ? "default" : "secondary"} className="gap-1">
      {isCreate ? <Store className="size-3" /> : <UserPlus className="size-3" />}
      {requestTypeLabel(request, locale)}
    </Badge>
  );
}

function requestTypeLabel(request: OnboardingRequest, locale: AppLocale) {
  const copy = platformCopy[locale];
  return request.request_type === "create_store" ? copy.createStore : copy.joinStore;
}

function requestedRoleLabel(request: OnboardingRequest, locale: AppLocale) {
  const copy = platformCopy[locale];
  const labels: Record<string, string> = {
    owner: copy.owner,
    manager: copy.manager,
    technician: copy.technician,
    sales: copy.sales,
    viewer: copy.viewer,
  };
  return labels[request.requested_role] ?? request.requested_role;
}

function requestTarget(request: OnboardingRequest, locale: AppLocale) {
  const copy = platformCopy[locale];
  return request.request_type === "create_store"
    ? request.desired_store_name?.trim() || copy.newTarget
    : request.target_store_name?.trim() ||
        request.target_owner_email?.trim() ||
        request.target_store_id ||
        copy.pendingOwner;
}

function formatPlatformDate(value: string, locale: AppLocale) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return platformCopy[locale].dateUnavailable;
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPlatformWait(value: string | undefined, locale: AppLocale) {
  if (!value) return platformCopy[locale].noWait;
  const createdAt = new Date(value);
  if (!Number.isFinite(createdAt.getTime())) return platformCopy[locale].dateUnavailable;
  const hours = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 3_600_000));
  if (locale === "zh-CN") {
    if (hours < 1) return "1 小时内";
    if (hours < 24) return `${hours} 小时`;
    const days = Math.floor(hours / 24);
    const rest = hours % 24;
    return rest ? `${days} 天 ${rest} 小时` : `${days} 天`;
  }
  if (locale === "it-IT") {
    if (hours < 1) return "meno di 1 ora";
    if (hours < 24) return `${hours} ore`;
    const days = Math.floor(hours / 24);
    const rest = hours % 24;
    return rest ? `${days} giorni ${rest} ore` : `${days} giorni`;
  }
  if (hours < 1) return "under 1 hour";
  if (hours < 24) return `${hours} hours`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest ? `${days} days ${rest} hours` : `${days} days`;
}

function platformSummaryHeadline(requests: OnboardingRequest[], locale: AppLocale) {
  const copy = platformCopy[locale];
  if (!requests.length) return copy.queueClear;
  return copy.earliest.replace("{wait}", formatPlatformWait(requests[0]?.created_at, locale));
}
