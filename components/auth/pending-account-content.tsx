"use client";

import { useLanguage } from "@/components/language-provider";
import { NavigationLink as Link } from "@/components/navigation-link";
import { Mail, ShieldCheck } from "lucide-react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { useAuthStatus } from "@/components/auth-status-provider";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function PendingAccountContent() {
  const { status, checking, refresh } = useAuthStatus();
  const router = useRouter();
  const unavailable = status.state === "unavailable";
  const verified = status.state === "account";
  useEffect(() => {
    if (status.state === "workspace" || status.state === "anonymous") { router.replace(status.state === "workspace" ? "/account/stores" : "/login"); router.refresh(); }
  }, [status.state, router]);
  const { t } = useLanguage();
  return <AuthFrame><div className="auth-form auth-success" role="status"><span className="auth-form__icon">{verified ? <ShieldCheck size={30} /> : <Mail size={30} />}</span><h1>{unavailable ? t("账号状态暂不可用") : verified ? t("邮箱已验证") : t("验证邮箱后继续")}</h1><p>{unavailable ? t("请稍后重试，或返回登录。") : verified ? t("现在可以创建门店，或通过邀请申请加入已有门店。") : t("如果此邮箱可以注册，请按邮件验证邮箱，再创建或申请加入门店。")}</p><button className="button button--primary" type="button" onClick={refresh} disabled={checking}>{t(checking ? "正在核对账号状态…" : "重新检查")}</button>{verified ? <><Link className="button button--primary" href="/account/stores">{t("创建或加入门店")}</Link><Link className="button button--secondary" href="/account/settings">{t("账号设置")}</Link><LogoutButton supabaseMode /></> : status.state === "unverified" ? <><Link className="button button--secondary" href="/verify-email">{t("重新验证邮箱")}</Link><LogoutButton supabaseMode /></> : null}<Link className="auth-back-link" href="/">{t("返回公开首页")}</Link></div></AuthFrame>;
}
