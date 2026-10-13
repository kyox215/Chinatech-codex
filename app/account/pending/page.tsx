import { redirect } from "next/navigation";
import { PendingAccountContent } from "@/components/auth/pending-account-content";
import { isSupabaseMode } from "@/lib/supabase/config";
import { getAuthStatus } from "@/lib/server/auth-status";
import { AuthStatusProvider } from "@/components/auth-status-provider";

export const dynamic = "force-dynamic";
export default async function PendingAccountPage() {
  if (!isSupabaseMode()) redirect("/login");
  const status = await getAuthStatus();
  if (status.state === "workspace") redirect("/app/dashboard");
  if (status.state === "anonymous") redirect("/login");
  return <AuthStatusProvider initial={status}><PendingAccountContent /></AuthStatusProvider>;
}
