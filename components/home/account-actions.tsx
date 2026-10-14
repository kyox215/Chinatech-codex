"use client";
import { NavigationLink as Link } from "@/components/navigation-link";
import { AccountMenu } from "./account-menu";
import { useAuthStatus } from "@/components/auth-status-provider";
import { useLanguage } from "@/components/language-provider";
import { authDestination } from "@/lib/auth-status";
import styles from "./home.module.css";
import { LoaderCircle } from "lucide-react";

export function AccountActions({ variant = "nav", compact = false }: { variant?: "nav" | "primary" | "cta" | "footer"; compact?: boolean }) {
  const { status, checking, refresh } = useAuthStatus();
  const { t } = useLanguage();
  if (status.state === "unavailable") return <span className={styles.accountFeedback} data-operation-feedback="background"><span role="status">{checking && <LoaderCircle size={16} className="spin" aria-hidden="true" />}{t(checking ? "正在核对账号状态…" : "账号状态暂不可用")}</span><button type="button" className="button button--secondary" onClick={refresh} disabled={checking} aria-busy={checking}>{t("重新检查")}</button><noscript><Link href="/login">{t("登录")}</Link><Link href="/register">{t("注册")}</Link></noscript></span>;
  const anonymous = status.state === "anonymous";
  const destination = authDestination(status.state);
  const label = status.state === "workspace" ? variant === "nav" ? "工作台" : "进入工作台" : status.state === "account" ? "账号状态" : status.state === "unverified" ? "验证邮箱后继续" : variant === "primary" ? "开始使用" : variant === "cta" ? "登录工作台" : "登录";
  if (!anonymous && variant === "nav") return <><AccountMenu key={`${status.scope}:${status.state}`} status={status} compact={compact} />{!compact && <Link className="button button--primary" href={destination} prefetch={false}>{t(label)}</Link>}</>;
  const primaryClass = variant === "footer" || (anonymous && variant === "nav") ? undefined : "button button--primary";
  return <>
    <Link className={primaryClass} href={destination} prefetch={false}>{t(label)}</Link>
    {variant !== "primary" && (anonymous ? <Link className={variant === "footer" ? undefined : `button button--${variant === "nav" ? "primary" : "secondary"}`} href="/register" prefetch={false}>{t(variant === "nav" || variant === "footer" ? "注册" : "创建账号")}</Link> : <>
      {status.formal && status.state !== "unverified" && <Link className={variant === "cta" ? "button button--secondary" : undefined} href="/account/settings" prefetch={false}>{t("账号设置")}</Link>}
    </>)}
  </>;
}
