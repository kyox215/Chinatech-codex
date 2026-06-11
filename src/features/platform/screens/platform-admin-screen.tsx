"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ShieldCheck, Store, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  approveOnboardingRequest,
  listPlatformOnboardingRequests,
  rejectOnboardingRequest,
  type OnboardingRequest,
} from "@/lib/repairdesk/api";
import { brandGradientStyle, controls, density, pageHeader, pageShell } from "@/lib/ui-patterns";
import { platformKeys } from "@/features/platform/api/query-keys";

const roleLabels: Record<string, string> = {
  owner: "店主",
  manager: "经理",
  technician: "维修",
  sales: "前台/销售",
  viewer: "只读",
};

export function PlatformAdminScreen() {
  const queryClient = useQueryClient();
  const requestsQuery = useQuery({
    queryKey: platformKeys.onboardingRequests,
    queryFn: listPlatformOnboardingRequests,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveOnboardingRequest({ id }),
    onSuccess: async () => {
      toast.success("已批准申请");
      await queryClient.invalidateQueries({ queryKey: platformKeys.onboardingRequests });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "批准失败"),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectOnboardingRequest({ id }),
    onSuccess: async () => {
      toast.success("已拒绝申请");
      await queryClient.invalidateQueries({ queryKey: platformKeys.onboardingRequests });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "拒绝失败"),
  });

  const requests = requestsQuery.data ?? [];

  return (
    <div className={pageShell.list}>
      <header className={pageHeader.root}>
        <div className="min-w-0">
          <p className={pageHeader.eyebrow}>平台管理 / 审批</p>
          <h1 className={pageHeader.title}>
            <span className="gradient-text">账号与店铺审批</span>
          </h1>
          <p className={pageHeader.subtitle}>平台管理员只处理开通申请，不进入各店铺业务数据。</p>
        </div>
        <div className={pageHeader.actions}>
          <Badge variant="outline" className="gap-1.5">
            <ShieldCheck className="size-3.5" />
            平台管理员
          </Badge>
        </div>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric label="待审核" value={requests.length} />
        <Metric
          label="创建店铺"
          value={requests.filter((request) => request.request_type === "create_store").length}
        />
        <Metric
          label="加入店铺"
          value={requests.filter((request) => request.request_type === "join_store").length}
        />
      </section>

      <section className="glass-card mt-5 overflow-hidden">
        {requestsQuery.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : requestsQuery.isError ? (
          <div className="p-4 text-sm text-status-danger-foreground">
            {requestsQuery.error instanceof Error
              ? requestsQuery.error.message
              : "读取审批列表失败"}
          </div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">暂无待审核申请。</div>
        ) : (
          <>
            <div className="hidden min-w-0 max-w-full overflow-hidden lg:block">
              <Table className={`${density.tableDense} min-w-[760px] table-fixed`}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[190px]">申请人</TableHead>
                    <TableHead className="w-[104px]">类型</TableHead>
                    <TableHead>目标</TableHead>
                    <TableHead className="w-[88px]">角色</TableHead>
                    <TableHead className="w-[104px]">时间</TableHead>
                    <TableHead className="w-[148px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <RequestRow
                      key={request.id}
                      request={request}
                      isBusy={approveMutation.isPending || rejectMutation.isPending}
                      onApprove={() => approveMutation.mutate(request.id)}
                      onReject={() => rejectMutation.mutate(request.id)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-2 lg:hidden">
              {requests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  isBusy={approveMutation.isPending || rejectMutation.isPending}
                  onApprove={() => approveMutation.mutate(request.id)}
                  onReject={() => rejectMutation.mutate(request.id)}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-card p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function RequestRow({
  request,
  isBusy,
  onApprove,
  onReject,
}: {
  request: OnboardingRequest;
  isBusy: boolean;
  onApprove: () => void;
  onReject: () => void;
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
      <TableCell className="truncate">
        {roleLabels[request.requested_role] ?? request.requested_role}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {formatDate(request.created_at)}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1.5">
          <Button
            size="sm"
            className={controls.brandButton}
            style={brandGradientStyle}
            disabled={isBusy}
            onClick={onApprove}
          >
            <CheckCircle2 className="size-4" />
            批准
          </Button>
          <Button size="sm" variant="outline" disabled={isBusy} onClick={onReject}>
            <XCircle className="size-4" />
            拒绝
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function RequestCard({
  request,
  isBusy,
  onApprove,
  onReject,
}: {
  request: OnboardingRequest;
  isBusy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <article className="min-w-0 rounded-lg border bg-card p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{request.display_name || request.email}</p>
          <p className="truncate text-xs text-muted-foreground">{request.email}</p>
        </div>
        <RequestTypeBadge request={request} />
      </div>
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <p className="truncate">目标：{requestTarget(request)}</p>
        <p>角色：{roleLabels[request.requested_role] ?? request.requested_role}</p>
        <p>{formatDate(request.created_at)}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          className={controls.brandButton}
          style={brandGradientStyle}
          disabled={isBusy}
          onClick={onApprove}
        >
          <CheckCircle2 className="size-4" />
          批准
        </Button>
        <Button size="sm" variant="outline" disabled={isBusy} onClick={onReject}>
          <XCircle className="size-4" />
          拒绝
        </Button>
      </div>
    </article>
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
  return request.request_type === "create_store"
    ? request.desired_store_name || "新店铺"
    : request.target_store_name || request.target_store_id || "已有店铺";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
