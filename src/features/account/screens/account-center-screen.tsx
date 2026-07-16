"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  Send,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getOnboardingStatus, updateAccountProfile } from "@/lib/repairdesk/api";
import type { OnboardingStatus } from "@/lib/repairdesk/types";
import { brandGradientStyle, controls, pageShell, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import {
  authErrorMessage,
  emailChangeRequestedMessage,
  normalizeAuthEmail,
  passwordResetSentMessage,
  validateEmailChange,
  validateNewPassword,
  verificationEmailSentMessage,
} from "@/features/auth/model/auth-errors";
import { buildAuthCallbackUrl } from "@/features/auth/model/auth-redirect";
import { platformKeys } from "@/features/platform/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";
import { normalizeOptionalE164Phone } from "@/shared/lib/phone";
import { createClient } from "@/utils/supabase/client";

const roleLabels: Record<string, string> = {
  owner: "负责人",
  manager: "店长",
  technician: "维修员",
  sales: "销售",
  viewer: "只读",
};

export function AccountCenterScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    data: status,
    isLoading,
    isError,
  } = useQuery({
    queryKey: platformKeys.onboardingStatus,
    queryFn: ({ signal }) => getOnboardingStatus({ signal }),
    retry: false,
  });
  const [displayName, setDisplayName] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [emailConfirmationDraft, setEmailConfirmationDraft] = useState("");
  const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  useEffect(() => {
    if (!status) return;
    setDisplayName(status.displayName ?? "");
    setPhoneDraft(status.phoneE164 ?? "");
  }, [status]);

  const roleLabel = useMemo(() => resolveRoleLabel(status), [status]);
  const hasProfileChange =
    Boolean(status) &&
    (displayName.trim() !== status?.displayName || phoneDraft.trim() !== (status?.phoneE164 ?? ""));
  const currentEmail = status?.email ?? "";
  const emailVerified = status?.emailVerified === true;

  const profileMutation = useMutation({
    mutationFn: async () => {
      const name = displayName.trim();
      if (!name) throw new Error("账号名称不能为空");
      const phoneE164 = normalizeOptionalE164Phone(phoneDraft);
      return updateAccountProfile({ display_name: name, phone_e164: phoneE164 });
    },
    onSuccess: async (nextStatus) => {
      queryClient.setQueryData(platformKeys.onboardingStatus, nextStatus);
      await queryClient.invalidateQueries({ queryKey: storesKeys.context });
      toast.success("个人资料已保存");
      router.refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存个人资料失败"),
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (!currentPassword) throw new Error("请输入当前密码");
      const validationError = validateNewPassword(newPassword, newPasswordConfirmation);
      if (validationError) throw new Error(validationError);
      const { error } = await createClient().auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      });
      if (error) throw new Error(authErrorMessage(error));
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirmation("");
      toast.success("密码已更新");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "修改密码失败"),
  });

  const passwordResetMutation = useMutation({
    mutationFn: async () => {
      const email = normalizeAuthEmail(currentEmail);
      if (!email) throw new Error("未读取当前登录邮箱");
      const { error } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: buildAuthCallbackUrl("/reset-password"),
      });
      if (error) throw new Error(authErrorMessage(error));
      return email;
    },
    onSuccess: () => toast.success(passwordResetSentMessage()),
    onError: (error) => toast.error(error instanceof Error ? error.message : "发送重置邮件失败"),
  });

  const resendVerificationMutation = useMutation({
    mutationFn: async () => {
      const email = normalizeAuthEmail(currentEmail);
      if (!email) throw new Error("未读取当前登录邮箱");
      const { error } = await createClient().auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: buildAuthCallbackUrl("/account"),
        },
      });
      if (error) throw new Error(authErrorMessage(error));
    },
    onSuccess: () => toast.success(verificationEmailSentMessage()),
    onError: (error) => toast.error(error instanceof Error ? error.message : "发送验证邮件失败"),
  });

  const emailChangeMutation = useMutation({
    mutationFn: async () => {
      const validationError = validateEmailChange({
        currentEmail,
        nextEmail: emailDraft,
        confirmation: emailConfirmationDraft,
        currentPassword: emailCurrentPassword,
      });
      if (validationError) throw new Error(validationError);
      const normalizedNextEmail = normalizeAuthEmail(emailDraft);
      const supabase = createClient();
      const { error: passwordError } = await supabase.auth.signInWithPassword({
        email: normalizeAuthEmail(currentEmail),
        password: emailCurrentPassword,
      });
      if (passwordError) throw new Error(authErrorMessage(passwordError));
      const { error } = await supabase.auth.updateUser(
        { email: normalizedNextEmail },
        { emailRedirectTo: buildAuthCallbackUrl("/account") },
      );
      if (error) throw new Error(authErrorMessage(error));
      return normalizedNextEmail;
    },
    onSuccess: (email) => {
      setPendingEmail(email);
      setEmailDraft("");
      setEmailConfirmationDraft("");
      setEmailCurrentPassword("");
      toast.success(emailChangeRequestedMessage(email));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "更改邮箱失败"),
  });

  if (isError) {
    return (
      <div className={cn(pageShell.wide, "max-w-4xl")}>
        <section className={cn(repairOs.adminSection, "p-4")}>
          <p className="text-sm font-semibold text-status-danger-foreground">账号资料读取失败</p>
          <p className="mt-1 text-xs text-muted-foreground">请刷新页面或重新登录后再试。</p>
        </section>
      </div>
    );
  }

  return (
    <div className={cn(pageShell.wide, "max-w-5xl space-y-3 sm:space-y-4")}>
      <section className={cn(repairOs.adminSection, "p-3 sm:p-4")}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <UserRound className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">个人中心</p>
            <p className="truncate text-xs text-muted-foreground">账号资料、密码和联系手机号</p>
          </div>
          <Badge variant="outline" className="hidden shrink-0 gap-1 text-[11px] sm:inline-flex">
            <ShieldCheck className="size-3.5" />
            {roleLabel}
          </Badge>
        </div>
      </section>

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.78fr)]">
        <section className={cn(repairOs.adminSection, "space-y-3 p-3 sm:p-4")}>
          <SectionTitle icon={UserRound} title="账号资料" />
          {isLoading ? (
            <ProfileSkeleton />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <ReadonlyField icon={Mail} label="登录邮箱" value={currentEmail || "未读取邮箱"} />
                <ReadonlyField
                  icon={Store}
                  label="当前店铺"
                  value={status?.activeStore?.name ?? "未选择店铺"}
                />
              </div>
              <AccountEmailSecurityPanel
                email={currentEmail}
                emailVerified={emailVerified}
                pendingEmail={pendingEmail}
                emailDraft={emailDraft}
                emailConfirmationDraft={emailConfirmationDraft}
                emailCurrentPassword={emailCurrentPassword}
                isResending={resendVerificationMutation.isPending}
                isChanging={emailChangeMutation.isPending}
                onEmailDraftChange={setEmailDraft}
                onEmailConfirmationDraftChange={setEmailConfirmationDraft}
                onEmailCurrentPasswordChange={setEmailCurrentPassword}
                onResendVerification={() => resendVerificationMutation.mutate()}
                onChangeEmail={() => emailChangeMutation.mutate()}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="显示名称" htmlFor="account-display-name">
                  <Input
                    id="account-display-name"
                    value={displayName}
                    maxLength={60}
                    autoComplete="name"
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </Field>
                <Field label="联系手机号" htmlFor="account-phone">
                  <Input
                    id="account-phone"
                    value={phoneDraft}
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="+39 333 123 4567"
                    onChange={(event) => setPhoneDraft(event.target.value)}
                  />
                </Field>
              </div>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-muted-foreground">
                  手机号仅作为员工联系资料保存；登录仍使用邮箱和密码。
                </p>
                <Button
                  type="button"
                  className={cn("w-full gap-2 sm:w-auto", controls.brandButton)}
                  style={brandGradientStyle}
                  disabled={!hasProfileChange || profileMutation.isPending}
                  onClick={() => profileMutation.mutate()}
                >
                  {profileMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  保存资料
                </Button>
              </div>
            </>
          )}
        </section>

        <section className={cn(repairOs.adminSection, "space-y-3 p-3 sm:p-4")}>
          <SectionTitle icon={KeyRound} title="修改密码" />
          <div className="grid gap-3">
            <Field label="当前密码" htmlFor="current-password">
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>
            <Field label="新密码" htmlFor="new-password">
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </Field>
            <Field label="确认新密码" htmlFor="new-password-confirmation">
              <Input
                id="new-password-confirmation"
                type="password"
                autoComplete="new-password"
                value={newPasswordConfirmation}
                onChange={(event) => setNewPasswordConfirmation(event.target.value)}
              />
            </Field>
          </div>
          <Button
            type="button"
            className={cn("w-full gap-2", controls.brandButton)}
            style={brandGradientStyle}
            disabled={passwordMutation.isPending}
            onClick={() => passwordMutation.mutate()}
          >
            {passwordMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            更新密码
          </Button>
          <PasswordResetEmailPanel
            email={currentEmail}
            isSending={passwordResetMutation.isPending}
            onSend={() => passwordResetMutation.mutate()}
          />
        </section>
      </div>
    </div>
  );
}

