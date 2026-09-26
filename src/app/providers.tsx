"use client";

import { AppBar } from "@/components/app-bar";
import { AppSidebar } from "@/components/app-sidebar";
import { LanguageSwitcher } from "@/components/language-switcher";
import { MobileWorkspaceDock } from "@/components/mobile-workspace-dock";
import { NavigationGuardProvider } from "@/components/navigation-guard-provider";
import { PwaServiceWorker } from "@/components/pwa-service-worker";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useCommandPalette } from "@/components/use-command-palette";
import { OfflineOutboxSyncBridge } from "@/features/offline/components/offline-outbox-sync-bridge";
import { AppPreloadBridge } from "@/features/preload";
import { RealtimeAppBridge } from "@/features/realtime";
import { repairDeskQueryDefaultOptions } from "@/lib/query-performance";
import { appShell } from "@/lib/ui-patterns";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { MessageCatalog } from "@/shared/i18n/runtime-messages";
import type { AppLocale } from "@/shared/i18n/locales";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";

const CommandPalette = dynamic(
  () => import("@/components/command-palette").then((module) => module.CommandPalette),
  { ssr: false },
);
const ScanSearchSheet = dynamic(
  () => import("@/features/capture").then((module) => module.ScanSearchSheet),
  { ssr: false },
);

export function Providers({
  children,
  initialLocale,
  initialMessages,
}: {
  children: React.ReactNode;
  initialLocale: AppLocale;
  initialMessages: MessageCatalog;
}) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: repairDeskQueryDefaultOptions }),
  );
  const { open, setOpen } = useCommandPalette();
  const [scannerOpen, setScannerOpen] = useState(false);
  const scannerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const openScannerFromCommand = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => {
      scannerTriggerRef.current?.focus({ preventScroll: true });
      setScannerOpen(true);
    });
  }, [setOpen]);
  const pathname = usePathname();

  if (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/onboarding" ||
    pathname === "/register/complete" ||
    pathname === "/invite/complete" ||
    pathname.startsWith("/auth/confirm") ||
    pathname === "/kiosk" ||
    pathname === "/r"
  ) {
    const usesCustomerCommunicationLanguage = pathname === "/kiosk" || pathname === "/r";
    return (
      <LocaleProvider initialLocale={initialLocale} initialMessages={initialMessages}>
        <QueryClientProvider client={queryClient}>
          {!usesCustomerCommunicationLanguage ? (
            <div className="fixed right-3 top-3 z-[80] rounded-xl border border-[var(--border-panel)] bg-card/95 shadow-[var(--shadow-card)] backdrop-blur">
              <LanguageSwitcher />
            </div>
          ) : null}
          {children}
          <PwaServiceWorker />
          <Toaster />
        </QueryClientProvider>
      </LocaleProvider>
    );
  }

  return (
    <LocaleProvider initialLocale={initialLocale} initialMessages={initialMessages}>
      <QueryClientProvider client={queryClient}>
        <NavigationGuardProvider>
          <RealtimeAppBridge>
            <AppPreloadBridge>
              <>
                <OfflineOutboxSyncBridge />
                <SidebarProvider>
                  <AppSidebar onOpenCommand={() => setOpen(true)} />
                  <SidebarInset
                    data-workbench-content="true"
                    className="relative isolate min-h-svh min-w-0 max-w-full overflow-x-clip"
                  >
                    <AppBar
                      onOpenScanner={() => setScannerOpen(true)}
                      scannerTriggerRef={scannerTriggerRef}
                    />
                    <main className={appShell.content}>{children}</main>
                    <MobileWorkspaceDock onOpenCommand={() => setOpen(true)} />
                  </SidebarInset>
                </SidebarProvider>
                <PwaServiceWorker />
                {open ? (
                  <CommandPalette
                    open={open}
                    onOpenChange={setOpen}
                    onOpenScanner={openScannerFromCommand}
                  />
                ) : null}
                {scannerOpen ? (
                  <ScanSearchSheet
                    open
                    onOpenChange={setScannerOpen}
                    scope="global"
                    returnFocusRef={scannerTriggerRef}
                  />
                ) : null}
                <Toaster />
              </>
            </AppPreloadBridge>
          </RealtimeAppBridge>
        </NavigationGuardProvider>
      </QueryClientProvider>
    </LocaleProvider>
  );
}
