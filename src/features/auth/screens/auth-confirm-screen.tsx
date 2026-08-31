"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/shared/i18n/locale-provider";

export function AuthConfirmScreen({
  valid,
  tokenHash,
  type,
  next,
}: {
  valid: boolean;
  tokenHash: string;
  type: string;
  next: string;
}) {
  const { t } = useLocale();

  return (
    <main className="grid min-h-svh place-items-center bg-background px-2 py-3 sm:px-4 sm:py-8">
      <section className="w-full max-w-md rounded-lg border border-border/60 bg-card p-3 shadow-sm sm:p-5">
        <h1 className="font-display text-xl font-semibold sm:text-2xl">
          {valid ? t("auth.confirmOpenInvite") : t("auth.invalidInvite")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {valid ? t("auth.confirmInviteDescription") : t("auth.invalidInviteDescription")}
        </p>

        {valid ? (
          <form action="/auth/confirm/complete" method="post" className="mt-5">
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={next} />
            <Button type="submit" className="min-h-11 w-full">
              {t("auth.continueEmailVerification")}
            </Button>
          </form>
        ) : (
          <Button asChild variant="outline" className="mt-5 min-h-11 w-full">
            <Link href="/login">{t("auth.backToLogin")}</Link>
          </Button>
        )}

        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          {t("auth.confirmSecurityNotice")}
        </p>
      </section>
    </main>
  );
}
