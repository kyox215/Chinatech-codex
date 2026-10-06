"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, PanelsTopLeft } from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";
import styles from "./home.module.css";

export function PublicHeader({ page = "home" }: { page?: "home" | "toolbox" }) {
  const { t } = useLanguage();
  const isHome = page === "home";

  return <header className={styles.header}><div className={styles.headerInner}>
    <div className={styles.headerLeft}>
      <nav className={styles.authNav} aria-label={t("账户入口")}>
        <Link href="/login">{t("登录")}</Link>
        <Link className="button button--primary" href="/register">{t("注册")}</Link>
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
    <Link className={styles.publicLink} href={isHome ? "/toolbox" : "/"}>
      {isHome ? <PanelsTopLeft size={17} aria-hidden="true" /> : <ArrowLeft size={17} aria-hidden="true" />}
      {t(isHome ? "工具箱" : "返回首页")}
    </Link>
    <LanguageSwitcher />
    <Link className={styles.workspaceLink} href="/app/dashboard">{t("进入工作台")}<ArrowRight size={16} aria-hidden="true" /></Link>
  </div></header>;
}
