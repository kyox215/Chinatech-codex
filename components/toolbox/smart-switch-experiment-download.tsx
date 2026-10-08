"use client";

import { Download } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { smartSwitchExperimentRelease as release } from "@/lib/toolbox/smart-switch-experiment-release";
import shared from "./toolbox.module.css";
import styles from "./android-transfer.module.css";

export function SmartSwitchExperimentDownload() {
  const { t } = useLanguage();
  return <section className={`${styles.panel} ${styles.experiment}`} id="smart-switch-experiment" aria-labelledby="smart-switch-experiment-title">
    <h2 id="smart-switch-experiment-title">{t("Smart Switch 接收入口实验版")}</h2>
    <div className={styles.release}><span className={shared.pending}>{t("接收入口实验版")}</span><span>{t("版本 {version} · Android 6 及以上 · ARM32 / ARM64", { version: release.version })}</span></div>
    <p>{t("用于测试非三星手机的接收入口；安装、配对和资料恢复尚未真机验证。")}</p>
    <p className={styles.muted}>{t("这是独立签名的实验修改版，不是三星官方更新。不能覆盖官方或系统预装版本；请先在未安装官方版本的备用手机上使用测试资料核对。")}</p>
    <div className={styles.downloadActions}>
      <a className="button button--primary" href={release.apkPath} download><Download size={17} aria-hidden="true" />{t("下载 Smart Switch 实验 APK")}</a>
      <a className="button button--secondary" href={release.instructionsPath} download>{t("使用说明")}</a>
    </div>
    <p className={styles.muted}>{t("文件大小 {size} MB", { size: (release.bytes / 1_000_000).toFixed(1) })}</p>
    <details className={styles.integrity}>
      <summary>{t("查看 APK 校验信息")}</summary>
      <dl><dt>{t("文件 SHA256")}</dt><dd><code>{release.sha256}</code></dd><dt>{t("签名证书 SHA256")}</dt><dd><code>{release.signerSha256}</code></dd></dl>
      <p><a href={release.checksumsPath} download>{t("下载 SHA256 校验清单")}</a></p>
    </details>
  </section>;
}
