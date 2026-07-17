"use client";

import { useRef, useState } from "react";
import { AlertTriangle, RotateCcw, Users } from "lucide-react";

import { RepairOsBusinessCard, RepairOsSectionHeader } from "@/shared/ui";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberAccessRequests } from "@/features/settings/sections/member-access-requests";
import { MemberEditorSheet } from "@/features/settings/sections/member-editor-sheet";
import { MemberInviteTools } from "@/features/settings/sections/member-invite-tools";
import { MemberList } from "@/features/settings/sections/member-list";
import type { MemberEditorDraft } from "@/features/settings/model/member-settings-editor";
import { cn } from "@/lib/utils";
import { repairOs } from "@/lib/ui-patterns";
import type {
  ApprovedStoreRole,
  OnboardingRequest,
  StoreInvitation,
  StoreInviteLink,
  StoreInviteLinkCreateInput,
  StoreInviteInput,
  StoreMember,
} from "@/lib/repairdesk/types";

type ConfirmAction =
  | { kind: "disable"; member: StoreMember }
  | { kind: "restore"; member: StoreMember }
  | { kind: "revoke-invitation"; invitation: StoreInvitation }
  | { kind: "revoke-link"; link: StoreInviteLink }
  | null;

export interface MembersSettingsSectionProps {
  members: StoreMember[];
  invitations: StoreInvitation[];
  inviteLinks: StoreInviteLink[];
  accessRequests: OnboardingRequest[];
  currentMembershipId?: string;
  inviteRoleOptions: readonly ApprovedStoreRole[];
  canInviteMembers: boolean;
  canRevokeMembers: boolean;
  canReviewAccessRequests: boolean;
  orderCostsEnabled: boolean;
  isLoading: boolean;
  isError: boolean;
  isAccessRequestsLoading: boolean;
  isAccessRequestsError: boolean;
  isInviting: boolean;
  isCreatingInviteLink: boolean;
  isRevokingInvitation: boolean;
  isRevokingInviteLink: boolean;
  isSavingMember: boolean;
  isReviewingAccessRequest: boolean;
  pendingMemberId?: string;
  latestInviteCode: string;
  actionError?: string;
  memberSaveError?: string;
  onRetryMembers: () => void;
  onRetryAccessRequests: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onInvite: (input: StoreInviteInput) => Promise<void>;
  onCreateInviteLink: (input: StoreInviteLinkCreateInput) => Promise<void>;
  onCopyInviteCode: () => void;
  onSaveMember: (member: StoreMember, draft: MemberEditorDraft) => Promise<void>;
  onDisableMember: (id: string) => Promise<void>;
  onRestoreMember: (id: string) => Promise<void>;
  onRevokeInvitation: (id: string) => Promise<void>;
  onRevokeInviteLink: (id: string) => Promise<void>;
  onApproveAccessRequest: (id: string, role: ApprovedStoreRole) => Promise<void>;
  onRejectAccessRequest: (id: string) => Promise<void>;
}

