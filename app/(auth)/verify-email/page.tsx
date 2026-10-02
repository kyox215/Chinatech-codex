import type { Metadata } from "next";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { isSupabaseMode } from "@/lib/supabase/config";
export const metadata: Metadata = { title: "验证邮箱" };
export default function VerifyEmailPage() { return <VerifyEmailForm supabaseMode={isSupabaseMode()} />; }
