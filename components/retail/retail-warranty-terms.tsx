"use client";

import { retailStatutoryRights, retailWarrantyTerms } from "@/lib/retail-warranty-terms";
import { useLanguage } from "@/components/language-provider";
import styles from "./retail-warranty.module.css";

export function RetailWarrantyTerms({ enabled = true }: { enabled?: boolean }) {
  const { locale, t } = useLanguage();
  const language = locale === "zh-CN" ? "zh" : locale;
  return <details className={styles.terms}><summary>{t("查看保修条款")}</summary><ul>{(enabled ? retailWarrantyTerms : retailWarrantyTerms.slice(-1)).map(term => <li key={term.title}><strong>{t(term.title)}</strong><p>{term[language]}</p></li>)}</ul><p>{retailStatutoryRights[language]}</p></details>;
}
