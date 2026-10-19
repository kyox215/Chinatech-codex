"use client";

import Image from "next/image";
import { ArrowLeft, Download } from "lucide-react";
import { NavigationLink as Link } from "@/components/navigation-link";
import { PublicHeader } from "@/components/home/public-header";
import { DownloadLink } from "@/components/download-link";
import { Brand } from "@/components/brand";
import { useLanguage } from "@/components/language-provider";
import { clonephoneRelease as release } from "@/lib/toolbox/clonephone-release";
import shared from "./toolbox.module.css";
import home from "@/components/home/home.module.css";
import styles from "./android-transfer.module.css";

export function AndroidTransferPage() {
  const { t } = useLanguage();
  return <div className={shared.page}>
    <Link className={home.skipLink} href="#main-content" focusTargetId="main-content">{t("跳到主要内容")}</Link>
    <PublicHeader page="transfer" />
    <main className={`${shared.main} ${styles.main}`} id="main-content" tabIndex={-1}>
      <section className={styles.cloneHero} aria-labelledby="transfer-title">
        <div className={styles.cloneCopy}>
          <p className={styles.cloneCategory}>{t("数据传输")}</p>
          <h1 id="transfer-title">{t("手机搬家")}</h1>
          <p className={styles.cloneLead}>{t("换部手机，继续熟悉的日常。")}</p>
          <p className={styles.muted}>{t("下载 Clone Phone 通用测试版，按两部手机上的提示连接并选择要迁移的资料。")}</p>
          <ul className={styles.cloneFacts} aria-label={t("安装包信息")}>
            <li>{release.version}</li><li>{t("Android {version} 及以上", { version: release.minAndroid })}</li><li>{t("{size} MiB", { size: (release.bytes / 1024 / 1024).toFixed(2) })}</li>
          </ul>
          <DownloadLink className="button button--primary" href={release.apkPath} download={release.filename}><Download size={18} aria-hidden="true" />{t("下载手机搬家 APK")}</DownloadLink>
          <p className={styles.cloneNote}>{t("独立测试签名，非 OPPO 官方更新。已安装同包名官方版时可能无法直接覆盖，请先核对安装提示。")}</p>
        </div>
        <div className={styles.cloneVisual}><Image src="/images/clonephone-transfer-hero.webp" width={1536} height={1024} sizes="(max-width: 767px) calc(100vw - 68px), 520px" preload alt="" /></div>
      </section>
      <section className={styles.panel} aria-labelledby="clonephone-steps">
        <h2 id="clonephone-steps">{t("开始迁移")}</h2>
        <ol className={styles.cloneSteps}>
          <li><strong>{t("准备两部手机")}</strong><p>{t("核对 Android 版本，保持电量充足；按实际设备需要安装并打开手机搬家。")}</p></li>
          <li><strong>{t("跟随屏幕连接")}</strong><p>{t("在应用内选择旧手机与新手机角色，按提示配对；仅为本次迁移授权需要的资料。")}</p></li>
          <li><strong>{t("选择并核对资料")}</strong><p>{t("选择要迁移的内容，保持连接；结束后在新手机逐项核对，确认前保留旧机原资料。")}</p></li>
        </ol>
        <p className={styles.cloneBoundary}>{t("此页面提供安装包下载。各品牌真机、可迁移类别和系统导入结果仍需实际核对；应用内部资料与聊天记录以对应应用的迁移方式为准。")}</p>
      </section>
      <section className={styles.panel} aria-labelledby="clonephone-package">
        <h2 id="clonephone-package">{t("安装包与校验")}</h2>
        <p className={styles.muted}>{t("请核对文件名、版本和 SHA256；下载发起不代表安装或迁移完成。")}</p>
        <details className={styles.integrity}>
          <summary>{t("查看 APK 校验信息")}</summary>
          <dl><dt>{t("文件名")}</dt><dd>{release.filename}</dd><dt>{t("包名")}</dt><dd><code>{release.packageName}</code></dd><dt>{t("版本 / 版本号")}</dt><dd>{release.version} / {release.versionCode}</dd><dt>{t("文件大小（字节）")}</dt><dd>{release.bytes.toLocaleString("en-US")}</dd><dt>{t("支持的处理器")}</dt><dd>{release.abis.join(" / ")}</dd><dt>{t("文件 SHA256")}</dt><dd><code>{release.sha256}</code></dd><dt>{t("签名证书 SHA256")}</dt><dd><code>{release.signerSha256}</code></dd></dl>
          <DownloadLink className="button button--secondary" href={release.checksumsPath} download>{t("下载 SHA256 校验清单")}</DownloadLink>
        </details>
      </section>
      <div className={shared.bottomLink}><Link href="/toolbox/transfer" className="button button--secondary" icon={<ArrowLeft size={16} aria-hidden="true" />}>{t("返回数据传输")}</Link></div>
    </main>
    <footer className={shared.footer}><Brand compact /><p>{t("© 2026 ChinaTech · 让门店日常井井有条")}</p></footer>
  </div>;
}
