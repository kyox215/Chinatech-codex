"use client";

import { Download } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { smartSwitchExperimentRelease as release } from "@/lib/toolbox/smart-switch-experiment-release";
import shared from "./toolbox.module.css";
import styles from "./android-transfer.module.css";

export function SmartSwitchExperimentDownload() {
  const { t } = useLanguage();
  return <section className={`${styles.panel} ${styles.experiment}`} id="smart-switch-experiment" aria-labelledby="smart-switch-experiment-title">
    <h2 id="smart-switch-experiment-title">{t("Smart Switch 通用通道实验版")}</h2>
    <div className={styles.release}><span className={shared.pending}>{t("通用通道实验版")}</span><span>{t("版本 {version} · Android 8 及以上 · ARM32 / ARM64", { version: release.version })}</span></div>
    <p>{t("lab3 将通用本地传输通道嵌入 Smart Switch APK，打开后选择发送或接收。两机须用 lab3，并存版与更新包可以互通；不能与三星原版、lab1／lab2 或 ChinaTech 0.2 混用。")}</p>
    <p>{t("Android 16 模拟器的两端局域网传输与断线恢复已通过。模拟器自动热点被系统拒绝；HONOR 等真机热点、相机扫码和跨品牌资料恢复尚未验收。")}</p>
    <p className={styles.muted}>{t("独立签名实验包，不是三星官方更新。推荐并存版可与官方或预装 Smart Switch 同时安装，无需卸载原版；更新包仅用于本站 lab1／lab2，不能覆盖三星官方签名包。")}</p>
    <ol className={styles.steps}>
      <li>{t("新机打开 lab3 选“接收”，授权本机保存位置，创建热点并显示二维码。")}</li>
      <li>{t("若自动热点被系统拒绝，按应用引导打开系统热点，填写真实 SSID 和 8–63 位 WPA2 密码生成二维码；也可用应用内“同一 Wi-Fi”入口。系统热点需在传输后自行关闭。")}</li>
      <li>{t("旧机打开 lab3 选“发送”，选择授权资料，用内置相机实时扫码或从图库读取；按系统提示加入新机热点。Android 8／9 需手动加入。")}</li>
      <li>{t("核对两端设备与本次资料，双方批准后传输；接收后逐项核对，安装和导入另经系统确认。")}</li>
    </ol>
    <div className={styles.downloadActions}>
      {release.available ? <><a className="button button--primary" href={release.apkPath} download><Download size={17} aria-hidden="true" />{t("下载 lab3 并存版（推荐）")}</a><a className="button button--secondary" href={release.updateApkPath} download>{t("更新已安装的 lab1／lab2")}</a></> : <p role="status">{t("lab3 安装包仍在核验，下载尚未开放。")}</p>}
      <a className="button button--secondary" href={release.instructionsPath} download>{t("使用说明")}</a>
    </div>
    <details className={styles.integrity}>
      <summary>{t("传输范围与限制")}</summary>
      <ul className={styles.networkPermissions}>
        <li>{t("支持授权照片／视频／音频、公共文件与所选文件夹、姓名／电话／邮箱 VCF、基础 ICS 和日历原始字段归档、可见 APP 的 base＋split ZIP。归档不等于完成系统恢复。")}</li>
        <li>{t("APP 私有数据、账号登录、聊天、短信／通话和保险箱未解锁；重复日历还原与 APP 安装仍需单独处理。HarmonyOS NEXT 不能安装此 APK。")}</li>
        <li>{t("断线自动重连最多 5 次；未完成对象整项重传，已完成对象重读校验后跳过。不设 10000 项总数或已批准会话 2 小时上限；单次连接与无进展核验仍有超时。")}</li>
        <li>{t("二维码包含热点密码和临时配对凭据，只供两部手机使用。图片可能被图库保存或同步；传输通道不向网站上传资料。")}</li>
      </ul>
    </details>
    {release.available && <><p className={styles.muted}>{t("每个安装包 {size} MB", { size: (release.bytes / 1_000_000).toFixed(1) })}</p><details className={styles.integrity}>
      <summary>{t("查看 APK 校验信息")}</summary>
      <dl><dt>{t("并存版文件 SHA256")}</dt><dd><code>{release.sha256}</code></dd><dt>{t("lab1／lab2 更新包 SHA256")}</dt><dd><code>{release.updateSha256}</code></dd><dt>{t("签名证书 SHA256")}</dt><dd><code>{release.signerSha256}</code></dd></dl>
      <p><a href={release.checksumsPath} download>{t("下载 SHA256 校验清单")}</a></p>
    </details></>}
  </section>;
}
