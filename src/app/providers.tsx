"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AppBar } from "@/components/app-bar";
import { AppSidebar } from "@/components/app-sidebar";
import { BackgroundOrbs } from "@/components/background-orbs";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const { open, setOpen } = useCommandPalette();

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="relative isolate min-h-svh">
          <BackgroundOrbs />
          <AppBar onOpenCommand={() => setOpen(true)} />
          <main className="flex-1">{children}</main>
        </SidebarInset>
      </SidebarProvider>
      <CommandPalette open={open} onOpenChange={setOpen} />
      <Toaster />
    </QueryClientProvider>
  );
}
