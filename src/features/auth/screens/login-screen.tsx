"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2, LogIn, Mail, Store, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getOnboardingStatus } from "@/lib/repairdesk/api";
import { createClient } from "@/utils/supabase/client";
import { brandGradientStyle, controls } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import {
  DEFAULT_REMEMBER_LOGIN,
  persistBrowserAuthPreference,
  readRememberLoginPreference,
} from "@/features/auth/model/auth-persistence";
import {
  authErrorMessage,
  normalizeAuthEmail,
  passwordResetSentMessage,
  validateEmailAddress,
  validateNewPassword,
  verificationEmailSentMessage,
} from "@/features/auth/model/auth-errors";
import {
  REGISTRATION_COMPLETE_PATH,
  buildAuthCallbackUrl,
} from "@/features/auth/model/auth-redirect";
import { resolvePostLoginPath } from "@/features/auth/model/post-login-redirect";
import { useLocale } from "@/shared/i18n/locale-provider";

export function LoginScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get("next") || "/", [searchParams]);
  const [mode, setMode] = useState<"login" | "register" | "reset" | "update-password">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationPasswordConfirmation, setRegistrationPasswordConfirmation] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(DEFAULT_REMEMBER_LOGIN);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  useEffect(() => {
    setRememberMe(readRememberLoginPreference());
  }, []);

  useEffect(() => {
    if (searchParams.get("mode") === "update-password") {
      setMode("update-password");
    }
    if (searchParams.get("auth_error") === "callback") {
      toast.error(t("auth.callbackExpired"));
    }
    if (searchParams.get("auth_error") === "invite") {
      toast.error(t("auth.inviteExpired"));
    }
    if (searchParams.get("password_updated") === "1") {
      toast.success(t("auth.passwordUpdated"));
    }
  }, [searchParams, t]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = normalizeAuthEmail(email);
    setIsSubmitting(true);
    persistBrowserAuthPreference(rememberMe);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    setIsSubmitting(false);

    if (error) {
      toast.error(authErrorMessage(error, t));
      return;
    }

    setEmail(normalizedEmail);
    const status = await getOnboardingStatus().catch(() => null);
    router.replace(resolvePostLoginPath(status, next));
    router.refresh();
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = normalizeAuthEmail(email);
    const emailError = validateEmailAddress(normalizedEmail, t);
    if (emailError) {
      toast.error(emailError);
      return;
    }
    const passwordError = validateNewPassword(password, registrationPasswordConfirmation, t);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }
    setIsSubmitting(true);
    persistBrowserAuthPreference(rememberMe);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          display_name: displayName.trim(),
        },
        emailRedirectTo: buildAuthCallbackUrl(REGISTRATION_COMPLETE_PATH),
      },
    });

    if (error) {
      setIsSubmitting(false);
      toast.error(authErrorMessage(error, t));
      return;
    }

    setEmail(normalizedEmail);
    setPassword("");
    setRegistrationPasswordConfirmation("");
    setVerificationEmail(normalizedEmail);
    setMode("login");
    if (data.session) {
      await supabase.auth.signOut();
    }
    setIsSubmitting(false);
    toast.success(t("auth.registrationEmailSent"));
  }

  async function handlePasswordResetRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = normalizeAuthEmail(email);
    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: buildAuthCallbackUrl("/reset-password"),
    });
    setIsSubmitting(false);

    if (error) {
      toast.error(authErrorMessage(error, t));
      return;
    }

    setEmail(normalizedEmail);
    toast.success(passwordResetSentMessage(t));
    setMode("login");
  }

  async function handleResendVerification() {
    const normalizedEmail = normalizeAuthEmail(verificationEmail || email);
    const emailError = validateEmailAddress(normalizedEmail, t);
    if (emailError) {
      toast.error(emailError);
      return;
    }
    setIsResendingVerification(true);
    const { error } = await createClient().auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: {
        emailRedirectTo: buildAuthCallbackUrl(REGISTRATION_COMPLETE_PATH),
      },
    });
    setIsResendingVerification(false);
    if (error) {
      toast.error(authErrorMessage(error, t));
      return;
    }
    setVerificationEmail(normalizedEmail);
    toast.success(verificationEmailSentMessage(t));
  }

  async function handlePasswordUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateNewPassword(newPassword, newPasswordConfirmation, t);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsSubmitting(false);

    if (error) {
      toast.error(authErrorMessage(error, t));
      return;
    }

    toast.success(t("auth.passwordUpdated"));
    await supabase.auth.signOut();
    setPassword("");
    setNewPassword("");
    setNewPasswordConfirmation("");
    setMode("login");
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="min-h-svh bg-background px-2 py-3 sm:px-4 sm:py-8 lg:grid lg:place-items-center">
      <div className="mx-auto grid w-full max-w-5xl min-w-0 gap-3 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] lg:items-center">
        <section className="hidden min-w-0 lg:block">
          <div className="max-w-xl space-y-5">
            <div className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
              <Store className="size-6" />
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium text-primary">RepairDesk Platform</p>
              <h2 className="font-display text-4xl font-semibold tracking-tight text-foreground">
                RepairDesk
              </h2>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                {t("auth.platformDescription")}
              </p>
            </div>
            <div className="grid max-w-lg grid-cols-2 gap-3 text-sm">
              <div className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel)] p-3">
                <p className="text-xs text-muted-foreground">{t("auth.storeProfile")}</p>
                <p className="mt-1 truncate font-medium">{t("auth.readAfterLogin")}</p>
              </div>
              <div className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel)] p-3">
                <p className="text-xs text-muted-foreground">{t("auth.publicIdentity")}</p>
                <p className="mt-1 truncate font-medium">{t("auth.currentStoreConfig")}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full rounded-lg border border-border/60 bg-card p-3 shadow-sm sm:p-5 lg:justify-self-end">
          <div className="mb-3 flex items-center gap-2 sm:mb-5 sm:gap-3">
            <div className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary sm:size-10">
              <KeyRound className="size-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold sm:text-2xl">
                {t("auth.loginTitle")}
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">{t("auth.loginSubtitle")}</p>
            </div>
          </div>

          {mode === "reset" ? (
            <form className="space-y-3 sm:space-y-4" onSubmit={handlePasswordResetRequest}>
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">{t("auth.email")}</Label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <SubmitButton isSubmitting={isSubmitting} icon="reset">
                {t("auth.sendReset")}
              </SubmitButton>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode("login")}
              >
                {t("auth.backToLogin")}
              </Button>
            </form>
          ) : mode === "update-password" ? (
            <form className="space-y-3 sm:space-y-4" onSubmit={handlePasswordUpdate}>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">{t("auth.newPassword")}</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password-confirmation">{t("auth.confirmNewPassword")}</Label>
                <Input
                  id="new-password-confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={newPasswordConfirmation}
                  onChange={(event) => setNewPasswordConfirmation(event.target.value)}
                  required
                />
              </div>
              <SubmitButton isSubmitting={isSubmitting} icon="reset">
                {t("auth.updatePassword")}
              </SubmitButton>
            </form>
          ) : (
            <Tabs value={mode} onValueChange={(value) => setMode(value as "login" | "register")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">{t("auth.login")}</TabsTrigger>
                <TabsTrigger value="register">{t("auth.register")}</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form className="space-y-3 sm:space-y-4" onSubmit={handleLogin}>
                  <LoginFields
                    email={email}
                    password={password}
                    onEmailChange={setEmail}
                    onPasswordChange={setPassword}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <RememberLoginCheckbox checked={rememberMe} onCheckedChange={setRememberMe} />
                    <Button
                      type="button"
                      variant="link"
                      className="min-h-11 px-0 text-xs lg:min-h-0"
                      onClick={() => router.push("/forgot-password")}
                    >
                      {t("auth.forgotPassword")}
                    </Button>
                  </div>
                  <SubmitButton isSubmitting={isSubmitting} icon="login">
                    {t("auth.login")}
                  </SubmitButton>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form className="space-y-3 sm:space-y-4" onSubmit={handleRegister}>
                  <div className="space-y-1.5">
                    <Label htmlFor="displayName">{t("auth.name")}</Label>
                    <Input
                      id="displayName"
                      autoComplete="name"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      required
                    />
                  </div>
                  <LoginFields
                    email={email}
                    password={password}
                    onEmailChange={setEmail}
                    onPasswordChange={setPassword}
                    passwordAutoComplete="new-password"
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="register-password-confirmation">
                      {t("auth.confirmPassword")}
                    </Label>
                    <Input
                      id="register-password-confirmation"
                      type="password"
                      autoComplete="new-password"
                      value={registrationPasswordConfirmation}
                      onChange={(event) => setRegistrationPasswordConfirmation(event.target.value)}
                      required
                    />
                  </div>
                  <RememberLoginCheckbox checked={rememberMe} onCheckedChange={setRememberMe} />
                  <SubmitButton isSubmitting={isSubmitting} icon="register">
                    {t("auth.sendVerification")}
                  </SubmitButton>
                </form>
              </TabsContent>
            </Tabs>
          )}

          {verificationEmail ? (
            <div className="mt-4 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2 text-xs leading-5 text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-status-success-foreground" />
                <p>{t("auth.registrationVerificationSent", { email: verificationEmail })}</p>
              </div>
              <Button
                type="button"
                variant="link"
                className="mt-1 h-auto px-0 text-xs"
                disabled={isResendingVerification}
                onClick={handleResendVerification}
              >
                {isResendingVerification ? t("auth.resending") : t("auth.resendRegistration")}
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function RememberLoginCheckbox({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id="remember-login"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <Label htmlFor="remember-login" className="cursor-pointer text-sm font-normal">
        {t("auth.rememberLogin")}
      </Label>
    </div>
  );
}

function LoginFields({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  passwordAutoComplete = "current-password",
}: {
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  passwordAutoComplete?: string;
}) {
  const { t } = useLocale();
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t("auth.password")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete={passwordAutoComplete}
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          required
        />
      </div>
    </>
  );
}

function SubmitButton({
  isSubmitting,
  icon,
  children,
}: {
  isSubmitting: boolean;
  icon: "login" | "register" | "reset";
  children: React.ReactNode;
}) {
  const Icon = icon === "register" ? UserPlus : icon === "reset" ? Mail : LogIn;
  return (
    <Button
      type="submit"
      disabled={isSubmitting}
      className={cn("w-full gap-2", controls.brandButton)}
      style={brandGradientStyle}
    >
      {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      {children}
    </Button>
  );
}
