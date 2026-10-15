"use client";
import { NavigationLink as Link } from "@/components/navigation-link";

import { ArrowRight, Check, Cloud } from "lucide-react";
import { PublicHeader } from "@/components/home/public-header";
import { useLanguage } from "@/components/language-provider";
import { OfficeDesktopDetails, OfficeDesktopDownload } from "./office-desktop-download";
import { OfficeProductVideo } from "./office-product-video";
import { officeDesktopRelease } from "@/lib/toolbox/office-desktop-release";
import homeStyles from "@/components/home/home.module.css";
import toolboxStyles from "./toolbox.module.css";
import styles from "./office-tools.module.css";

const apps = [
  { name: "Word", letter: "W", color: "word" },
  { name: "Excel", letter: "X", color: "excel" },
  { name: "PowerPoint", letter: "P", color: "powerpoint" },
  { name: "Outlook", letter: "O", color: "outlook" },
  { name: "OneNote", letter: "N", color: "onenote" },
  { name: "Access", letter: "A", color: "access" },
  { name: "OneDrive", letter: "D", color: "onedrive" },
  { name: "Skype for Business", letter: "S", color: "skype" },
] as const;
const steps = ["下载程序", "选择应用", "按提示执行"] as const;

export function OfficeToolsPage() {
  const { t } = useLanguage();
  return <div className={toolboxStyles.page}>
    <Link className={homeStyles.skipLink} href="#main-content" focusTargetId="main-content">{t("跳到主要内容")}</Link>
    <PublicHeader page="office" />
    <main className={styles.main} id="main-content" tabIndex={-1}>
      <section className={styles.hero} aria-labelledby="office-product-title">
        <div className={styles.heroCopy}>
          <h1 id="office-product-title">{t("Office 助手")}</h1>
          <p className={styles.edition}>{t("Office LTSC 专业增强版 2024")}</p>
          <p className={styles.heroLead}>{t("无需网站登录。在新电脑或客户电脑上独立运行。")}</p>
          <OfficeDesktopDownload />
        </div>
        <div className={styles.appPreview}>
          <div className={styles.previewHeading}><h2 id="office-apps-title">{t("可选应用")}</h2><span>{t("界面示意")}</span></div>
          <ul className={styles.appGrid} aria-labelledby="office-apps-title">
            {apps.map(app => <li key={app.name}>
              <span className={`${styles.appMark} ${styles[app.color]}`} aria-hidden="true">{app.name === "OneDrive" ? <Cloud size={23} /> : t(app.letter)}</span>
              <h3>{t(app.name)}</h3><Check size={15} className={styles.selectedMark} aria-hidden="true" />
            </li>)}
          </ul>
          <p>{t("默认全选，在桌面程序中调整。")}</p>
        </div>
      </section>
      <ol className={styles.steps} aria-label={t("使用流程")}>{steps.map((step, index) => <li key={step}><span>{t(step)}</span>{index < steps.length - 1 && <ArrowRight size={16} aria-hidden="true" />}</li>)}</ol>
      <div className={styles.supportGrid}><OfficeProductVideo /><OfficeDesktopDetails /></div>
    </main>
    <footer className={styles.footer}><span>{t("© 2026 ChinaTech")}</span><a href={officeDesktopRelease.instructions}>{t("使用说明")}</a></footer>
  </div>;
}
