"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage, validateNewPassword } from "@/features/auth/model/auth-errors";
import { brandGradientStyle, controls } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useLocale } from "@/shared/i18n/locale-provider";

export function ResetPasswordScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateNewPassword(newPassword, newPasswordConfirmation, t);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setIsSubmitting(false);
      toast.error(authErrorMessage(error, t));
      return;
    }

    await fetch("/auth/recovery/complete", { method: "POST" }).catch(() => undefined);
    await supabase.auth.signOut();
    toast.success(t("auth.passwordUpdated"));
    router.replace("/login?password_updated=1");
    router.refresh();
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
              {t("auth.resetTitle")}
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">{t("auth.resetSubtitle")}</p>
          </div>
        </div>

        <form className="space-y-3 sm:space-y-4" onSubmit={handleSubmit}>
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
          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn("w-full gap-2", controls.brandButton)}
            style={brandGradientStyle}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            {t("auth.updatePassword")}
          </Button>
        </form>
      </section>
    </main>
  );
}
