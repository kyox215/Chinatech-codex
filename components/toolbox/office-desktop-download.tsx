"use client";

import { Download } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { officeDesktopRelease } from "@/lib/toolbox/office-desktop-release";
import styles from "./office-tools.module.css";

export function OfficeDesktopDownload() {
  const { t } = useLanguage();
  return <section className={styles.details} id="office-desktop" aria-labelledby="office-desktop-title">
    <h2 id="office-desktop-title">{t("Office 桌面助手")}</h2>
    <p>{t("版本 {version} · Windows 11 · 使用本人 Windows 管理员账号 · 需要联网", { version: officeDesktopRelease.version })}</p>
    <p>{t("下载对应架构的程序，输入管理员提供的密钥，然后选择安装、激活、卸载或重装。程序会显示进度、错误处理建议，并可导出诊断报告。")}</p>
    <div>
      {officeDesktopRelease.files.map(file => <a key={file.architecture} className="button button--primary" href={file.href}>
        <Download size={17} aria-hidden="true" />{t("下载 {architecture} 程序", { architecture: file.architecture })}
      </a>)}
      <a href={officeDesktopRelease.instructions}>{t("使用说明")}</a>
    </div>
    <p>{t("在 Windows 设置 → 系统 → 系统信息查看系统类型：Intel/AMD 电脑选择 x64，ARM 电脑选择 ARM64。")}</p>
    <p>{t("助手密钥不包含 Office 许可证。安装的是 Office LTSC 专业增强版 2024 六个应用；激活只检查和使用已有有效许可。")}</p>
    <p>{t("程序尚未数字签名。运行前可核对 SHA256；若 Windows 拦截，请先核对来源与文件，不要关闭系统防护。")}</p>
    <details>
      <summary>{t("查看文件校验值")}</summary>
      {officeDesktopRelease.files.map(file => <p key={file.architecture}>{t("{architecture} · {size} MB", { architecture: file.architecture, size: (file.bytes / 1_000_000).toFixed(1) })}<br /><code className={styles.desktopDigest}>{file.sha256}</code></p>)}
      <a href={officeDesktopRelease.checksums}>{t("下载 SHA256 校验清单")}</a>
    </details>
  </section>;
}
