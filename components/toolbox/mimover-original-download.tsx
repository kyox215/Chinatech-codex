"use client";

import { Download } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { isMimoverOriginalReady, mimoverOriginalRelease as release } from "@/lib/toolbox/mimover-original-release";
import styles from "./android-transfer.module.css";
import shared from "./toolbox.module.css";

export function MimoverOriginalDownload() {
  const { t } = useLanguage();
  const ready = isMimoverOriginalReady(release);
  return <section className={`${styles.panel} ${styles.experiment}`} id="mimover-original" aria-labelledby="mimover-original-title">
    <h2 id="mimover-original-title">{t("Mi Mover 原版新机入口解限")}</h2>
    <div className={styles.release}><span className={shared.pending}>{t("原版入口补丁实验版")}</span><span>{t("版本 {version} · 原包最低要求 Android 5", { version: release.version })}</span></div>
    <p>{t("保留小米原界面、资料分类、传输协议与恢复实现，只开放非小米手机的新机入口。")}</p>
    <p>{t("本版仅验证新机入口与原版来源选择页。原版热点及恢复仍依赖系统接口，跨品牌完整迁移尚未验证。")}</p>
    <p className={styles.muted}>{t("原包名独立签名，不能覆盖小米官方签名包；已安装官方版的手机请保留原版。")}</p>
    <div className={styles.downloadActions}>
      {ready ? <>
        <a className="button button--primary" href={release.apkPath} download><Download size={17} aria-hidden="true" />{t("下载 Mi Mover 原版入口解限版")}</a>
        <a className="button button--secondary" href={release.instructionsPath} download>{t("使用说明")}</a>
      </> : <p role="status">{t("原版入口补丁正在核验，下载尚未开放。")}</p>}
    </div>
    <details className={styles.integrity}><summary>{t("修改范围与验证")}</summary>
      <p>{t("仅修改首页品牌分支和安装所需的清单属性。没有新增自有页面、资料分类、传输引擎或恢复引擎。")}</p>
      <p>{t("已在非 MIUI Android 16 模拟器验证原新机和旧机入口；OPPO、Motorola、Samsung 等真机仍待测试。")}</p>
    </details>
    {ready && <details className={styles.integrity}><summary>{t("查看 APK 校验信息")}</summary>
      <dl><dt>{t("文件 SHA256")}</dt><dd><code>{release.sha256}</code></dd><dt>{t("签名证书 SHA256")}</dt><dd><code>{release.signerSha256}</code></dd></dl>
      <p><a href={release.checksumsPath} download>{t("下载 SHA256 校验清单")}</a></p>
    </details>}
  </section>;
}
