import { AuthStatusProvider } from "@/components/auth-status-provider";
import { getPublicAuthBootstrap } from "@/lib/server/auth-status";
import { DownloadFeedbackProvider } from "@/components/download-link";
export const dynamic = "force-dynamic";
export default async function ToolboxLayout({ children }: { children: React.ReactNode }) {
  const initial = await getPublicAuthBootstrap();
  return <AuthStatusProvider initial={initial.status} initialChecking={initial.checking}><DownloadFeedbackProvider>{children}</DownloadFeedbackProvider></AuthStatusProvider>;
}
