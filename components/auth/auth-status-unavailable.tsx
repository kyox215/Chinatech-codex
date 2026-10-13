"use client";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
export function AuthStatusUnavailable() {
  const { t } = useLanguage();
  return <div className="auth-form" role="status"><h1>{t("账号状态暂不可用")}</h1><p>{t("请稍后重试，或返回登录。")}</p><button type="button" className="button button--primary" onClick={() => window.location.reload()}>{t("重新检查")}</button><Link className="auth-back-link" href="/">{t("返回公开首页")}</Link></div>;
}
