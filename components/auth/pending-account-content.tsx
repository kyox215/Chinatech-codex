"use client";

import { useLanguage } from "@/components/language-provider";
import Link from "next/link";
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
    if (status.state === "workspace" || status.state === "anonymous") { router.replace(status.state === "workspace" ? "/app/dashboard" : "/login"); router.refresh(); }
  }, [status.state, router]);
  const { t } = useLanguage();
  return <AuthFrame><div className="auth-form auth-success" role="status"><span className="auth-form__icon">{verified ? <ShieldCheck size={30} /> : <Mail size={30} />}</span><h1>{unavailable ? t("账号状态暂不可用") : verified ? t("等待门店授权") : t("验证邮箱后继续")}</h1><p>{unavailable ? t("请稍后重试，或返回登录。") : verified ? t("邮箱已验证。请由门店老板邀请或授权后进入后台。") : t("如果此邮箱可以注册，请按收到的邮件验证邮箱，再登录等待门店授权。")}</p><button className="button button--primary" type="button" onClick={refresh} disabled={checking}>{t(checking ? "正在核对账号状态…" : "重新检查")}</button>{verified ? <><Link className="button button--secondary" href="/account/settings">{t("账号设置")}</Link><LogoutButton supabaseMode /></> : status.state === "unverified" ? <><Link className="button button--secondary" href="/verify-email">{t("重新验证邮箱")}</Link><LogoutButton supabaseMode /></> : null}<Link className="auth-back-link" href="/">{t("返回公开首页")}</Link></div></AuthFrame>;
}
