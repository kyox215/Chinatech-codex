"use client";

import NextLink, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { useLanguage } from "./language-provider";

function NavigationFeedback() {
  const { pending } = useLinkStatus();
  const { t } = useLanguage();
  return <><span className="navigation-feedback" data-pending={pending} aria-hidden="true" /><span className="sr-only" aria-live="polite" aria-atomic="true" role={pending ? "status" : undefined}>{pending ? t("正在打开页面…") : ""}</span></>;
}

/** Next owns navigation cancellation and completion; no timers invent progress. */
export function NavigationLink({ children, className, prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink {...props} prefetch={prefetch} className={[className, "navigation-link"].filter(Boolean).join(" ")}>{children}<NavigationFeedback /></NextLink>;
}
