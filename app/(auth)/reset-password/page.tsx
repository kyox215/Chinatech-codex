import type { Metadata } from "next";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { isSupabaseMode } from "@/lib/supabase/config";
export const metadata: Metadata = { title: "设置新密码" };
export default function ResetPasswordPage() { return <PasswordRecoveryForm reset supabaseMode={isSupabaseMode()} />; }
