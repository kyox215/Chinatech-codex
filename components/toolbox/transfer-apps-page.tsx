"use client";

import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Cable, Download, Laptop, Smartphone } from "lucide-react";
import { NavigationLink as Link } from "@/components/navigation-link";
import { PublicHeader } from "@/components/home/public-header";
import { DownloadLink } from "@/components/download-link";
import { Brand } from "@/components/brand";
import { useLanguage } from "@/components/language-provider";
import { mobiletransRelease } from "@/lib/toolbox/mobiletrans-release";
import { clonephoneRelease } from "@/lib/toolbox/clonephone-release";
import shared from "./toolbox.module.css";
import home from "@/components/home/home.module.css";
import styles from "./android-transfer.module.css";

function TransferFrame({ children, application = false }: { children: ReactNode; application?: boolean }) {
  const { t } = useLanguage();
  return <div className={shared.page}>
    <Link className={home.skipLink} href="#main-content" focusTargetId="main-content">{t("跳到主要内容")}</Link>
    <PublicHeader page="transfer" />
    <main className={`${shared.main} ${styles.main}`} id="main-content" tabIndex={-1}>
      {children}
      <div className={shared.bottomLink}><Link href={application ? "/toolbox/transfer" : "/toolbox"} className="button button--secondary" icon={<ArrowLeft size={16} aria-hidden="true" />}>{t(application ? "返回数据传输" : "返回工具箱")}</Link></div>
    </main>
    <footer className={shared.footer}><Brand compact /><p>{t("© 2026 ChinaTech · 让门店日常井井有条")}</p></footer>
  </div>;
}

export function TransferAppsPage() {
  const { t } = useLanguage();
  return <TransferFrame>
    <section className={styles.intro} aria-labelledby="transfer-title">
      <Cable size={30} aria-hidden="true" />
      <h1 id="transfer-title">{t("数据传输")}</h1>
      <p className={styles.muted}>{t("选择应用，查看介绍和安装包。")}</p>
    </section>
    <section className={shared.categories} aria-labelledby="transfer-apps-title">
      <div className={shared.sectionHeading}><h2 id="transfer-apps-title">{t("应用列表")}</h2></div>
      <div className={shared.grid}>
        <article className={shared.card} aria-labelledby="clonephone-title">
          <div className={shared.cardTop}><span className={shared.categoryIcon}><Smartphone size={26} aria-hidden="true" /></span><span className={shared.pending}>{t("Android")}</span></div>
          <h3 id="clonephone-title">{t("手机搬家")}</h3>
          <p>{t("下载手机搬家通用测试版，按设备提示迁移资料。")}</p>
          <ul className={shared.topics}><li>{t("Clone Phone")}</li><li>{clonephoneRelease.version}</li></ul>
          <Link className={`${shared.cardFoot} ${shared.cardLink}`} href="/toolbox/transfer/clonephone" icon={<ArrowRight size={17} aria-hidden="true" />} iconPosition="end">{t("查看手机搬家")}</Link>
        </article>
        <article className={shared.card} aria-labelledby="mobiletrans-title">
          <div className={shared.cardTop}><span className={shared.categoryIcon}><Cable size={26} aria-hidden="true" /></span><span className={shared.pending}>{t("Android / Windows")}</span></div>
          <h3 id="mobiletrans-title">{t("MobileTrans")}</h3>
          <p>{t("同一应用，提供 Android 与 Windows 安装包。")}</p>
          <ul className={shared.topics}>{mobiletransRelease.files.map(file => <li key={file.platform}>{file.platform} {file.version}</li>)}</ul>
          <Link className={`${shared.cardFoot} ${shared.cardLink}`} href="/toolbox/transfer/mobiletrans" icon={<ArrowRight size={17} aria-hidden="true" />} iconPosition="end">{t("查看 MobileTrans")}</Link>
        </article>
      </div>
    </section>
  </TransferFrame>;
}

export function MobileTransPage() {
  const { t } = useLanguage();
  return <TransferFrame application>
    <section className={styles.intro} aria-labelledby="mobiletrans-title">
      <Cable size={30} aria-hidden="true" />
      <h1 id="mobiletrans-title">{t("MobileTrans")}</h1>
      <p className={styles.muted}>{t("选择适合当前设备的安装包。")}</p>
    </section>
    <section className={shared.categories} aria-labelledby="mobiletrans-downloads-title">
      <div className={shared.sectionHeading}><h2 id="mobiletrans-downloads-title">{t("选择系统")}</h2></div>
      <div className={shared.grid}>
        {mobiletransRelease.files.map(file => <article className={shared.card} key={file.platform} aria-labelledby={`mobiletrans-${file.platform}`}>
          <span className={shared.categoryIcon}>{file.platform === "Android" ? <Smartphone size={26} aria-hidden="true" /> : <Laptop size={26} aria-hidden="true" />}</span>
          <h3 id={`mobiletrans-${file.platform}`}>{file.platform}</h3>
          <ul className={shared.topics}><li>{file.version}</li><li>{t("{size} MiB", { size: (file.bytes / 1024 / 1024).toFixed(2) })}</li></ul>
          <DownloadLink className="button button--primary" href={file.href} download={file.filename}><Download size={18} aria-hidden="true" />{t(file.downloadLabel)}</DownloadLink>
          <details className={styles.integrity}>
            <summary>{t("查看校验信息")}</summary>
            <dl><dt>{t("文件名")}</dt><dd>{file.filename}</dd><dt>{t("文件大小（字节）")}</dt><dd>{file.bytes.toLocaleString("en-US")}</dd><dt>{t("文件 SHA256")}</dt><dd><code>{file.sha256}</code></dd></dl>
          </details>
        </article>)}
      </div>
    </section>
    <section className={styles.panel} aria-labelledby="mobiletrans-checksums-title">
      <h2 id="mobiletrans-checksums-title">{t("安装文件与校验")}</h2>
      <p className={styles.muted}>{t("请核对文件名、版本和 SHA256；下载发起不代表安装或迁移完成。")}</p>
      <DownloadLink className="button button--secondary" href={mobiletransRelease.checksumsPath} download>{t("下载 SHA256 校验清单")}</DownloadLink>
    </section>
  </TransferFrame>;
}
