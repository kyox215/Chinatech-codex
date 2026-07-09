"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { AppBar } from "@/components/app-bar";
import { AppSidebar } from "@/components/app-sidebar";
import { useCommandPalette } from "@/components/use-command-palette";
import { MobileWorkspaceDock } from "@/components/mobile-workspace-dock";
import { PwaServiceWorker } from "@/components/pwa-service-worker";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { RealtimeAppBridge } from "@/features/realtime/components/realtime-app-bridge";
import { repairDeskQueryDefaultOptions } from "@/lib/query-performance";
import { appShell } from "@/lib/ui-patterns";

const CommandPalette = dynamic(
  () => import("@/components/command-palette").then((module) => module.CommandPalette),
  { ssr: false },
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: repairDeskQueryDefaultOptions }),
  );
  const { open, setOpen } = useCommandPalette();
  const pathname = usePathname();

  if (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/onboarding" ||
    pathname === "/kiosk"
  ) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
        <PwaServiceWorker />
        <Toaster />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeAppBridge>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="relative isolate min-h-svh min-w-0 max-w-full overflow-x-clip">
            <AppBar onOpenCommand={() => setOpen(true)} />
            <main className={appShell.content}>{children}</main>
            <MobileWorkspaceDock onOpenCommand={() => setOpen(true)} />
          </SidebarInset>
        </SidebarProvider>
        <PwaServiceWorker />
        {open ? <CommandPalette open={open} onOpenChange={setOpen} /> : null}
        <Toaster />
      </RealtimeAppBridge>
    </QueryClientProvider>
  );
}
