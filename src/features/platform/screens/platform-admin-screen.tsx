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
import { RepairOsMetricStrip, RepairOsModuleHeader } from "@/shared/ui";
import { brandGradientStyle, controls, density, pageShell, repairOs } from "@/lib/ui-patterns";
import { platformKeys } from "@/features/platform/api/query-keys";
import { cn } from "@/lib/utils";

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
  const createStoreCount = requests.filter(
    (request) => request.request_type === "create_store",
  ).length;
  const joinStoreCount = requests.length - createStoreCount;

  return (
    <div className={cn(pageShell.list, "pb-8 pt-3 sm:pt-5")}>
      <div className="space-y-3">
        <RepairOsModuleHeader
          action={
            <Badge variant="outline" className="gap-1.5">
              <ShieldCheck className="size-3.5" />
              平台管理员
            </Badge>
          }
        />

        <RepairOsMetricStrip
          metrics={[
            { label: "待审核", value: requests.length, hint: "全部申请", icon: ShieldCheck },
            {
              label: "创建店铺",
              value: createStoreCount,
              hint: "新门店",
              icon: Store,
              tone: "green",
            },
            {
              label: "加入店铺",
              value: joinStoreCount,
              hint: "成员加入",
              icon: UserPlus,
              tone: "amber",
            },
          ]}
        />
      </div>

      <section className={cn(repairOs.adminSection, "mt-3 overflow-hidden p-0")}>
        <div className="flex min-w-0 items-center justify-between gap-2 border-b border-[var(--border-panel)] px-3 py-2.5">
          <div className="min-w-0">
            <h2 className={repairOs.adminSectionTitle}>待处理申请</h2>
            <p className="truncate text-[11px] text-muted-foreground">
              审核后账号才可进入对应店铺工作台
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 font-mono text-[11px]">
            {requests.length}
          </Badge>
        </div>
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
          <div className="p-5 text-center text-sm text-muted-foreground">暂无待审核申请。</div>
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
            <div className="space-y-1.5 p-2 lg:hidden">
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
    <article className={cn(repairOs.businessCardDense, "grid-cols-[minmax(0,1fr)] gap-1.5 py-2")}>
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
          角色：{roleLabels[request.requested_role] ?? request.requested_role} ·{" "}
          {formatDate(request.created_at)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          size="sm"
          className={cn("h-8 gap-1.5", controls.brandButton)}
          style={brandGradientStyle}
          disabled={isBusy}
          onClick={onApprove}
        >
          <CheckCircle2 className="size-3.5" />
          批准
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          disabled={isBusy}
          onClick={onReject}
        >
          <XCircle className="size-3.5" />
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
