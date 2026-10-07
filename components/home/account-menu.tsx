"use client";
import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { ChevronDown, Mail, MonitorSmartphone, Settings, UserRound } from "lucide-react";
import type { AuthStatus } from "@/lib/auth-status";
import { staffRoles } from "@/lib/staff";
import { useLanguage } from "@/components/language-provider";
import { LogoutButton } from "@/components/dashboard/logout-button";
import styles from "./home.module.css";

export function AccountMenu({ status }: { status: AuthStatus }) {
  const { t } = useLanguage();
  const details = useRef<HTMLDetailsElement>(null);
  const menuId = useId();
  const name = status.formal ? status.account?.name || status.account?.email || t("当前账号") : t("本地预览");
  const stateLabel = !status.formal ? "本地预览" : status.state === "workspace" ? "已获门店授权" : status.state === "unverified" ? "验证邮箱后继续" : "等待门店授权";
  useEffect(() => {
    const outside = (event: Event) => { if (details.current?.open && event.target instanceof Node && !details.current.contains(event.target)) details.current.open = false; };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && details.current?.open) { event.preventDefault(); event.stopPropagation(); details.current.open = false; details.current.querySelector("summary")?.focus({ preventScroll: true }); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("focusin", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); document.removeEventListener("keydown", escape); };
  }, []);
  const close = () => { if (details.current) details.current.open = false; };
  return <details ref={details} className={styles.accountMenu}>
    <summary className={styles.accountTrigger} aria-label={`${t("账号菜单")} ${name}`} aria-controls={menuId} title={name}>
      <span className="profile-menu__avatar"><UserRound size={18} aria-hidden="true" /></span><span className={styles.accountName}>{name}</span><ChevronDown size={14} aria-hidden="true" />
    </summary>
    <div className={styles.accountPanel} id={menuId} role="region" aria-label={t("账号详情")}>
      <div className={styles.accountIdentity}><strong>{name}</strong>{status.account?.email && status.account.email !== name && <span>{status.account.email}</span>}</div>
      <dl className={styles.accountFacts}>
        <div><dt>{t("账号状态")}</dt><dd>{t(stateLabel)}</dd></div>
        {status.formal && status.account?.email && <div><dt>{t("邮箱验证")}</dt><dd>{t("邮箱已验证")}</dd></div>}
        {status.store && <><div><dt>{t("当前门店")}</dt><dd>{status.store.name}</dd></div><div><dt>{t("角色")}</dt><dd>{status.store.role ? t(staffRoles[status.store.role]) : t("门店成员")}</dd></div></>}
      </dl>
      <div className={styles.accountLinks}>
        {status.formal && status.state !== "unverified" && <><Link href="/account/settings" prefetch={false} onClick={close}><Settings size={18} aria-hidden="true" />{t("账号设置")}</Link><Link href="/account/settings#login-devices" prefetch={false} onClick={close}><MonitorSmartphone size={18} aria-hidden="true" />{t("登录设备")}</Link></>}
        {status.state === "unverified" && <Link href="/verify-email" prefetch={false} onClick={close}><Mail size={18} aria-hidden="true" />{t("重新验证邮箱")}</Link>}
        <LogoutButton supabaseMode={status.formal} className={styles.accountPanelLogout} />
      </div>
    </div>
  </details>;
}
