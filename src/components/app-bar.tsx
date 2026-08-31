"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { ScanLine, Sparkles, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EntityContextBackLink } from "@/components/entity-context-back-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import { RealtimeSyncIndicator } from "@/features/realtime";
import { useAiAssistantWorkspace } from "@/features/ai-assistant";
import { appShell } from "@/lib/ui-patterns";
import { getActiveWorkspaceItem } from "@/shared/config/navigation";
import { resolveEntityContextBack } from "@/shared/config/entity-context-routes";
import { localizeNavItem, localizeRouteLabel } from "@/shared/i18n/navigation";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey, MessageValues } from "@/shared/i18n/messages";
import { cn } from "@/lib/utils";

function useCrumbs(t: (key: MessageKey, values?: MessageValues) => string) {
  const pathname = usePathname() ?? "/";
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) return [{ label: t("nav.dashboard.title"), href: "/" }];
  return segs.map((seg, i) => ({
    label: localizeRouteLabel(seg, t) ?? decodeURIComponent(seg),
    href: "/" + segs.slice(0, i + 1).join("/"),
  }));
}

const repairOsMobileHeaderRoutes = new Set([
  "/",
  "/orders",
  "/orders/new",
  "/customers",
  "/memos",
  "/buyback",
  "/inventory",
  "/finance",
  "/messages",
  "/toolkit",
  "/platform",
  "/settings",
  "/settings/closed-stores",
]);

const repairOsMobileHeaderPrefixes =
  /^\/(?:orders|customers|memos|buyback|inventory|finance|messages|toolkit|platform|settings)(?:\/|$)/;

export function usesRepairOsMobileHeader(pathname: string) {
  return repairOsMobileHeaderRoutes.has(pathname);
}

export function getAppBarVisibilityClass(pathname: string) {
  if (usesRepairOsMobileHeader(pathname)) return "max-lg:hidden";
  if (repairOsMobileHeaderPrefixes.test(pathname)) return "max-md:hidden";
  return "";
}

export function AppBar({ onOpenScanner }: { onOpenScanner: () => void }) {
  const { t } = useLocale();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));
  const crumbs = useCrumbs(t);
  const pathname = usePathname() ?? "/";
  const entityContextBack = resolveEntityContextBack(pathname);
  const shell = useStoreShellContext();
  const aiAssistant = useAiAssistantWorkspace();
  const activeModule = localizeNavItem(getActiveWorkspaceItem(pathname, shell.isPlatformAdmin), t);
  const appBarVisibilityClass = getAppBarVisibilityClass(pathname);
  const mobileContextTitle =
    localizeRouteLabel(pathname.split("/").filter(Boolean)[0] ?? "", t) ?? activeModule.title;
  const activeStoreName =
    shell.activeStore?.name ?? (shell.isLoading ? t("shell.loadingStore") : t("shell.noStore"));

  return (
    <motion.header
      data-app-bar="true"
      className={cn(
        appShell.topBar,
        appBarVisibilityClass,
        scrolled ? "shadow-[var(--shadow-card)]" : "shadow-none",
      )}
    >
      <div className="flex h-full w-full min-w-0 items-center gap-2 px-3 md:px-5">
        <SidebarTrigger className="size-9 shrink-0 rounded-lg border border-[var(--border-panel)] bg-card shadow-[var(--shadow-card)] lg:rounded-md lg:border-0 lg:bg-transparent lg:shadow-none" />

        <div className="min-w-0 flex-1 md:hidden">
          <p
            data-app-bar-context="true"
            className="truncate text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70 lg:text-[11px] lg:leading-4 lg:tracking-normal lg:text-muted-foreground"
          >
            {mobileContextTitle}
          </p>
          <p className="truncate text-sm font-semibold leading-5 text-foreground">
            {activeStoreName}
          </p>
        </div>

        {entityContextBack ? (
          <EntityContextBackLink
            context={entityContextBack}
            className="ml-1 hidden lg:inline-flex"
          />
        ) : (
          <nav className="ml-1 hidden min-w-0 shrink items-center gap-1.5 text-sm md:flex">
            {crumbs.map((c, i) => (
              <span key={c.href} className="flex items-center gap-1.5 truncate">
                {i > 0 && <span className="text-muted-foreground/40">/</span>}
                {i === crumbs.length - 1 ? (
                  <span className="truncate font-medium">{c.label}</span>
                ) : (
                  <Link
                    href={c.href}
                    className="truncate text-muted-foreground hover:text-foreground"
                  >
                    {c.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        )}

        <div aria-hidden="true" className="min-w-0 flex-1" />

        {aiAssistant.canOpenOrderAssistant ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden h-9 shrink-0 gap-1.5 border-primary/30 bg-primary/10 px-2.5 text-primary hover:bg-primary/15 md:inline-flex"
            aria-label={t("shell.openAi")}
            data-ai-assistant-trigger="desktop"
            onClick={aiAssistant.openAssistant}
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span className="hidden lg:inline">{t("shell.aiAssistant")}</span>
          </Button>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 shrink-0 rounded-xl border border-[var(--border-panel)] bg-card shadow-[var(--shadow-card)] md:size-9 md:rounded-md md:bg-surface/60 md:shadow-none"
          aria-label={t("shell.scanGlobal")}
          onClick={onOpenScanner}
        >
          <ScanLine className="size-4" />
        </Button>

        <LanguageSwitcher className="rounded-xl border border-[var(--border-panel)] bg-card shadow-[var(--shadow-card)] md:rounded-md md:border-0 md:bg-transparent md:shadow-none" />

        <ThemeToggle className="size-10 rounded-xl border border-[var(--border-panel)] bg-card shadow-[var(--shadow-card)] md:size-9 md:rounded-md md:border-0 md:bg-transparent md:shadow-none" />

        <RealtimeSyncIndicator className="hidden md:inline-flex" />

        <Link
          href="/settings"
          className="hidden h-9 max-w-44 min-w-0 items-center gap-1.5 rounded-md border border-border/50 bg-surface/60 px-2 text-xs transition-colors hover:bg-accent hover:text-accent-foreground xl:inline-flex"
        >
          <Store className="size-3.5 text-muted-foreground" />
          <span className="min-w-0 truncate font-medium">{activeStoreName}</span>
          {shell.activeStore ? (
            <span className="size-1.5 shrink-0 rounded-full bg-status-success-foreground" />
          ) : null}
        </Link>
      </div>
    </motion.header>
  );
}
