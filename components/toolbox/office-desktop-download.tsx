"use client";

import { Download } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { officeDesktopRelease } from "@/lib/toolbox/office-desktop-release";
import styles from "./office-tools.module.css";

export function OfficeDesktopDownload() {
  const { t } = useLanguage();
  return <section className={`${styles.details} ${styles.desktopDownload}`} id="office-desktop" aria-labelledby="office-desktop-title">
    <h2 id="office-desktop-title">{t("Office 桌面助手")}</h2>
    <p>{t("版本 {version} 测试版 · Windows 11 · 使用本人 Windows 管理员账号 · 安装与激活需要联网", { version: officeDesktopRelease.version })}</p>
    <p>{t("独立运行，无需网站登录或使用密钥。可选择一键安装并激活、仅激活或卸载，查看进度、处理建议及诊断报告。")}</p>
    <p>{t("固定安装 Office LTSC 专业增强版 2024（64 位），八项应用全选：Access、Excel、OneDrive、OneNote、Outlook（经典版）、PowerPoint、Skype for Business、Word。")}</p>
    <p>{t("Office 安装语言跟随 Windows，其他语言回退英语，也可独立选择中文、意大利语或英语。")}</p>
    <p>{t("安装替换全部旧 Office，包括 Visio 和 Project；设计范围保留个人文档及 OneDrive 程序、账户。操作前请备份重要文件。")}</p>
    <p>{t("激活默认使用 kms.cx 提供的服务器信息，并显示实际服务来源；请确认持有相应 Office 许可证。")}</p>
    <p>{t("本版实际界面、UAC、安装、激活、卸载及文档与 OneDrive 保留仍待 Windows 验收。")}</p>
    <div>
      {officeDesktopRelease.files.map(file => <a key={file.architecture} className="button button--primary" href={file.href}>
        <Download size={17} aria-hidden="true" />{t("下载 {architecture} 程序", { architecture: file.architecture })}
      </a>)}
      <a href={officeDesktopRelease.instructions}>{t("使用说明")}</a>
    </div>
    <p>{t("在 Windows 设置 → 系统 → 系统信息查看系统类型：Intel/AMD 电脑选择 x64，ARM 电脑选择 ARM64。")}</p>
    <p>{t("程序尚未数字签名。运行前可核对 SHA256；若 Windows 拦截，请先核对来源与文件，不要关闭系统防护。")}</p>
    <details>
      <summary>{t("查看文件校验值")}</summary>
      {officeDesktopRelease.files.map(file => <p key={file.architecture}>{t("{architecture} · {size} MB", { architecture: file.architecture, size: (file.bytes / 1_000_000).toFixed(1) })}<br /><code className={styles.desktopDigest}>{file.sha256}</code></p>)}
      <a href={officeDesktopRelease.checksums}>{t("下载 SHA256 校验清单")}</a>
    </details>
  </section>;
}
