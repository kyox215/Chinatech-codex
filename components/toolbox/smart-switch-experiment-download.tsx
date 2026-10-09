"use client";

import { Download } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { smartSwitchExperimentRelease as release } from "@/lib/toolbox/smart-switch-experiment-release";
import shared from "./toolbox.module.css";
import styles from "./android-transfer.module.css";

export function SmartSwitchExperimentDownload() {
  const { t } = useLanguage();
  return <section className={`${styles.panel} ${styles.experiment}`} id="smart-switch-experiment" aria-labelledby="smart-switch-experiment-title">
    <h2 id="smart-switch-experiment-title">{t("Smart Switch 原版界面实验版")}</h2>
    <div className={styles.release}><span className={shared.pending}>{t("原版界面 · 通用无线传输")}</span><span>{t("版本 {version} · Android 8 及以上 · ARM32 / ARM64", { version: release.version })}</span></div>
    <p>{t("lab4 保留三星原首页、连接、资料选择、进度和完成页面，接入通用局域网传输。两机都需 lab4；并存版与更新包互通，不与三星原版、旧 lab 或 ChinaTech 0.3 混用。")}</p>
    <p>{t("Android 16 模拟器已验证原界面勾选、两端局域网传输、通知返回、取消和最终回执恢复。HONOR 等品牌真机、热点自动加入和光学扫码仍待验收。")}</p>
    <p className={styles.muted}>{t("独立签名实验包，保留原界面，不是三星官方更新。并存版可覆盖本站 lab3 并存版；更新包仅用于本站 lab1／lab2／lab3 原包名版本，不能覆盖三星官方签名包。")}</p>
    <ol className={styles.steps}>
      <li>{t("新机在原三星首页选择“在此手机上接收”与“Galaxy／Android”，授权本机保存目录，再生成热点二维码。")}</li>
      <li>{t("若自动热点被系统拒绝，按应用引导打开系统热点，填写真实 SSID 和 8–63 位 WPA2 密码生成二维码；也可用应用内“同一 Wi-Fi”入口。系统热点需在传输后自行关闭。")}</li>
      <li>{t("旧机在原首页选择发送，读取新机二维码并核对两端。助手扫描授权资料，新机在原选择页勾选类别或单项，旧机确认后开始传输。")}</li>
      <li>{t("自动连接失败时，在“连接选项”中选择同一 Wi-Fi，或手动加入热点后继续。资料逐项保存和校验；图库与通讯录导入另行核对。")}</li>
    </ol>
    <div className={styles.downloadActions}>
      {release.available ? <><a className="button button--primary" href={release.apkPath} download><Download size={17} aria-hidden="true" />{t("下载 lab4 原版界面并存版（推荐）")}</a><a className="button button--secondary" href={release.updateApkPath} download>{t("更新本站 lab1／lab2／lab3 原包名版")}</a></> : <p role="status">{t("lab4 安装包仍在核验，下载尚未开放。")}</p>}
      <a className="button button--secondary" href={release.instructionsPath} download>{t("使用说明")}</a>
    </div>
    <details className={styles.integrity}>
      <summary>{t("传输范围与限制")}</summary>
      <ul className={styles.networkPermissions}>
        <li>{t("可传输授权媒体／文件、系统标准 VCF 字段与头像、日历 ICS／原字段及可见 APP 的 base＋split 归档。文件保存与图库／通讯录导入分开核对；APP 归档不等于已安装。")}</li>
        <li>{t("APP 私有数据、账号登录、聊天、短信／通话和保险箱未解锁；重复日历还原与 APP 安装仍需单独处理。HarmonyOS NEXT 不能安装此 APK。")}</li>
        <li>{t("断线自动重连最多 5 次；未完成对象整项重传，已完成对象重读校验后跳过。不设 10000 项总数或已批准会话 2 小时上限；单次连接与无进展核验仍有超时。")}</li>
        <li>{t("二维码包含热点密码和临时配对凭据，只供两部手机使用。图片可能被图库保存或同步；传输通道不向网站上传资料。")}</li>
      </ul>
    </details>
    {release.available && <><p className={styles.muted}>{t("每个安装包 {size} MB", { size: (release.bytes / 1_000_000).toFixed(1) })}</p><details className={styles.integrity}>
      <summary>{t("查看 APK 校验信息")}</summary>
      <dl><dt>{t("并存版文件 SHA256")}</dt><dd><code>{release.sha256}</code></dd><dt>{t("本站原包名更新包 SHA256")}</dt><dd><code>{release.updateSha256}</code></dd><dt>{t("签名证书 SHA256")}</dt><dd><code>{release.signerSha256}</code></dd></dl>
      <p><a href={release.checksumsPath} download>{t("下载 SHA256 校验清单")}</a></p>
    </details></>}
  </section>;
}
