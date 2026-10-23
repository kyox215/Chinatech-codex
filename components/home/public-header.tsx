"use client";

import { NavigationLink as Link } from "@/components/navigation-link";
import { PanelsTopLeft } from "lucide-react";
import { AccountActions } from "./account-actions";
import { useEffect, useRef, type ReactNode } from "react";
import { useAuthStatus } from "@/components/auth-status-provider";
import { Brand } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";
import { scrollToPublicSection } from "@/lib/public-section-navigation";
import { ContentProgress } from "@/components/operation-feedback";
import styles from "./home.module.css";
import portal from "./modern-portal.module.css";

export function PublicHeader({ page = "repair", portalSearch }: { portalSearch?: ReactNode; page?: "portal" | "repair" | "cinema" | "toolbox" | "office" | "windows" | "transfer" }) {
  const { t } = useLanguage();
  const { status } = useAuthStatus();
  const isRepair = page === "repair";
  const isPersonal = page === "portal" || page === "cinema";
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = header.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    const measure = () => parent.style.setProperty("--public-header-offset", `${element.getBoundingClientRect().height + 16}px`);
    const observer = new ResizeObserver(measure); observer.observe(element); measure();
    return () => { observer.disconnect(); parent.style.removeProperty("--public-header-offset"); };
  }, []);

  if (page === "portal") return <><header ref={header} className={`${styles.header} ${portal.portalHeader}`} data-signed-in={status.state === "workspace" || status.state === "account" || status.state === "unverified"}>
    <div className={portal.headerInner}>
      <Brand compact purpose="personal" appearance="hub" className={portal.brand} />
      {portalSearch}
      <nav className={portal.headerNav} aria-label={t("首页导航")}>
        <Link href="/" aria-current="page">{t("首页")}</Link>
        <Link href="#portal-features" onClick={scrollToPublicSection}>{t("全部功能")}</Link>
      </nav>
      <div className={portal.headerActions}><LanguageSwitcher /><nav className={portal.authNav} aria-label={t("账户入口")}><AccountActions /></nav></div>
    </div>
  </header><ContentProgress placement="public" /></>;

  return <><header ref={header} className={`${styles.header} ${page === "office" ? styles.officeHeader : ""}`} data-signed-in={status.state === "workspace" || status.state === "account" || status.state === "unverified"}><div className={styles.headerInner}>
    <div className={styles.headerLeft}>
      <nav className={styles.authNav} aria-label={t("账户入口")}>
        <AccountActions compact={page === "office"} />
      </nav>
      <span className={styles.divider} />
      <Brand compact purpose={isPersonal ? "personal" : "repair"} />
    </div>
    {isRepair && <nav className={styles.navigation} aria-label={t("维修页面导航")}>
      <Link href="#features" onClick={scrollToPublicSection}>{t("功能亮点")}</Link>
      <Link href="#tutorials" onClick={scrollToPublicSection}>{t("视频教程")}</Link>
      <Link href="#workflow" onClick={scrollToPublicSection}>{t("业务流程")}</Link>
      <Link href="#questions" onClick={scrollToPublicSection}>{t("常见问题")}</Link>
    </nav>}
    <LanguageSwitcher />
    {!isPersonal && <Link className={styles.publicLink} href="/toolbox" aria-label={t("工具箱")} aria-current={page === "toolbox" ? "page" : undefined} icon={<PanelsTopLeft size={17} aria-hidden="true" />}>

      <span data-public-link-label className={styles.publicLinkLabel}>{t("工具箱")}</span>
    </Link>}
  </div></header><ContentProgress placement="public" /></>;
}
