"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey } from "@/shared/i18n/messages";
import { createClient } from "@/utils/supabase/client";

type AccountAction = "profile" | "password" | "passwordReset" | "verification" | "emailChange";

export function AccountCenterScreen() {
  const { t } = useLocale();
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
  const actionLocksRef = useRef<Record<AccountAction, boolean>>({
    profile: false,
    password: false,
    passwordReset: false,
    verification: false,
    emailChange: false,
  });

  const runAccountAction = (action: AccountAction, mutate: () => Promise<unknown>) => {
    if (actionLocksRef.current[action]) return;
    actionLocksRef.current[action] = true;
    void mutate()
      .catch(() => undefined)
      .finally(() => releaseAccountAction(action));
  };
  const releaseAccountAction = (action: AccountAction) => {
    actionLocksRef.current[action] = false;
  };

  useEffect(() => {
    if (!status) return;
    setDisplayName(status.displayName ?? "");
    setPhoneDraft(status.phoneE164 ?? "");
  }, [status]);

  const roleLabel = useMemo(() => resolveRoleLabel(status, t), [status, t]);
  const hasProfileChange =
    Boolean(status) &&
    (displayName.trim() !== status?.displayName || phoneDraft.trim() !== (status?.phoneE164 ?? ""));
  const currentEmail = status?.email ?? "";
  const emailVerified = status?.emailVerified === true;

  const profileMutation = useMutation({
    mutationFn: async () => {
      const name = displayName.trim();
      if (!name) throw new SafeAccountPresentationError(t("account.error.nameRequired"));
      const phoneE164 = normalizeOptionalE164Phone(phoneDraft);
      return updateAccountProfile({ display_name: name, phone_e164: phoneE164 });
    },
    onSuccess: async (nextStatus) => {
      queryClient.setQueryData(platformKeys.onboardingStatus, nextStatus);
      await queryClient.invalidateQueries({ queryKey: storesKeys.context });
      toast.success(t("account.profileSaved"));
      router.refresh();
    },
    onError: (error) => toast.error(accountActionError(error, t, "account.error.profileSave")),
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (!currentPassword) {
        throw new SafeAccountPresentationError(t("account.error.currentPasswordRequired"));
      }
      const validationError = validateNewPassword(newPassword, newPasswordConfirmation, t);
      if (validationError) throw new SafeAccountPresentationError(validationError);
      const { error } = await createClient().auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      });
      if (error) throw new SafeAccountPresentationError(authErrorMessage(error, t));
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirmation("");
      toast.success(t("account.passwordUpdated"));
    },
    onError: (error) => toast.error(accountActionError(error, t, "account.error.passwordChange")),
  });

  const passwordResetMutation = useMutation({
    mutationFn: async () => {
      const email = normalizeAuthEmail(currentEmail);
      if (!email) {
        throw new SafeAccountPresentationError(t("auth.error.currentEmailUnavailable"));
      }
      const { error } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: buildAuthCallbackUrl("/reset-password"),
      });
      if (error) throw new SafeAccountPresentationError(authErrorMessage(error, t));
      return email;
    },
    onSuccess: () => toast.success(passwordResetSentMessage(t)),
    onError: (error) => toast.error(accountActionError(error, t, "account.error.resetEmail")),
  });

  const resendVerificationMutation = useMutation({
    mutationFn: async () => {
      const email = normalizeAuthEmail(currentEmail);
      if (!email) {
        throw new SafeAccountPresentationError(t("auth.error.currentEmailUnavailable"));
      }
      const { error } = await createClient().auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: buildAuthCallbackUrl("/account"),
        },
      });
      if (error) throw new SafeAccountPresentationError(authErrorMessage(error, t));
    },
    onSuccess: () => toast.success(verificationEmailSentMessage(t)),
    onError: (error) =>
      toast.error(accountActionError(error, t, "account.error.verificationEmail")),
  });

  const emailChangeMutation = useMutation({
    mutationFn: async () => {
      const validationError = validateEmailChange(
        {
          currentEmail,
          nextEmail: emailDraft,
          confirmation: emailConfirmationDraft,
          currentPassword: emailCurrentPassword,
        },
        t,
      );
      if (validationError) throw new SafeAccountPresentationError(validationError);
      const normalizedNextEmail = normalizeAuthEmail(emailDraft);
      const supabase = createClient();
      const { error: passwordError } = await supabase.auth.signInWithPassword({
        email: normalizeAuthEmail(currentEmail),
        password: emailCurrentPassword,
      });
      if (passwordError) {
        throw new SafeAccountPresentationError(authErrorMessage(passwordError, t));
      }
      const { error } = await supabase.auth.updateUser(
        { email: normalizedNextEmail },
        { emailRedirectTo: buildAuthCallbackUrl("/account") },
      );
      if (error) throw new SafeAccountPresentationError(authErrorMessage(error, t));
      return normalizedNextEmail;
    },
    onSuccess: (email) => {
      setPendingEmail(email);
      setEmailDraft("");
      setEmailConfirmationDraft("");
      setEmailCurrentPassword("");
      toast.success(emailChangeRequestedMessage(email, t));
    },
    onError: (error) => toast.error(accountActionError(error, t, "account.error.emailChange")),
  });

  if (isError) {
    return (
      <div className={cn(pageShell.wide, "max-w-4xl")}>
        <section className={cn(repairOs.adminSection, "p-4")}>
          <p className="text-sm font-semibold text-status-danger-foreground">
            {t("account.loadErrorTitle")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t("account.loadErrorDescription")}</p>
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
            <p className="truncate text-sm font-semibold">{t("account.title")}</p>
            <p className="truncate text-xs text-muted-foreground">{t("account.subtitle")}</p>
          </div>
          <Badge
            variant="outline"
            className="hidden shrink-0 gap-1 text-[11px] sm:inline-flex lg:text-xs lg:leading-4"
          >
            <ShieldCheck className="size-3.5" />
            {roleLabel}
          </Badge>
        </div>
      </section>

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.78fr)]">
        <section className={cn(repairOs.adminSection, "space-y-3 p-3 sm:p-4")}>
          <SectionTitle icon={UserRound} title={t("account.profileTitle")} />
          {isLoading ? (
            <ProfileSkeleton />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <ReadonlyField
                  icon={Mail}
                  label={t("account.loginEmail")}
                  value={currentEmail || t("account.emailUnavailable")}
                />
                <ReadonlyField
                  icon={Store}
                  label={t("account.currentStore")}
                  value={status?.activeStore?.name ?? t("account.noStore")}
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
                onResendVerification={() =>
                  runAccountAction("verification", () => resendVerificationMutation.mutateAsync())
                }
                onChangeEmail={() =>
                  runAccountAction("emailChange", () => emailChangeMutation.mutateAsync())
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("account.displayName")} htmlFor="account-display-name">
                  <Input
                    id="account-display-name"
                    value={displayName}
                    maxLength={60}
                    autoComplete="name"
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </Field>
                <Field label={t("account.phone")} htmlFor="account-phone">
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
                <p className="text-xs leading-5 text-muted-foreground">{t("account.phoneHint")}</p>
                <Button
                  type="button"
                  className={cn("w-full gap-2 sm:w-auto", controls.brandButton)}
                  style={brandGradientStyle}
                  disabled={!hasProfileChange || profileMutation.isPending}
                  onClick={() => runAccountAction("profile", () => profileMutation.mutateAsync())}
                >
                  {profileMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  {t("account.saveProfile")}
                </Button>
              </div>
            </>
          )}
        </section>

        <section className={cn(repairOs.adminSection, "space-y-3 p-3 sm:p-4")}>
          <SectionTitle icon={KeyRound} title={t("account.changePassword")} />
          <div className="grid gap-3">
            <Field label={t("account.currentPassword")} htmlFor="current-password">
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>
            <Field label={t("account.newPassword")} htmlFor="new-password">
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </Field>
            <Field label={t("account.confirmPassword")} htmlFor="new-password-confirmation">
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
            onClick={() => runAccountAction("password", () => passwordMutation.mutateAsync())}
          >
            {passwordMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            {t("account.updatePassword")}
          </Button>
          <PasswordResetEmailPanel
            email={currentEmail}
            isSending={passwordResetMutation.isPending}
            onSend={() =>
              runAccountAction("passwordReset", () => passwordResetMutation.mutateAsync())
            }
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
  const { t } = useLocale();
  return (
    <div className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{t("account.emailSecurity")}</p>
            <Badge
              variant={emailVerified ? "default" : "outline"}
              className="h-6 gap-1 px-2 text-[11px] lg:text-xs"
            >
              {emailVerified ? (
                <CheckCircle2 className="size-3.5" />
              ) : (
                <AlertCircle className="size-3.5" />
              )}
              {emailVerified ? t("account.verified") : t("account.unverified")}
            </Badge>
          </div>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {t("account.currentEmail", { email: email || t("account.emailUnavailable") })}
          </p>
          {pendingEmail ? (
            <p className="mt-1 break-all text-xs text-status-warn-foreground">
              {t("account.pendingEmail", { email: pendingEmail })}
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
            {t("account.resendVerification")}
          </Button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label={t("account.newEmail")} htmlFor="account-new-email">
          <Input
            id="account-new-email"
            type="email"
            autoComplete="email"
            value={emailDraft}
            onChange={(event) => onEmailDraftChange(event.target.value)}
          />
        </Field>
        <Field label={t("account.confirmEmail")} htmlFor="account-new-email-confirmation">
          <Input
            id="account-new-email-confirmation"
            type="email"
            autoComplete="email"
            value={emailConfirmationDraft}
            onChange={(event) => onEmailConfirmationDraftChange(event.target.value)}
          />
        </Field>
        <Field label={t("account.currentPassword")} htmlFor="account-email-current-password">
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
        <p className="text-xs leading-5 text-muted-foreground">{t("account.emailChangeHint")}</p>
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 sm:w-auto"
          disabled={isChanging}
          onClick={onChangeEmail}
        >
          {isChanging ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          {t("account.sendEmailChange")}
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
  const { t } = useLocale();
  return (
    <div className="rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold">{t("account.forgotPassword")}</p>
          <p className="break-words text-xs leading-5 text-muted-foreground">
            {t("account.resetHint")}
          </p>
          <p className="break-all text-xs text-muted-foreground">
            {email || t("auth.error.currentEmailUnavailable")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full shrink-0 gap-2 sm:w-auto"
          disabled={isSending || !email}
          onClick={onSend}
        >
          {isSending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          {t("account.sendReset")}
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
      <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground lg:text-xs lg:leading-4">
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

function resolveRoleLabel(
  status: OnboardingStatus | undefined,
  t: ReturnType<typeof useLocale>["t"],
) {
  if (!status) return t("account.role.loading");
  if (status.isPlatformAdmin) return t("account.role.platformAdmin");
  const role = status.activeStore?.role;
  if (!role) return t("account.role.noStore");
  const roleKeys: Record<string, MessageKey> = {
    owner: "account.role.owner",
    manager: "account.role.manager",
    technician: "account.role.technician",
    sales: "account.role.sales",
    viewer: "account.role.viewer",
  };
  const key = roleKeys[role];
  return key ? t(key) : role;
}

class SafeAccountPresentationError extends Error {
  constructor(readonly presentation: string) {
    super("safe-account-presentation-error");
  }
}

function accountActionError(
  error: unknown,
  t: ReturnType<typeof useLocale>["t"],
  fallbackKey: MessageKey,
) {
  return error instanceof SafeAccountPresentationError ? error.presentation : t(fallbackKey);
}
