"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { AppBar } from "@/components/app-bar";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
import { MobileWorkspaceDock } from "@/components/mobile-workspace-dock";
import { PwaServiceWorker } from "@/components/pwa-service-worker";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { appShell } from "@/lib/ui-patterns";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const { open, setOpen } = useCommandPalette();
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/onboarding") {
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
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="relative isolate min-h-svh min-w-0 max-w-full overflow-x-clip">
          <AppBar onOpenCommand={() => setOpen(true)} />
          <main className={appShell.content}>{children}</main>
          <MobileWorkspaceDock onOpenCommand={() => setOpen(true)} />
        </SidebarInset>
      </SidebarProvider>
      <PwaServiceWorker />
      <CommandPalette open={open} onOpenChange={setOpen} />
      <Toaster />
    </QueryClientProvider>
  );
}
