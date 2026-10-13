"use client";

import { Download, ExternalLink } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { officeDesktopRelease } from "@/lib/toolbox/office-desktop-release";
import styles from "./office-tools.module.css";

export function OfficeDesktopDownload() {
  const { t } = useLanguage();
  return <>
    <section id="office-desktop" aria-labelledby="office-desktop-title">
      <div className={styles.sectionHeading}><h2 id="office-desktop-title">{t("下载 ChinaTech Office 助手")}</h2><p>{t("版本 {version} 测试版 · Windows 11 · 64 位", { version: officeDesktopRelease.version })}</p></div>
      <div className={styles.downloadGrid}>
        {officeDesktopRelease.files.map(file => <article className={styles.downloadCard} key={file.architecture}>
          <h3>{file.architecture}</h3>
          <p>{t(file.architecture === "x64" ? "适用于 Intel / AMD 电脑" : "适用于 ARM 电脑")}</p>
          <a className="button button--primary" href={file.href}><Download size={17} aria-hidden="true" />{t("下载 {architecture} 程序", { architecture: file.architecture })}</a>
          <span>{t("{size} MB · Windows 程序", { size: (file.bytes / 1_000_000).toFixed(1) })}</span>
        </article>)}
      </div>
      <p className={styles.downloadFact}>{t("独立运行，无需网站登录。请使用本人 Windows 管理员账号；安装与激活需要联网。")}</p>
      <p className={styles.muted}>{t("未签名测试版；真实 Windows 安装与激活验收仍待完成。")}</p>
      <details className={styles.technical}>
        <summary>{t("文件校验与技术资料")}</summary>
        <div className={styles.detailsBody}>
          <p>{t("程序尚未数字签名。运行前可核对 SHA256；若 Windows 拦截，请先核对来源与文件，不要关闭系统防护。")}</p>
          {officeDesktopRelease.files.map(file => <div className={styles.digestRow} key={file.architecture}><strong>{t("{architecture} · SHA256", { architecture: file.architecture })}</strong><code>{file.sha256}</code></div>)}
          <div className={styles.technicalLinks}>
            <a href={officeDesktopRelease.checksums}>{t("下载 SHA256 校验清单")}<Download size={15} aria-hidden="true" /></a>
            <a href={officeDesktopRelease.instructions}>{t("使用说明")}<ExternalLink size={15} aria-hidden="true" /></a>
            <a href={`https://github.com/kyox215/Chinatech-codex/tree/office-assistant-v${officeDesktopRelease.version}/desktop/office-assistant`} target="_blank" rel="noopener noreferrer">{t("查看此版本源码")}<ExternalLink size={15} aria-hidden="true" /></a>
          </div>
        </div>
      </details>
    </section>

    <section aria-labelledby="office-faq-title">
      <div className={styles.sectionHeading}><h2 id="office-faq-title">{t("常见问题")}</h2></div>
      <div className={styles.faq}>
        <details><summary>{t("怎样选择 x64 或 ARM64？")}</summary><div className={styles.detailsBody}><p>{t("在 Windows 设置 → 系统 → 系统信息查看系统类型：Intel/AMD 电脑选择 x64，ARM 电脑选择 ARM64。")}</p></div></details>
        <details><summary>{t("可以选择哪些应用和语言？")}</summary><div className={styles.detailsBody}><p>{t("安装 Office LTSC 专业增强版 2024（64 位）。八项应用默认全选，可单独选择安装：Access、Excel、OneDrive、OneNote、Outlook（经典版）、PowerPoint、Skype for Business、Word。")}</p><p>{t("Office 安装语言跟随 Windows，其他语言回退英语，也可独立选择中文、意大利语或英语。")}</p></div></details>
        <details><summary>{t("现有 Office、文档和 OneDrive 会怎样？")}</summary><div className={styles.detailsBody}><p>{t("兼容的已有应用、Office 版本和语言会保留。卸载可选择检测到的项目，或移除全部 Office（包括 Visio 和 Project）；全部卸载默认保留 OneDrive。个人文档保留。")}</p><p>{t("旧版 MSI 产品须整项卸载；配置未知时不修改单个应用。OneDrive 仅支持当前账户卸载，所有账户安装请用 Windows 设置处理。")}</p><p>{t("操作前请备份重要文档，并核对程序显示的实际操作范围。")}</p></div></details>
        <details><summary>{t("激活是否等于获得许可证？")}</summary><div className={styles.detailsBody}><p>{t("激活不能替代有效的 Office 许可证，请确认持有相应授权。")}</p><p>{t("激活默认使用 kms.cx 提供的服务器信息，并显示实际服务来源；请确认持有相应 Office 许可证。")}</p></div></details>
        <details><summary>{t("这是已经完成 Windows 验收的正式版吗？")}</summary><div className={styles.detailsBody}><p>{t("程序尚未数字签名。运行前可核对 SHA256；若 Windows 拦截，请先核对来源与文件，不要关闭系统防护。")}</p><p>{t("本版实际界面、UAC、安装、激活、卸载及文档与 OneDrive 保留仍待 Windows 验收。")}</p></div></details>
      </div>
    </section>
  </>;
}
