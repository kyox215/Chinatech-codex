"use client";

import { useRef, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";

import { RepairOsBusinessCard } from "@/shared/ui";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MEMBER_ROLE_LABELS } from "@/features/settings/model/member-settings-editor";
import type { ApprovedStoreRole, OnboardingRequest } from "@/lib/repairdesk/types";

type PendingDecision = { request: OnboardingRequest; decision: "approve" | "reject" } | null;

export interface MemberAccessRequestsProps {
  requests: OnboardingRequest[];
  roleOptions: readonly ApprovedStoreRole[];
  isLoading: boolean;
  isError: boolean;
  isPending: boolean;
  errorMessage?: string;
  onRetry: () => void;
  onApprove: (id: string, role: ApprovedStoreRole) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

export function MemberAccessRequests({
  requests,
  roleOptions,
  isLoading,
  isError,
  isPending,
  errorMessage,
  onRetry,
  onApprove,
  onReject,
}: MemberAccessRequestsProps) {
  const [roles, setRoles] = useState<Record<string, ApprovedStoreRole>>({});
  const [pendingDecision, setPendingDecision] = useState<PendingDecision>(null);
  const [isResolving, setIsResolving] = useState(false);
  const resolvingRef = useRef(false);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);

  if (isLoading) {
    return <Skeleton className="h-24 w-full" aria-label="正在读取加入申请" />;
  }
  if (isError) {
    return (
      <RepairOsBusinessCard
        as="div"
        role="alert"
        className="grid-cols-1 gap-2 border-status-danger-foreground/25 bg-status-danger/10 px-3 py-3 text-status-danger-foreground sm:grid-cols-[minmax(0,1fr)_auto]"
        trailing={
          <Button type="button" variant="outline" className="min-h-11" onClick={onRetry}>
            <RotateCcw className="size-4" /> 重新读取申请
          </Button>
        }
      >
        <p className="text-sm font-semibold">加入申请读取失败</p>
        <p className="mt-1 text-xs leading-5">成员列表仍可使用；重试只会刷新加入申请。</p>
      </RepairOsBusinessCard>
    );
  }
  if (!requests.length) return null;

  const selectedRole = pendingDecision
    ? (roles[pendingDecision.request.id] ??
      (pendingDecision.request.requested_role === "owner"
        ? "viewer"
        : pendingDecision.request.requested_role))
    : "viewer";
  const decisionBusy = isPending || isResolving;
  const closeDecision = () => {
    setPendingDecision(null);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  };

  return (
    <section aria-labelledby="member-access-requests-title" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3
          id="member-access-requests-title"
          className="text-xs font-semibold text-muted-foreground"
        >
          加入申请
        </h3>
        <Badge variant="outline">{requests.length} 条待处理</Badge>
      </div>
      {requests.map((request) => {
        const role =
          roles[request.id] ??
          (request.requested_role === "owner" ? "viewer" : request.requested_role);
        return (
          <RepairOsBusinessCard
            key={request.id}
            as="div"
            className="grid-cols-1 gap-3 border-primary/20 bg-primary/5 px-3 py-3 md:grid-cols-[minmax(0,1fr)_14rem] md:items-center"
            trailing={
              <div className="grid min-w-0 gap-2">
                <Select
                  value={role}
                  disabled={isPending}
                  onValueChange={(value) =>
                    setRoles((current) => ({
                      ...current,
                      [request.id]: value as ApprovedStoreRole,
                    }))
                  }
                >
                  <SelectTrigger
                    className="min-h-11 text-base sm:text-sm"
                    aria-label="批准后的角色"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {MEMBER_ROLE_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    className="min-h-11"
                    disabled={isPending || !roleOptions.includes(role)}
                    onClick={(event) => {
                      returnFocusRef.current = event.currentTarget;
                      setPendingDecision({ request, decision: "approve" });
                    }}
                  >
                    <Check className="size-4" /> 批准
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={isPending}
                    onClick={(event) => {
                      returnFocusRef.current = event.currentTarget;
                      setPendingDecision({ request, decision: "reject" });
                    }}
                  >
                    <X className="size-4" /> 拒绝
                  </Button>
                </div>
              </div>
            }
            trailingClassName="min-w-0"
          >
            <p className="break-words text-sm font-semibold">
              {request.display_name || request.email}
            </p>
            <p className="mt-1 break-all text-xs text-muted-foreground">{request.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              申请角色：{MEMBER_ROLE_LABELS[request.requested_role]}
            </p>
            {request.request_note ? (
              <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
                {request.request_note}
              </p>
            ) : null}
          </RepairOsBusinessCard>
        );
      })}

      <AlertDialog
        open={Boolean(pendingDecision)}
        onOpenChange={(open) => {
          if (!open && !resolvingRef.current) closeDecision();
        }}
      >
        <AlertDialogContent aria-busy={decisionBusy}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDecision?.decision === "approve" ? "批准加入当前店铺？" : "拒绝加入申请？"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDecision?.decision === "approve"
                ? `批准后，该账号会以“${MEMBER_ROLE_LABELS[selectedRole]}”身份进入当前店铺。服务端仍会再次校验店铺、对象和角色。`
                : "拒绝后，这条待处理申请会结束；申请人可以在以后重新发起申请。"}
            </AlertDialogDescription>
            {errorMessage ? (
              <p role="alert" className="text-sm text-status-danger-foreground">
                {errorMessage}
              </p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">取消</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              disabled={decisionBusy}
              onClick={(event) => {
                event.preventDefault();
                if (!pendingDecision || resolvingRef.current) return;
                resolvingRef.current = true;
                setIsResolving(true);
                const action =
                  pendingDecision.decision === "approve"
                    ? onApprove(pendingDecision.request.id, selectedRole)
                    : onReject(pendingDecision.request.id);
                void action
                  .then(closeDecision)
                  .catch(() => undefined)
                  .finally(() => {
                    resolvingRef.current = false;
                    setIsResolving(false);
                  });
              }}
            >
              {decisionBusy
                ? "处理中…"
                : pendingDecision?.decision === "approve"
                  ? "确认批准"
                  : "确认拒绝"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