function AccountEmailSecurityPanel({
  email,
  emailVerified,
  pendingEmail,
  emailDraft,
  emailConfirmationDraft,
  emailCurrentPassword,
  isResending,
  isChanging,
  onEmailDraftChange,
  onEmailConfirmationDraftChange,
  onEmailCurrentPasswordChange,
  onResendVerification,
  onChangeEmail,
}: {
  email: string;
  emailVerified: boolean;
  pendingEmail: string;
  emailDraft: string;
  emailConfirmationDraft: string;
  emailCurrentPassword: string;
  isResending: boolean;
  isChanging: boolean;
  onEmailDraftChange: (value: string) => void;
  onEmailConfirmationDraftChange: (value: string) => void;
  onEmailCurrentPasswordChange: (value: string) => void;
  onResendVerification: () => void;
  onChangeEmail: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">邮箱安全</p>
            <Badge
              variant={emailVerified ? "default" : "outline"}
              className="h-6 gap-1 px-2 text-[11px]"
            >
              {emailVerified ? (
                <CheckCircle2 className="size-3.5" />
              ) : (
                <AlertCircle className="size-3.5" />
              )}
              {emailVerified ? "已验证" : "未验证"}
            </Badge>
          </div>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            当前登录邮箱：{email || "未读取邮箱"}
          </p>
          {pendingEmail ? (
            <p className="mt-1 break-all text-xs text-status-warn-foreground">
              待确认新邮箱：{pendingEmail}
            </p>
          ) : null}
        </div>
        {!emailVerified ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full shrink-0 gap-1.5 sm:w-auto"
            disabled={isResending || !email}
            onClick={onResendVerification}
          >
            {isResending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            重发验证
          </Button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="新登录邮箱" htmlFor="account-new-email">
          <Input
            id="account-new-email"
            type="email"
            autoComplete="email"
            value={emailDraft}
            onChange={(event) => onEmailDraftChange(event.target.value)}
          />
        </Field>
        <Field label="确认新邮箱" htmlFor="account-new-email-confirmation">
          <Input
            id="account-new-email-confirmation"
            type="email"
            autoComplete="email"
            value={emailConfirmationDraft}
            onChange={(event) => onEmailConfirmationDraftChange(event.target.value)}
          />
        </Field>
        <Field label="当前密码" htmlFor="account-email-current-password">
          <Input
            id="account-email-current-password"
            type="password"
            autoComplete="current-password"
            value={emailCurrentPassword}
            onChange={(event) => onEmailCurrentPasswordChange(event.target.value)}
          />
        </Field>
      </div>
      <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-muted-foreground">
          更改邮箱会发送确认邮件；确认完成前，登录邮箱仍保持当前地址。
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 sm:w-auto"
          disabled={isChanging}
          onClick={onChangeEmail}
        >
          {isChanging ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          发送换绑邮件
        </Button>
      </div>
    </div>
  );
}

function PasswordResetEmailPanel({
  email,
  isSending,
  onSend,
}: {
  email: string;
  isSending: boolean;
  onSend: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold">忘记当前密码？</p>
          <p className="break-words text-xs leading-5 text-muted-foreground">
            发送重置链接到当前登录邮箱，打开邮件后重新设置密码。
          </p>
          <p className="break-all text-xs text-muted-foreground">{email || "未读取当前登录邮箱"}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full shrink-0 gap-2 sm:w-auto"
          disabled={isSending || !email}
          onClick={onSend}
        >
          {isSending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          发送重置邮件
        </Button>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <h2 className="truncate text-sm font-semibold">{title}</h2>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ReadonlyField({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
      <Skeleton className="h-10 rounded-xl" />
      <Skeleton className="h-10 rounded-xl" />
    </div>
  );
}

function resolveRoleLabel(status?: OnboardingStatus) {
  if (!status) return "读取中";
  if (status.isPlatformAdmin) return "平台管理员";
  const role = status.activeStore?.role;
  return role ? (roleLabels[role] ?? role) : "未加入店铺";
}
