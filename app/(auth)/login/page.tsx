import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseMode } from "@/lib/supabase/config";
import { isPreviewLoginAvailable } from "@/lib/preview-auth";

export const metadata: Metadata = { title: "登录" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const params = await searchParams;
  return <LoginForm supabaseMode={isSupabaseMode()} previewAvailable={isPreviewLoginAvailable()} notice={params.notice === "confirmation-failed" ? "验证链接无效或已过期，请重新注册或联系门店。" : ""} />;
}
