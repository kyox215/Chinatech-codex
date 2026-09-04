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
import { useLocale } from "@/shared/i18n/locale-provider";
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
  const { t } = useLocale();
  const [editingMember, setEditingMember] = useState<StoreMember | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const confirmSubmittingRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const confirmTitle =
    confirmAction?.kind === "disable"
      ? t("settings.members.confirm.disableTitle")
      : confirmAction?.kind === "restore"
        ? t("settings.members.confirm.restoreTitle")
        : confirmAction?.kind === "revoke-invitation"
          ? t("settings.members.confirm.revokeInvitationTitle")
          : t("settings.members.confirm.revokeLinkTitle");
  const confirmDescription =
    confirmAction?.kind === "disable"
      ? t("settings.members.confirm.disableDescription")
      : confirmAction?.kind === "restore"
        ? t("settings.members.confirm.restoreDescription")
        : confirmAction?.kind === "revoke-invitation"
          ? t("settings.members.confirm.revokeInvitationDescription")
          : t("settings.members.confirm.revokeLinkDescription");

  const closeConfirm = () => {
    setConfirmAction(null);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  };

  return (
    <section id="settings-members" className={cn(repairOs.adminSection, "p-3 sm:p-4")}>
      <RepairOsSectionHeader
        icon={Users}
        iconFrame={false}
        title={t("settings.members.title")}
        description={t("settings.members.description")}
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
              className="min-h-10"
              onClick={props.onRetryMembers}
            >
              <RotateCcw className="size-4" /> {t("settings.members.retry")}
            </Button>
          }
        >
          <p className="text-sm font-semibold">{t("settings.members.errorTitle")}</p>
          <p className="mt-1 text-xs leading-5">{t("settings.members.errorDescription")}</p>
        </RepairOsBusinessCard>
      ) : (
        <div className="space-y-4">
          {props.canReviewAccessRequests && props.accessRequests.length > 0 ? (
            <RepairOsBusinessCard
              as="div"
              role="status"
              className="grid-cols-1 gap-1.5 border-status-warn-foreground/25 bg-status-warn/10 px-3 py-2 text-status-warn-foreground"
            >
              <p className="text-xs font-semibold">
                {t("settings.members.reviewCount", { count: props.accessRequests.length })}
              </p>
              <p className="text-[11px] leading-4">{t("settings.members.reviewHint")}</p>
            </RepairOsBusinessCard>
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
              {t("settings.members.actionError")}
            </div>
          ) : null}
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
                {t("settings.members.actionError")}
              </p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">
              {t("settings.members.cancel")}
            </AlertDialogCancel>
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
              {confirmSubmitting
                ? t("settings.members.processing")
                : t("settings.members.confirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
