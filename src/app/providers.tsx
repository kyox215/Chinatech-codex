"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { AppBar } from "@/components/app-bar";
import { AppSidebar } from "@/components/app-sidebar";
import { BackgroundOrbs } from "@/components/background-orbs";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const { open, setOpen } = useCommandPalette();
  const pathname = usePathname();

  if (pathname === "/login") {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="relative isolate min-h-svh min-w-0 max-w-full overflow-x-hidden">
          <BackgroundOrbs />
          <AppBar onOpenCommand={() => setOpen(true)} />
          <main className="min-w-0 max-w-full flex-1 overflow-x-hidden">{children}</main>
        </SidebarInset>
      </SidebarProvider>
      <CommandPalette open={open} onOpenChange={setOpen} />
      <Toaster />
    </QueryClientProvider>
  );
}
