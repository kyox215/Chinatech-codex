"use client";

import Link from "next/link";
import { AlertTriangle, Building2, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { StoreShellContextSnapshot } from "@/features/stores/model/store-shell-context";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const stateAction = {
  platform_admin: {
    href: "/platform",
    label: "进入平台管理",
    icon: ShieldCheck,
  },
  onboarding_required: {
    href: "/onboarding",
    label: "前往店铺开通",
    icon: Building2,
  },
} as const;

export function StoreShellUnavailableState({
  shell,
  className,
  onRetry,
  title,
  description,
  actionLabel,
  retryLabel,
}: {
  shell: StoreShellContextSnapshot;
  className?: string;
  onRetry?: () => Promise<unknown> | unknown;
  title?: string;
  description?: string;
  actionLabel?: string;
  retryLabel?: string;
}) {
  const isError = shell.status === "error";
  const action =
    shell.status === "platform_admin"
      ? stateAction.platform_admin
      : stateAction.onboarding_required;
  const Icon = isError ? AlertTriangle : action.icon;

  return (
    <div
      data-ui="store-shell-unavailable"
      className={cn(
        "mx-auto grid min-h-[52dvh] w-full max-w-md place-items-center px-3",
        className,
      )}
    >
      <section
        className={cn(
          repairOs.mobileInfoCard,
          "flex w-full flex-col items-center px-5 py-6 text-center",
        )}
      >
        <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <h1 className="mt-3 text-base font-semibold leading-5">{title ?? shell.statusLabel}</h1>
        <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
          {description ?? shell.statusDescription}
        </p>
        {isError ? (
          <Button
            type="button"
            size="sm"
            className="mt-4 h-9 gap-1.5 rounded-lg px-3"
            onClick={() => void onRetry?.()}
          >
            <RefreshCw className="size-3.5" /> {retryLabel ?? "重新读取"}
          </Button>
        ) : (
          <Button asChild size="sm" className="mt-4 h-9 rounded-lg px-3">
            <Link href={action.href}>{actionLabel ?? action.label}</Link>
          </Button>
        )}
      </section>
    </div>
  );
}
