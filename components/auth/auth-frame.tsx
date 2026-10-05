"use client";

import { useLanguage } from "@/components/language-provider";
import Link from "next/link";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { ProductPreview } from "@/components/home/product-preview";
import { LanguageSwitcher } from "@/components/language-switcher";
import styles from "./auth-experience.module.css";

export function AuthFrame({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  return <main className={styles.page}>
    <div className={styles.formSide}><header className={styles.header}><Brand /><LanguageSwitcher /><Link href="/"><ArrowLeft size={16} />{t("返回首页")}</Link></header><div className={styles.formWrap}>{children}</div><footer className={styles.footnote}><ShieldCheck size={14} />{t("身份验证与门店授权，让协作更安心")}</footer></div>
    <aside className={styles.showcase} aria-label={t("ChinaTech 产品介绍")}><span className={styles.badge}><span />CHINATECH WORKSPACE</span><h2>{t("每一天的忙碌，")}<br />{t("都可以井井有条。")}</h2><p>{t("接好每一台设备，跟好每一张工单。")}<br />{t("门店的下一步，就在这里。")}</p><div className={styles.preview}><ProductPreview /></div><div className={styles.benefits}><span><Check size={15} />{t("维修进度随时跟进")}</span><span><Check size={15} />{t("自有整机一机一档")}</span><span><Check size={15} />{t("电脑手机皆可使用")}</span></div></aside>
  </main>;
}
