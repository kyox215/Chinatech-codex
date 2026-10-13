import { AuthStatusProvider } from "@/components/auth-status-provider";
import { getAuthStatus } from "@/lib/server/auth-status";
export const dynamic = "force-dynamic";
export default async function ToolboxLayout({ children }: { children: React.ReactNode }) {
  return <AuthStatusProvider initial={await getAuthStatus()}>{children}</AuthStatusProvider>;
}
