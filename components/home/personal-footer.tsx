"use client";

import { Brand } from "@/components/brand";
import { useLanguage } from "@/components/language-provider";
import styles from "./portal.module.css";

export function PersonalFooter() {
  const { t } = useLanguage();
  return <footer className={styles.footer}><Brand compact purpose="personal" /><p>{t("© 2026 ChinaTech · 工作与生活")}</p></footer>;
}
