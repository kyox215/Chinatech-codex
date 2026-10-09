"use client";

import { Download } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { isMimoverReleaseReady, mimoverRelease as release } from "@/lib/toolbox/mimover-release";
import shared from "./toolbox.module.css";
import styles from "./android-transfer.module.css";

export function MimoverDownload() {
  const { t } = useLanguage();
  const verifiedRelease = isMimoverReleaseReady(release) ? release : null;
  const ready = verifiedRelease !== null;
  return <section className={`${styles.panel} ${styles.experiment}`} id="mimover-universal" aria-labelledby="mimover-universal-title">
    <h2 id="mimover-universal-title">{t("Mi Mover 跨品牌传输实验版")}</h2>
    <div className={styles.release}>
      <span className={shared.pending}>{t(ready ? "跨品牌传输实验版" : "构建与核验中")}</span>
      <span>{t("版本 {version} · Android 8 及以上", { version: release.version })}</span>
    </div>
    <p>{t("保留小米换机原页面，两端选择新机或旧机。两部手机须安装本站同一 lab2 版本。")}</p>
    <p>{t("支持自动热点、系统手动热点或同一 Wi-Fi。OPPO、Motorola、Samsung 等品牌真机兼容性仍待核验。")}</p>
    <p className={styles.muted}>{t("独立签名并存包，可与官方小米换机同时安装，无需卸载原版；不能覆盖官方签名包。")}</p>
    <div className={styles.downloadActions}>
      {ready ? <>
        <a className="button button--primary" href={release.apkPath} download><Download size={17} aria-hidden="true" />{t("下载 Mi Mover lab2 并存版（推荐）")}</a>
        <a className="button button--secondary" href={release.instructionsPath} download>{t("使用说明")}</a>
      </> : <>
        <button className="button button--primary" type="button" disabled aria-describedby="mimover-build-status"><Download size={17} aria-hidden="true" />{t("下载 Mi Mover lab2 并存版（推荐）")}</button>
        <button className="button button--secondary" type="button" disabled aria-describedby="mimover-build-status">{t("使用说明")}</button>
      </>}
    </div>
    {!ready && <p className={styles.muted} id="mimover-build-status" role="status">{t("Mi Mover 安装包正在构建与核验，下载尚未开放。")}</p>}
    <details className={styles.integrity}>
      <summary>{t("传输范围与限制")}</summary>
      <ul className={styles.networkPermissions}>
        <li>{t("可选择照片、视频、音乐、文件夹、通讯录、日历和应用安装包，按授权范围传输。")}</li>
        <li>{t("接收后可授权恢复图库、通讯录和日历；应用安装保留 Android 系统确认。")}</li>
        <li>{t("应用私有数据、账号登录、聊天、短信和通话记录不支持自动还原。")}</li>
        <li>{t("本地加密传输，双方核对后开始，结果以接收回执为准。二维码与配对凭据仅供本次两机使用。")}</li>
      </ul>
    </details>
    {verifiedRelease && <>
      <p className={styles.muted}>{t("安装包 {size} MB", { size: (verifiedRelease.bytes / 1_000_000).toFixed(1) })}</p>
      <details className={styles.integrity}>
        <summary>{t("查看 APK 校验信息")}</summary>
        <dl><dt>{t("文件 SHA256")}</dt><dd><code>{verifiedRelease.sha256}</code></dd><dt>{t("签名证书 SHA256")}</dt><dd><code>{verifiedRelease.signerSha256}</code></dd></dl>
        <p><a href={release.checksumsPath} download>{t("下载 SHA256 校验清单")}</a></p>
      </details>
    </>}
  </section>;
}
