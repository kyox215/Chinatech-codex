"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, KeyRound, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  authErrorMessage,
  authErrorMessageKey,
  normalizeAuthEmail,
  passwordResetSentMessage,
} from "@/features/auth/model/auth-errors";
import { buildAuthCallbackUrl } from "@/features/auth/model/auth-redirect";
import { brandGradientStyle, controls } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey } from "@/shared/i18n/messages";

export function ForgotPasswordScreen() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrorKey, setFormErrorKey] = useState<MessageKey | null>(null);
  const formErrorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const error = searchParams.get("auth_error");
    if (error === "callback") {
      setFormErrorKey("auth.resetLinkExpired");
      toast.error(t("auth.resetLinkExpired"));
    }
    if (error === "session") {
      setFormErrorKey("auth.resetSessionRequired");
      toast.error(t("auth.resetSessionRequired"));
    }
  }, [searchParams, t]);

  useEffect(() => {
    if (formErrorKey) formErrorRef.current?.focus();
  }, [formErrorKey]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormErrorKey(null);
    const normalizedEmail = normalizeAuthEmail(email);
    setIsSubmitting(true);
    const { error } = await createClient().auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: buildAuthCallbackUrl("/reset-password"),
    });
    setIsSubmitting(false);

    if (error) {
      const key = authErrorMessageKey(error);
      setFormErrorKey(key);
      toast.error(authErrorMessage(error, t));
      return;
    }

    setEmail(normalizedEmail);
    setSentTo(normalizedEmail);
    toast.success(passwordResetSentMessage(t));
  }

  return (
    <main className="grid min-h-svh bg-background px-2 py-3 sm:place-items-center sm:px-4 sm:py-8">
      <section className="mx-auto w-full max-w-md self-start rounded-lg border border-border/60 bg-card p-3 shadow-sm sm:self-auto sm:p-5">
        <Link
          href="/login"
          className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:mb-4"
        >
          <ArrowLeft className="size-4" />
          {t("auth.backToLogin")}
        </Link>
        <div className="mb-3 flex items-center gap-2 sm:mb-5 sm:gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold sm:text-2xl">
              {t("auth.forgotTitle")}
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">{t("auth.forgotSubtitle")}</p>
          </div>
        </div>

        {formErrorKey ? (
          <div
            ref={formErrorRef}
            id="forgot-password-error"
            role="alert"
            tabIndex={-1}
            className="mb-3 rounded-lg bg-status-danger/10 px-3 py-2 text-sm text-status-danger-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t(formErrorKey)}
          </div>
        ) : null}

        <form className="space-y-3 sm:space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="reset-email">{t("auth.email")}</Label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setFormErrorKey(null);
              }}
              required
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn("w-full gap-2", controls.brandButton)}
            style={brandGradientStyle}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Mail className="size-4" />
            )}
            {t("auth.sendReset")}
          </Button>
        </form>

        {sentTo ? (
          <p className="mt-4 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2 text-xs leading-5 text-muted-foreground">
            {t("auth.resetSentHint", { email: sentTo })}
          </p>
        ) : null}
      </section>
    </main>
  );
}
