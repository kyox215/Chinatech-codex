"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getOnboardingStatus } from "@/lib/repairdesk/api";
import { brandGradientStyle } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { platformKeys } from "@/features/platform/api/query-keys";
import { resolvePostLoginPath } from "@/features/auth/model/post-login-redirect";
import { useLocale } from "@/shared/i18n/locale-provider";

export function RegisterCompleteScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const errorRef = useRef<HTMLDivElement | null>(null);
  const {
    data: status,
    isError,
    isFetching,
    isPending,
    isSuccess,
    refetch,
  } = useQuery({
    queryKey: platformKeys.onboardingStatus,
    queryFn: getOnboardingStatus,
  });
  const nextPath = useMemo(() => resolvePostLoginPath(status, "/onboarding"), [status]);

  useEffect(() => {
    if (isError) errorRef.current?.focus();
  }, [isError]);

  return (
    <main className="min-h-svh bg-background px-2 py-3 sm:px-4 sm:py-8 lg:grid lg:place-items-center">
      <section className="mx-auto w-full max-w-md rounded-lg border border-border/60 bg-card p-3 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2 sm:mb-5 sm:gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
            {isPending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : isError ? (
              <AlertTriangle className="size-5" />
            ) : (
              <CheckCircle2 className="size-5" />
            )}
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold sm:text-2xl">
              {isPending
                ? t("auth.registrationStatusLoading")
                : isError
                  ? t("auth.registrationStatusError")
                  : t("auth.registrationComplete")}
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {isPending
                ? t("auth.registrationStatusLoadingDescription")
                : isError
                  ? t("auth.registrationStatusErrorDescription")
                  : t("auth.registrationCompleteSubtitle")}
            </p>
          </div>
        </div>

        {isPending ? (
          <div
            role="status"
            className="rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-4 text-sm text-muted-foreground"
          >
            {t("auth.registrationStatusLoadingDescription")}
          </div>
        ) : isError ? (
          <>
            <div
              ref={errorRef}
              role="alert"
              tabIndex={-1}
              className="rounded-lg bg-status-danger/10 px-3 py-3 text-sm text-status-danger-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("auth.registrationStatusErrorDescription")}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={isFetching}
                onClick={() => void refetch()}
              >
                {isFetching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {t("auth.retry")}
              </Button>
              <Button asChild type="button" variant="ghost">
                <Link href="/login">{t("auth.backToLogin")}</Link>
              </Button>
            </div>
          </>
        ) : isSuccess ? (
          <>
            <div className="rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3">
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className={cn("grid size-9 shrink-0 place-items-center rounded-md text-white")}
                  style={brandGradientStyle}
                >
                  <Store className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t("auth.nextStep")}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {t("auth.nextStepDescription")}
                  </p>
                </div>
              </div>
            </div>

            <Button
              type="button"
              className="mt-4 w-full gap-2"
              style={brandGradientStyle}
              onClick={() => {
                router.replace(nextPath);
                router.refresh();
              }}
            >
              <Store className="size-4" />
              {t("auth.continueOnboarding")}
            </Button>
          </>
        ) : null}
      </section>
    </main>
  );
}
