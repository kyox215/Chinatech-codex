import { redirect } from "next/navigation";
import { getAuthStatus } from "@/lib/server/auth-status";
import { authDestination } from "@/lib/auth-status";
import { AuthStatusUnavailable } from "@/components/auth/auth-status-unavailable";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { isSupabaseMode } from "@/lib/supabase/config";
import { isPreviewLoginAvailable } from "@/lib/preview-auth";

export const metadata: Metadata = { title: "注册申请" };

export const dynamic = "force-dynamic";
export default async function RegisterPage() {
  const status = await getAuthStatus();
  if (status.state === "unavailable") return <AuthStatusUnavailable />;
  if (status.state === "workspace" || status.state === "account") redirect(authDestination(status.state));
  return <RegisterForm supabaseMode={isSupabaseMode()} previewAvailable={isPreviewLoginAvailable()} />;
}