export function MembersSettingsSection(props: MembersSettingsSectionProps) {
  const [editingMember, setEditingMember] = useState<StoreMember | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const confirmSubmittingRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const activeCount = props.members.filter((member) => member.status === "active").length;
  const inactiveCount = props.members.filter((member) => member.status === "inactive").length;
  const requestMetric = !props.canReviewAccessRequests
    ? "无权限"
    : props.isAccessRequestsLoading
      ? "…"
      : props.isAccessRequestsError
        ? "—"
        : String(props.accessRequests.length);

  const confirmTitle =
    confirmAction?.kind === "disable"
      ? "停用这名员工？"
      : confirmAction?.kind === "restore"
        ? "恢复这名员工？"
        : confirmAction?.kind === "revoke-invitation"
          ? "撤销待接受邀请？"
          : "撤销当前邀请码？";
  const confirmDescription =
    confirmAction?.kind === "disable"
      ? "停用后该成员不能继续进入当前店铺，额外授权会被撤销；以后可以由有权限的管理员恢复。"
      : confirmAction?.kind === "restore"
        ? "恢复后该成员会以当前保存的角色重新进入店铺。旧的额外授权不会自动恢复。"
        : confirmAction?.kind === "revoke-invitation"
          ? "撤销后这条邀请不能再被接受；需要时可以重新创建邀请。"
          : "撤销后未使用的代码也会立即失效；已经加入的成员不会被移除。";

  const closeConfirm = () => {
    setConfirmAction(null);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  };

  return (
    <section id="settings-members" className={cn(repairOs.adminSection, "p-3 sm:p-4")}>
      <RepairOsSectionHeader
        icon={Users}
        iconFrame={false}
        title="员工与权限"
        description="角色决定默认权限；额外授权只叠加服务端允许的历史、财务和供应商能力。"
      />

      {props.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : props.isError ? (
        <RepairOsBusinessCard
          as="div"
          role="alert"
          className="grid-cols-1 gap-2 border-status-danger-foreground/25 bg-status-danger/10 px-3 py-3 text-status-danger-foreground sm:grid-cols-[minmax(0,1fr)_auto]"
          trailing={
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={props.onRetryMembers}
            >
              <RotateCcw className="size-4" /> 重新读取成员
            </Button>
          }
        >
          <p className="text-sm font-semibold">成员数据读取失败</p>
          <p className="mt-1 text-xs leading-5">当前草稿和店铺上下文不会被清除。</p>
        </RepairOsBusinessCard>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
            {[
              ["成员", props.members.length, "已加入"],
              ["正常", activeCount, "可用"],
              ["停用", inactiveCount, "不可用"],
              ["邀请", props.invitations.length, "待接受"],
              ["邀请码", props.inviteLinks.length, "有效"],
              ["申请", requestMetric, props.isAccessRequestsError ? "读取失败" : "待批"],
            ].map(([label, value, hint]) => (
              <div
                key={label}
                className={cn(
                  repairOs.metricCardDense,
                  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-medium text-muted-foreground">{label}</p>
                  <p className="truncate text-[9px] text-muted-foreground">{hint}</p>
                </div>
                <span className="font-mono text-base font-semibold tabular-nums">{value}</span>
              </div>
            ))}
          </div>

          {props.canReviewAccessRequests ? (
            <MemberAccessRequests
              requests={props.accessRequests}
              roleOptions={props.inviteRoleOptions}
              isLoading={props.isAccessRequestsLoading}
              isError={props.isAccessRequestsError}
              isPending={props.isReviewingAccessRequest}
              errorMessage={props.actionError}
              onRetry={props.onRetryAccessRequests}
              onApprove={props.onApproveAccessRequest}
              onReject={props.onRejectAccessRequest}
            />
          ) : null}

          <MemberInviteTools
            invitations={props.invitations}
            inviteLinks={props.inviteLinks}
            roleOptions={props.inviteRoleOptions}
            latestInviteCode={props.latestInviteCode}
            canInvite={props.canInviteMembers}
            canRevoke={props.canRevokeMembers}
            isInviting={props.isInviting}
            isCreatingLink={props.isCreatingInviteLink}
            isRevokingInvitation={props.isRevokingInvitation}
            isRevokingLink={props.isRevokingInviteLink}
            onInvite={props.onInvite}
            onCreateLink={props.onCreateInviteLink}
            onCopyCode={props.onCopyInviteCode}
            onRequestRevokeInvitation={(invitation, trigger) => {
              returnFocusRef.current = trigger;
              setConfirmAction({ kind: "revoke-invitation", invitation });
            }}
            onRequestRevokeLink={(link, trigger) => {
              returnFocusRef.current = trigger;
              setConfirmAction({ kind: "revoke-link", link });
            }}
          />

          {props.actionError ? (
            <div
              role="alert"
              className="rounded-lg border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2 text-sm text-status-danger-foreground"
            >
              <AlertTriangle className="mr-2 inline size-4" />
              {props.actionError}
            </div>
          ) : null}

          <MemberList
            members={props.members}
            currentMembershipId={props.currentMembershipId}
            pendingMemberId={props.pendingMemberId}
            onOpenEditor={(member, trigger) => {
              returnFocusRef.current = trigger;
              setEditingMember(member);
            }}
            onRequestDisable={(member, trigger) => {
              returnFocusRef.current = trigger;
              setConfirmAction({ kind: "disable", member });
            }}
            onRequestRestore={(member, trigger) => {
              returnFocusRef.current = trigger;
              setConfirmAction({ kind: "restore", member });
            }}
          />
        </div>
      )}

      <MemberEditorSheet
        member={editingMember}
        isSaving={props.isSavingMember}
        errorMessage={props.memberSaveError}
        orderCostsEnabled={props.orderCostsEnabled}
        returnFocusRef={returnFocusRef}
        onOpenChange={(open) => !open && setEditingMember(null)}
        onDirtyChange={props.onDirtyChange}
        onSave={props.onSaveMember}
      />

      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open && !confirmSubmittingRef.current) closeConfirm();
        }}
      >
        <AlertDialogContent aria-busy={confirmSubmitting}>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
            {props.actionError ? (
              <p role="alert" className="text-sm text-status-danger-foreground">
                {props.actionError}
              </p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">取消</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              disabled={confirmSubmitting}
              onClick={(event) => {
                event.preventDefault();
                if (!confirmAction || confirmSubmittingRef.current) return;
                confirmSubmittingRef.current = true;
                setConfirmSubmitting(true);
                const action =
                  confirmAction.kind === "disable"
                    ? props.onDisableMember(confirmAction.member.id)
                    : confirmAction.kind === "restore"
                      ? props.onRestoreMember(confirmAction.member.id)
                      : confirmAction.kind === "revoke-invitation"
                        ? props.onRevokeInvitation(confirmAction.invitation.id)
                        : props.onRevokeInviteLink(confirmAction.link.id);
                void action
                  .then(() => {
                    closeConfirm();
                  })
                  .catch(() => undefined)
                  .finally(() => {
                    confirmSubmittingRef.current = false;
                    setConfirmSubmitting(false);
                  });
              }}
            >
              {confirmSubmitting ? "处理中…" : "确认操作"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
