import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseMode } from "@/lib/supabase/config";
import { isPreviewLoginAvailable } from "@/lib/preview-auth";

export const metadata: Metadata = { title: "登录" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const params = await searchParams;
  const notices: Record<string, string> = { "confirmation-failed": "验证链接无效或已过期，请重新获取验证邮件。", "oauth-failed": "第三方登录未完成或已取消，你可以重试或使用邮箱登录。", "password-updated": "密码已更新，请使用新密码登录。", "recovery-failed": "重置链接无效或已过期，请重新获取。" };
  return <LoginForm supabaseMode={isSupabaseMode()} previewAvailable={isPreviewLoginAvailable()} notice={notices[params.notice ?? ""] ?? ""} />;
}
