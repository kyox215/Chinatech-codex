import type { ReactNode } from "react";
import { AuthStatusProvider } from "@/components/auth-status-provider";
import { getPublicAuthBootstrap } from "@/lib/server/auth-status";

export async function PublicAuthPage({ children }: { children: ReactNode }) {
  const initial = await getPublicAuthBootstrap();
  return <AuthStatusProvider initial={initial.status} initialChecking={initial.checking}>{children}</AuthStatusProvider>;
}
