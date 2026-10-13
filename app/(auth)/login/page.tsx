import { redirect } from "next/navigation";
import { getAuthStatus } from "@/lib/server/auth-status";
import { authDestination } from "@/lib/auth-status";
import { AuthStatusUnavailable } from "@/components/auth/auth-status-unavailable";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseMode } from "@/lib/supabase/config";
import { isPreviewLoginAvailable } from "@/lib/preview-auth";

export const metadata: Metadata = { title: "登录" };

export const dynamic = "force-dynamic";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const status = await getAuthStatus();
  if (status.state === "unavailable") return <AuthStatusUnavailable />;
  if (status.state === "workspace" || status.state === "account") redirect(authDestination(status.state));
  const params = await searchParams;
  const notices: Record<string, string> = { "confirmation-failed": "验证链接无效或已过期，请重新获取验证邮件。", "oauth-failed": "第三方登录未完成或已取消，你可以重试或使用邮箱登录。", "password-updated": "密码已更新，请使用新密码登录。", "recovery-failed": "重置链接无效或已过期，请重新获取。" };
  return <LoginForm supabaseMode={isSupabaseMode()} previewAvailable={isPreviewLoginAvailable()} notice={notices[params.notice ?? ""] ?? ""} />;
}
