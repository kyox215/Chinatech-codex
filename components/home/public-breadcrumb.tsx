"use client";

import { ChevronRight } from "lucide-react";
import { NavigationLink as Link } from "@/components/navigation-link";
import { useLanguage } from "@/components/language-provider";
import styles from "./portal.module.css";

export function PublicBreadcrumb({ title }: { title: string }) {
  const { t } = useLanguage();
  return <nav className={styles.breadcrumb} aria-label={t("页面位置")}><ol>
    <li><Link href="/">{t("首页")}</Link></li>
    <li><ChevronRight size={16} aria-hidden="true" /><span aria-current="page">{title}</span></li>
  </ol></nav>;
}
