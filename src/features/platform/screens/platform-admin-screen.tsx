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
  formatOnboardingDate,
  getOnboardingRequestTarget,
  getOnboardingRequestTypeLabel,
  getOnboardingRequestedRoleLabel,
  sortOnboardingRequests,
} from "@/features/platform/model/onboarding-queue";
import { cn } from "@/lib/utils";

export function PlatformAdminScreen() {
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
      toast.success("已批准申请");
      resetDecisionDialog();
      await queryClient.invalidateQueries({ queryKey: platformKeys.onboardingRequests });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "批准失败"),
  });

  const rejectMutation = useMutation({
    mutationFn: rejectOnboardingRequest,
    onSuccess: async () => {
      toast.success("已拒绝申请");
      resetDecisionDialog();
      await queryClient.invalidateQueries({ queryKey: platformKeys.onboardingRequests });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "拒绝失败"),
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
      toast.error("拒绝申请需要填写原因");
      return;
    }
    rejectMutation.mutate({
      id: selectedRequest.id,
      note,
    });
  }

  return (
    <RepairOsListScaffold
      title="平台审批"
      subtitle={`待审核 · 共 ${requests.length} 条`}
      eyebrow="系统 / 平台"
      chips={[
        { key: "pending", label: "待审核", shortLabel: "审", count: requests.length },
        { key: "create", label: "创建店铺", shortLabel: "店", count: summary.createStoreCount },
        { key: "join", label: "加入店铺", shortLabel: "员", count: summary.joinStoreCount },
      ]}
      desktopAction={
        <Badge variant="outline" className="gap-1.5">
          <ShieldCheck className="size-3.5" />
          平台管理员
        </Badge>
      }
      desktopHeaderAddon={
        <RepairOsMetricStrip
          metrics={[
            { label: "待审核", value: requests.length, hint: "全部申请", icon: ShieldCheck },
            {
              label: "创建店铺",
              value: summary.createStoreCount,
              hint: "新门店",
              icon: Store,
              tone: "green",
            },
            {
              label: "加入店铺",
              value: summary.joinStoreCount,
              hint: "成员加入",
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
            <p className="truncate text-sm font-semibold text-foreground">{summary.headline}</p>
            <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
              {summary.nextAction}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 font-mono text-[11px]">
            {summary.oldestWaitLabel}
          </Badge>
        </div>
      </section>

      <section className={cn(repairOs.adminSection, "mt-3 overflow-hidden p-0")}>
        <RepairOsSectionHeader
          title="待处理申请"
          description="审核后账号才可进入对应店铺工作台"
          className="mb-0 border-b border-[var(--border-panel)] px-3 py-2.5"
          action={
            <Badge variant="secondary" className="font-mono text-[11px]">
              {requests.length}
            </Badge>
          }
        />
        {requestsQuery.isLoading ? (
          <div className="space-y-2 p-4">
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
                重新加载
              </Button>
            }
            leadingClassName="self-center"
            trailingClassName="col-span-2 justify-self-start sm:col-span-1 sm:justify-self-end"
            aria-live="polite"
          >
            <span className="block text-sm font-semibold">审批队列加载失败</span>
            <span className="mt-0.5 block break-words text-xs leading-5 text-status-danger-foreground/80">
              {requestsQuery.error instanceof Error
                ? requestsQuery.error.message
                : "读取审批列表失败"}
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
            <span className="block text-sm font-semibold text-foreground">暂无待审核申请</span>
            <span className="mt-0.5 block truncate text-[11px] leading-4">
              新店铺和成员加入申请会显示在这里。
            </span>
          </RepairOsBusinessCard>
        ) : (
          <>
            <div className="hidden min-w-0 max-w-full overflow-x-auto lg:block">
              <Table className={`${density.tableDense} min-w-[680px] table-fixed`}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">申请人</TableHead>
                    <TableHead className="w-[92px]">类型</TableHead>
                    <TableHead>目标</TableHead>
                    <TableHead className="w-[76px]">角色</TableHead>
                    <TableHead className="w-[96px]">时间</TableHead>
                    <TableHead className="w-[116px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <RequestRow
                      key={request.id}
                      request={request}
                      isBusy={isDecisionBusy}
                      onOpen={() => openDecisionDialog(request)}
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
      />
    </RepairOsListScaffold>
  );
}

function RequestRow({
  request,
  isBusy,
  onOpen,
}: {
  request: OnboardingRequest;
  isBusy: boolean;
  onOpen: () => void;
}) {
  return (
    <TableRow>
      <TableCell className="min-w-0">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{request.display_name || request.email}</p>
          <p className="truncate text-xs text-muted-foreground">{request.email}</p>
        </div>
      </TableCell>
      <TableCell>
        <RequestTypeBadge request={request} />
      </TableCell>
      <TableCell className="min-w-0 truncate">{requestTarget(request)}</TableCell>
      <TableCell className="truncate">{getOnboardingRequestedRoleLabel(request)}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {formatOnboardingDate(request.created_at)}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="outline" disabled={isBusy} onClick={onOpen}>
            <Eye className="size-4" />
            处理
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
}: {
  request: OnboardingRequest;
  isBusy: boolean;
  onOpen: () => void;
}) {
  return (
    <RepairOsBusinessCard
      className={cn(repairOs.businessCardDense, "grid-cols-[minmax(0,1fr)] gap-1.5 py-2")}
      bodyClassName="grid gap-1.5"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={repairOs.cardTitle}>{request.display_name || request.email}</p>
          <p className="truncate text-[11px] leading-4 text-muted-foreground">{request.email}</p>
        </div>
        <RequestTypeBadge request={request} />
      </div>
      <div className="grid min-w-0 gap-0.5 text-[11px] leading-4 text-muted-foreground">
        <p className="truncate">目标：{requestTarget(request)}</p>
        <p className="truncate">
          角色：{getOnboardingRequestedRoleLabel(request)} ·{" "}
          {formatOnboardingDate(request.created_at)}
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
          查看并处理
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
}: {
  request: OnboardingRequest | null;
  note: string;
  isBusy: boolean;
  onNoteChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isRejectDisabled = isBusy || note.trim().length === 0;

  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(componentOverlay.modalMd, "max-h-[calc(100svh-24px)] gap-3 overflow-y-auto")}
      >
        <DialogHeader className="pr-9">
          <DialogTitle>处理平台申请</DialogTitle>
          <DialogDescription>
            先核对申请人、目标店铺和角色，再批准或拒绝。拒绝申请必须填写原因。
          </DialogDescription>
        </DialogHeader>

        {request ? (
          <div className="space-y-3">
            <div className="grid gap-2 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3 text-sm sm:grid-cols-2">
              <InfoLine label="申请人" value={request.display_name || request.email} />
              <InfoLine label="邮箱" value={request.email} />
              <InfoLine label="类型" value={getOnboardingRequestTypeLabel(request)} />
              <InfoLine label="目标" value={requestTarget(request)} />
              <InfoLine
                label="审核范围"
                value={request.review_scope === "store" ? "店铺负责人" : "平台"}
              />
              <InfoLine label="申请角色" value={getOnboardingRequestedRoleLabel(request)} />
              <InfoLine label="申请备注" value={request.request_note || "-"} />
              <InfoLine label="提交时间" value={formatOnboardingDate(request.created_at)} />
            </div>

            <div className="space-y-1.5">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="platform-decision-note"
              >
                审批备注 / 拒绝原因
              </label>
              <Textarea
                id="platform-decision-note"
                value={note}
                disabled={isBusy}
                placeholder="例如：已电话核对店铺；或说明拒绝原因。"
                className="min-h-24 resize-none"
                onChange={(event) => onNoteChange(event.target.value)}
              />
              <p className="text-[11px] leading-4 text-muted-foreground">
                批准备注可选；拒绝申请时必须填写，方便后续追踪。
              </p>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" disabled={isRejectDisabled} onClick={onReject}>
            <XCircle className="size-4" />
            拒绝
          </Button>
          <Button
            className={controls.brandButton}
            style={brandGradientStyle}
            disabled={isBusy}
            onClick={onApprove}
          >
            <CheckCircle2 className="size-4" />
            批准
          </Button>
          {isRejectDisabled ? <span className="sr-only">拒绝申请前需要填写原因</span> : null}
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
      labelClassName="text-[11px] leading-4"
      valueClassName="mt-0 truncate text-sm font-medium leading-5 text-foreground"
    />
  );
}

function RequestTypeBadge({ request }: { request: OnboardingRequest }) {
  const isCreate = request.request_type === "create_store";
  return (
    <Badge variant={isCreate ? "default" : "secondary"} className="gap-1">
      {isCreate ? <Store className="size-3" /> : <UserPlus className="size-3" />}
      {isCreate ? "创建店铺" : "加入店铺"}
    </Badge>
  );
}

function requestTarget(request: OnboardingRequest) {
  return getOnboardingRequestTarget(request);
}
