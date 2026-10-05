"use client";

import { Brand } from "@/components/brand";
import { PageTitle } from "@/components/page-title";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import styles from "./account-settings.module.css";

export function AccountBrand() {
  return <header className={styles.brand}><Brand href="/account/pending" /><LanguageSwitcher /></header>;
}

export function AccountHeading() {
  const { t } = useLanguage();
  return <header className={`module-heading ${styles.heading}`}><PageTitle title={t("账号设置")} backHref="/account/pending" backLabel={t("工作台")} subtitle={t("管理登录邮箱、手机号与第三方账号")} /></header>;
}
