"use client";

import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, Cable, FileText, FolderOpen, Laptop, PanelsTopLeft, Smartphone, Usb, Wrench } from "lucide-react";
import { Brand } from "@/components/brand";
import { PublicHeader } from "@/components/home/public-header";
import { useLanguage } from "@/components/language-provider";
import homeStyles from "@/components/home/home.module.css";
import styles from "./toolbox.module.css";

const categories = [
  { id: "windows", title: "Windows 安装", description: "系统安装、启动盘制作与驱动工具。", topics: ["系统安装", "启动盘与驱动"], icon: Laptop, tone: "primary" },
  { id: "office", title: "Office 安装与激活", description: "安装、卸载、激活与完整重装的终端命令。", topics: ["CMD", "PowerShell"], icon: FileText, tone: "info" },
  { id: "phone", title: "手机刷机", description: "手机固件、刷机工具与系统恢复资料。", topics: ["固件与驱动", "系统恢复"], icon: Smartphone, tone: "success" },
  { id: "transfer", title: "数据传输", description: "设备间传输、数据备份与迁移工具。", topics: ["备份与迁移", "跨设备传输"], icon: Cable, tone: "warning" },
] as const;

export function ToolboxPage() {
  const { t } = useLanguage();

  return <div className={styles.page}>
    <a className={homeStyles.skipLink} href="#main-content">{t("跳到主要内容")}</a>
    <PublicHeader page="toolbox" />
    <main className={styles.main} id="main-content">
      <section className={styles.hero} aria-labelledby="toolbox-title">
        <div className={styles.heroCopy}>
          <span className={styles.publicBadge}><PanelsTopLeft size={16} aria-hidden="true" />{t("公开工具箱 · 无需登录")}</span>
          <h1 id="toolbox-title">{t("工具箱")}</h1>
          <p className={styles.lead}>{t("装机、刷机、传数据。")}</p>
          <p className={styles.description}>{t("常用工具与资料，集中在这里。更多内容将陆续添加。")}</p>
          <a className="button button--primary" href="#categories">{t("浏览工具分类")}<ArrowDown size={17} aria-hidden="true" /></a>
        </div>
        <div className={styles.illustration} aria-hidden="true">
          <div className={styles.orbit} />
          <span className={styles.centerIcon}><Wrench size={44} strokeWidth={1.6} /></span>
          <span className={`${styles.floatingIcon} ${styles.laptop}`}><Laptop size={32} strokeWidth={1.6} /></span>
          <span className={`${styles.floatingIcon} ${styles.document}`}><FileText size={29} strokeWidth={1.6} /></span>
          <span className={`${styles.floatingIcon} ${styles.phone}`}><Smartphone size={29} strokeWidth={1.6} /></span>
          <span className={`${styles.floatingIcon} ${styles.usb}`}><Usb size={29} strokeWidth={1.6} /></span>
        </div>
      </section>

      <section className={styles.categories} id="categories" aria-labelledby="categories-title">
        <div className={styles.sectionHeading}>
          <h2 id="categories-title">{t("工具分类")}</h2>
          <span>{t("内容陆续添加")}</span>
        </div>
        <div className={styles.grid}>
          {categories.map(({ id, title, description, topics, icon: Icon, tone }) => <article className={styles.card} data-tone={tone} key={id} aria-labelledby={`${id}-title`}>
            <div className={styles.cardTop}><span className={styles.categoryIcon}><Icon size={26} strokeWidth={1.7} aria-hidden="true" /></span><span className={styles.pending}>{t(id === "office" ? "命令参考" : "待添加")}</span></div>
            <h3 id={`${id}-title`}>{t(title)}</h3>
            <p>{t(description)}</p>
            <ul className={styles.topics}>{topics.map(topic => <li key={topic}>{t(topic)}</li>)}</ul>
            {id === "office" ? <Link className={`${styles.cardFoot} ${styles.cardLink}`} href="/toolbox/office">{t("查看安装与激活命令")}<ArrowRight size={17} aria-hidden="true" /></Link> : <div className={styles.cardFoot}><FolderOpen size={17} aria-hidden="true" /><span>{t("工具与下载链接准备中")}</span></div>}
          </article>)}
        </div>
      </section>
      <div className={styles.bottomLink}><Link href="/" className="button button--secondary"><ArrowLeft size={16} aria-hidden="true" />{t("返回首页")}</Link></div>
    </main>
    <footer className={styles.footer}><Brand compact /><p>{t("© 2026 ChinaTech · 让门店日常井井有条")}</p></footer>
  </div>;
}
