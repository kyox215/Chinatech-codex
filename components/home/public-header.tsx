"use client";

import Link from "next/link";
import { ArrowLeft, PanelsTopLeft } from "lucide-react";
import { AccountActions } from "./account-actions";
import { useEffect, useRef } from "react";
import { useAuthStatus } from "@/components/auth-status-provider";
import { Brand } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";
import styles from "./home.module.css";

export function PublicHeader({ page = "home" }: { page?: "home" | "toolbox" | "office" | "windows" | "transfer" }) {
  const { t } = useLanguage();
  const { status } = useAuthStatus();
  const isHome = page === "home";
  const isTool = page === "office" || page === "windows" || page === "transfer";
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = header.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    const measure = () => parent.style.setProperty("--public-header-offset", `${element.getBoundingClientRect().height + 16}px`);
    const observer = new ResizeObserver(measure); observer.observe(element); measure();
    return () => { observer.disconnect(); parent.style.removeProperty("--public-header-offset"); };
  }, []);

  return <header ref={header} className={styles.header} data-signed-in={status.state === "workspace" || status.state === "account" || status.state === "unverified"}><div className={styles.headerInner}>
    <div className={styles.headerLeft}>
      <nav className={styles.authNav} aria-label={t("账户入口")}>
        <AccountActions />
      </nav>
      <span className={styles.divider} />
      <Brand compact />
    </div>
    {isHome && <nav className={styles.navigation} aria-label={t("主页导航")}>
      <a href="#features">{t("功能亮点")}</a>
      <a href="#tutorials">{t("视频教程")}</a>
      <a href="#workflow">{t("业务流程")}</a>
      <a href="#questions">{t("常见问题")}</a>
    </nav>}
    <Link className={styles.publicLink} href={isHome || isTool ? "/toolbox" : "/"} aria-label={t(isHome ? "工具箱" : isTool ? "返回工具箱" : "返回首页")}>
      {isHome ? <PanelsTopLeft size={17} aria-hidden="true" /> : <ArrowLeft size={17} aria-hidden="true" />}
      <span className={styles.publicLinkLabel}>{t(isHome ? "工具箱" : isTool ? "返回工具箱" : "返回首页")}</span>
    </Link>
    <LanguageSwitcher />
  </div></header>;
}
