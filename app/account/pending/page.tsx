import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { isSupabaseMode } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerAccess } from "@/lib/backend/context";

export const dynamic = "force-dynamic";
export default async function PendingAccountPage() {
  if (!isSupabaseMode()) redirect("/login");
  let active=false;
  try {active=Boolean(await getServerAccess());} catch { /* Await verification or a working database. */ }
  if(active) redirect("/app/dashboard");
  let verified = false; let unavailable = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    verified = !error && Boolean(data.user?.email_confirmed_at);
  } catch { unavailable = true; }
  return <main className="auth-page"><div className="auth-page__left"><Brand /><div className="auth-page__form-wrap"><div className="auth-form auth-success" role="status"><span className="auth-form__icon">{verified ? <ShieldCheck size={30} /> : <Mail size={30} />}</span><h1>{unavailable ? "账号状态暂不可用" : verified ? "等待门店授权" : "验证邮箱后继续"}</h1><p>{unavailable ? "请稍后重试，或返回登录。" : verified ? "邮箱已验证。请由门店老板邀请或授权后进入后台。" : "如果此邮箱可以注册，请按收到的邮件验证邮箱，再登录等待门店授权。"}</p>{verified ? <LogoutButton supabaseMode /> : <Link className="button button--primary auth-submit" href="/login">返回登录</Link>}<Link className="auth-back-link" href="/">返回公开首页</Link></div></div></div></main>;
}
