"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ShieldCheck } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UnsavedSettingsGuard } from "@/features/settings/components/unsaved-settings-guard";
import {
  createMemberEditorDraft,
  isMemberEditorDraftChanged,
  isMemberEditorDraftDirty,
  isSensitiveMemberEditorChange,
  MEMBER_PERMISSION_OPTIONS,
  MEMBER_ROLE_LABELS,
  updateMemberEditorPermission,
  updateMemberEditorRole,
  visibleMemberPermissionOptions,
  type MemberEditorDraft,
} from "@/features/settings/model/member-settings-editor";
import { componentOverlay } from "@/lib/component-patterns";
import type { StoreMember } from "@/lib/repairdesk/types";

export interface MemberEditorSheetProps {
  member: StoreMember | null;
  isSaving: boolean;
  errorMessage?: string;
  orderCostsEnabled?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSave: (member: StoreMember, draft: MemberEditorDraft) => Promise<void>;
}

export function MemberEditorSheet({
  member,
  isSaving,
  errorMessage,
  orderCostsEnabled = false,
  returnFocusRef,
  onOpenChange,
  onDirtyChange,
  onSave,
}: MemberEditorSheetProps) {
  const initialDraft = useMemo(() => (member ? createMemberEditorDraft(member) : null), [member]);
  const [draft, setDraft] = useState<MemberEditorDraft | null>(initialDraft);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const draftRef = useRef<MemberEditorDraft | null>(initialDraft);
  const baseRef = useRef<MemberEditorDraft | null>(initialDraft);
  const submittingRef = useRef(false);
  const firstControlRef = useRef<HTMLButtonElement>(null);
  const discardTriggerRef = useRef<HTMLButtonElement>(null);
  const saveTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const next = member ? createMemberEditorDraft(member) : null;
    draftRef.current = next;
    baseRef.current = next;
    setDraft(next);
  }, [member]);

  const dirty = Boolean(
    member && draft && baseRef.current && isMemberEditorDraftChanged(baseRef.current, draft),
  );
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  if (!member || !draft) return null;
  const roleOptions = member.management?.allowed_roles ?? [];
  const roleDirty = member.role !== draft.role;
  const canEditRole = member.management?.can_update_role === true && member.status === "active";
  const permissionOptions = visibleMemberPermissionOptions(draft.role, orderCostsEnabled);
  const canEditPermissions =
    member.management?.can_update_permissions === true &&
    member.status === "active" &&
    member.role !== "owner" &&
    !roleDirty;
  const canEditAnything = canEditRole || canEditPermissions;

  const updateDraft = (next: MemberEditorDraft) => {
    draftRef.current = next;
    setDraft(next);
  };
  const discardDraft = () => {
    const base = baseRef.current ?? createMemberEditorDraft(member);
    draftRef.current = base;
    setDraft(base);
    setDiscardConfirmOpen(false);
    onOpenChange(false);
  };
  const saveDraft = async () => {
    const current = draftRef.current;
    if (!current || !isMemberEditorDraftDirty(member, current)) return;
    await onSave(member, current);
    baseRef.current = current;
    setSaveConfirmOpen(false);
    onOpenChange(false);
  };
  const submitDraft = async () => {
    if (submittingRef.current || isSaving) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await saveDraft();
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };
  const requestSave = () => {
    if (!dirty || isSaving || submittingRef.current) return;
    if (isSensitiveMemberEditorChange(member, draft)) {
      setSaveConfirmOpen(true);
      return;
    }
    void submitDraft().catch(() => undefined);
  };

  return (
    <>
      <UnsavedSettingsGuard
        id={`settings-member-editor-${member.id}`}
        dirty={dirty}
        isDirty={() => {
          const current = draftRef.current;
          const base = baseRef.current;
          return Boolean(current && base && isMemberEditorDraftChanged(base, current));
        }}
        busy={isSaving || isSubmitting}
        label={`${member.display_name || member.email} 的员工权限`}
        onSave={async () => {
          try {
            await submitDraft();
            return { status: "resolved" };
          } catch {
            return { status: "blocked", focus: () => firstControlRef.current?.focus() };
          }
        }}
        onDiscard={() => {
          discardDraft();
          return { status: "resolved" };
        }}
        onFocusFallback={() => firstControlRef.current?.focus()}
      />
      <Sheet
        open
        onOpenChange={(open) => {
          if (open) return;
          if (isSaving) return;
          if (dirty) {
            setDiscardConfirmOpen(true);
            return;
          }
          onOpenChange(false);
        }}
      >
        <SheetContent
          side="right"
          className="flex h-full w-[calc(100vw-16px)] max-w-[calc(100vw-8px)] flex-col gap-0 p-0 sm:w-[min(40rem,calc(100vw-24px))]"
          aria-busy={isSaving || isSubmitting}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() => returnFocusRef?.current?.focus());
          }}
        >
          <SheetHeader
            className={`${componentOverlay.mobileHeader} border-b border-[var(--border-panel)] pr-14 text-left`}
          >
            <SheetTitle>{member.display_name || member.email}</SheetTitle>
            <SheetDescription>
              {MEMBER_ROLE_LABELS[member.role]} · {member.email}。修改先保留为草稿，保存后才会提交。
            </SheetDescription>
          </SheetHeader>

          <div className={`${componentOverlay.mobileBody} flex-1`}>
            <section className={componentOverlay.section}>
              <Label className="text-xs font-semibold">店铺角色</Label>
              {canEditRole && roleOptions.length ? (
                <Select
                  value={draft.role}
                  disabled={isSaving}
                  onValueChange={(role) =>
                    updateDraft(updateMemberEditorRole(draft, role as MemberEditorDraft["role"]))
                  }
                >
                  <SelectTrigger
                    ref={firstControlRef}
                    className="mt-2 h-[38px] text-base sm:text-sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role} value={role}>
                        {MEMBER_ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {MEMBER_ROLE_LABELS[member.role]} · 当前账号不能修改此成员角色。
                </p>
              )}
            </section>

            <section className={componentOverlay.section}>
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">额外敏感权限</h3>
                  <p className="mt-0.5 text-xs leading-4 text-muted-foreground sm:mt-1 sm:leading-5">
                    这些授权叠加在角色默认权限上；这里只显示服务端允许当前角色接收的额外能力。
                  </p>
                </div>
              </div>
              {permissionOptions.length ? (
                <div className="mt-2 space-y-2 sm:mt-3 sm:space-y-3">
                  {["历史与财务", "供应商"].map((group) => {
                    const options = MEMBER_PERMISSION_OPTIONS.filter(
                      (option) => option.group === group && permissionOptions.includes(option),
                    );
                    if (!options.length) return null;
                    return (
                      <div key={group} className="space-y-1.5 sm:space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground">{group}</p>
                        {options.map((option) => (
                          <RepairOsBusinessCard
                            key={option.action}
                            as="div"
                            className="grid-cols-[minmax(0,1fr)_auto] gap-2 px-2.5 py-1.5 sm:gap-3 sm:px-3 sm:py-2.5"
                            trailing={
                              <Checkbox
                                id={`member-permission-${option.action}`}
                                checked={draft.permissions.includes(option.action)}
                                disabled={!canEditPermissions || isSaving}
                                onCheckedChange={(checked) =>
                                  updateDraft(
                                    updateMemberEditorPermission(
                                      draft,
                                      option.action,
                                      Boolean(checked),
                                    ),
                                  )
                                }
                              />
                            }
                          >
                            <Label
                              htmlFor={`member-permission-${option.action}`}
                              className="flex min-h-9 cursor-pointer items-center text-sm font-medium"
                            >
                              {option.label}
                            </Label>
                            <p className="text-[11px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">
                              {option.description}
                            </p>
                          </RepairOsBusinessCard>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  当前角色不能接收额外历史、财务或供应商授权。
                </p>
              )}
              {roleDirty ? (
                <div className="mt-3 rounded-lg border border-status-warn-foreground/25 bg-status-warn/10 px-3 py-2 text-xs leading-5 text-status-warn-foreground">
                  请先保存角色并重新读取成员。角色变化会撤销旧的额外授权，之后再为新角色单独配置权限，避免两个独立接口产生部分成功。
                </div>
              ) : null}
            </section>

            {errorMessage ? (
              <div
                role="alert"
                className="rounded-lg border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2 text-sm text-status-danger-foreground"
              >
                {errorMessage}
              </div>
            ) : null}
          </div>

          <SheetFooter className={`${componentOverlay.mobileFooter} bg-card`}>
            <Button
              ref={discardTriggerRef}
              type="button"
              variant="outline"
              className="min-h-9"
              disabled={isSaving || isSubmitting}
              onClick={() => (dirty ? setDiscardConfirmOpen(true) : onOpenChange(false))}
            >
              取消
            </Button>
            <Button
              ref={saveTriggerRef}
              type="button"
              className="min-h-10"
              disabled={!canEditAnything || !dirty || isSaving || isSubmitting}
              onClick={requestSave}
            >
              {isSaving || isSubmitting ? "保存中…" : "保存员工变更"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={discardConfirmOpen}
        onOpenChange={(open) => {
          if (isSubmitting) return;
          setDiscardConfirmOpen(open);
          if (!open) requestAnimationFrame(() => discardTriggerRef.current?.focus());
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>放弃员工权限草稿？</AlertDialogTitle>
            <AlertDialogDescription>
              未保存的角色和额外权限修改会被清除，服务器上的现有权限不会改变。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">继续编辑</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={discardDraft}>
              放弃修改
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={saveConfirmOpen}
        onOpenChange={(open) => {
          if (isSubmitting) return;
          setSaveConfirmOpen(open);
          if (!open) requestAnimationFrame(() => saveTriggerRef.current?.focus());
        }}
      >
        <AlertDialogContent aria-busy={isSubmitting || isSaving}>
          <AlertDialogHeader>
            <AlertDialogTitle>确认授予敏感员工权限？</AlertDialogTitle>
            <AlertDialogDescription>
              这次修改包含店长角色或历史、财务、供应商管理等敏感能力。保存后会立即影响当前店铺访问范围，并写入审计记录。
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
              disabled={isSubmitting || isSaving}
              onClick={(event) => {
                event.preventDefault();
                void submitDraft().catch(() => undefined);
              }}
            >
              {isSubmitting || isSaving ? "保存中…" : "确认并保存"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
