import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { isSupabaseMode } from "@/lib/supabase/config";
import { isPreviewLoginAvailable } from "@/lib/preview-auth";

export const metadata: Metadata = { title: "注册申请" };

export default function RegisterPage() {
  return <RegisterForm supabaseMode={isSupabaseMode()} previewAvailable={isPreviewLoginAvailable()} />;
}
