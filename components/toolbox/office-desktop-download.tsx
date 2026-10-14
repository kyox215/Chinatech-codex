"use client";
import { DownloadLink } from "@/components/download-link";

import { useEffect, useRef, useState } from "react";
import { Copy, Download, ExternalLink, X, ChevronDown } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { SingleChoice } from "@/components/single-choice";
import { InputControl } from "@/components/input-control";
import { useOfficeModalScrollLock } from "./office-modal-scroll";
import { officeDesktopRelease } from "@/lib/toolbox/office-desktop-release";
import styles from "./office-tools.module.css";

export function OfficeDesktopDownload() {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const scrollLock = useOfficeModalScrollLock();
  const [architecture, setArchitecture] = useState("ARM64");
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const copyAttempt = useRef(0);
  const file = officeDesktopRelease.files.find(item => item.architecture === architecture)!;
  useEffect(() => () => { copyAttempt.current++; }, []);
  function close() { copyAttempt.current++; setCopyState("idle"); dialog.current?.close(); }
  async function copy() {
    const current = ++copyAttempt.current;
    setCopyState("copying");
    try {
      if (!navigator.clipboard?.writeText) throw new Error();
      await navigator.clipboard.writeText(file.href);
      if (copyAttempt.current === current) setCopyState("copied");
    } catch { if (copyAttempt.current === current) setCopyState("failed"); }
  }
  return <div id="office-desktop" className={styles.downloadArea}>
    <div className={styles.downloadActions}>
      <DownloadLink className="button button--primary" href={officeDesktopRelease.files[0].href}><Download size={18} aria-hidden="true" />{t("下载 x64 版")}</DownloadLink>
      <DownloadLink className={`button button--secondary ${styles.desktopArm}`} href={officeDesktopRelease.files[1].href}><Download size={18} aria-hidden="true" />{t("下载 ARM64 版")}</DownloadLink>
      <button ref={trigger} className={styles.mobileVersions} type="button" aria-haspopup="dialog" onClick={() => { setArchitecture("ARM64"); setCopyState("idle"); scrollLock.lock(); dialog.current?.showModal(); }}>{t("其他版本 · ARM64")}<ChevronDown size={16} aria-hidden="true" /></button>
    </div>
    <p className={styles.downloadFact}>{t("Windows 11 · 64 位 · {version} 未签名测试版", { version: officeDesktopRelease.version })}</p>
    <p className={styles.downloadFact}>{t("Intel / AMD 选 x64；ARM Windows 选 ARM64。")}</p>
    <p className={styles.downloadFact}>{t("使用本人 Windows 管理员账号运行；安装与激活需联网和适用的 Office 许可。")}</p>
    <dialog ref={dialog} className={styles.downloadDialog} aria-labelledby="office-download-dialog-title" onCancel={event => { event.preventDefault(); close(); }} onClose={() => { copyAttempt.current++; setCopyState("idle"); scrollLock.unlock(); if (trigger.current?.getClientRects().length) trigger.current.focus({ preventScroll: true }); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
    }}>
      <div className={styles.dialogHeading}><h2 id="office-download-dialog-title">{t("选择下载版本")}</h2><button className="icon-button" type="button" aria-label={t("关闭下载选项")} onClick={close}><X size={20} aria-hidden="true" /></button></div>
      <p>{t("按 Windows 电脑的系统类型选择。")}</p>
      <SingleChoice label="电脑架构" value={architecture} options={[{ value: "x64", label: "x64 · Intel / AMD 电脑" }, { value: "ARM64", label: "ARM64 · ARM Windows 电脑" }]} onChange={value => { copyAttempt.current++; setArchitecture(value); setCopyState("idle"); }} className={styles.architectureChoices} />
      <p className={styles.architectureHelp}>{t("在 Windows 设置 → 系统 → 系统信息查看系统类型：Intel/AMD 电脑选择 x64，ARM 电脑选择 ARM64。")}</p>
      <DownloadLink className="button button--primary" href={file.href}><Download size={18} aria-hidden="true" />{t("下载 {architecture} 程序", { architecture: file.architecture })}</DownloadLink>
      <button className="button button--secondary" type="button" disabled={copyState === "copying"} onClick={copy}><Copy size={18} aria-hidden="true" />{t(copyState === "copying" ? "正在复制…" : "复制下载链接")}</button>
      <p className={styles.copyFeedback} role={copyState === "failed" ? "alert" : "status"}>{copyState === "copied" ? t("下载链接已复制，可在 Windows 电脑上打开。") : copyState === "failed" ? t("无法复制，请选中下方链接手动复制。") : ""}</p>
      {copyState === "failed" && <InputControl value={file.href} readOnly aria-label={t("下载链接")} />}
      <p className={styles.muted}>{t("请在 Windows 电脑上运行。")}</p>
    </dialog>
  </div>;
}

export function OfficeDesktopDetails() {
  const { t } = useLanguage();
  return <section aria-labelledby="office-faq-title" className={styles.faqSection}>
    <h2 id="office-faq-title">{t("常见问题")}</h2>
    <div className={styles.faq}>
      <details><summary>{t("应用能单独安装或卸载吗？")}</summary><div className={styles.detailsBody}>
        <p>{t("安装 Office LTSC 专业增强版 2024（64 位）。八项应用默认全选，可单独选择安装：Access、Excel、OneDrive、OneNote、Outlook（经典版）、PowerPoint、Skype for Business、Word。")}</p>
        <p>{t("Office 安装语言跟随 Windows，其他语言回退英语，也可独立选择中文、意大利语或英语。")}</p>
        <p>{t("兼容的已有应用、Office 版本和语言会保留。卸载可选择检测到的项目，或移除全部 Office（包括 Visio 和 Project）；全部卸载默认保留 OneDrive。个人文档保留。")}</p>
        <p>{t("旧版 MSI 产品须整项卸载；配置未知时不修改单个应用。OneDrive 仅支持当前账户卸载，所有账户安装请用 Windows 设置处理。")}</p>
        <p>{t("操作前请备份重要文档，并核对程序显示的实际操作范围。")}</p>
      </div></details>
      <details><summary>{t("如何查看电脑架构？")}</summary><div className={styles.detailsBody}><p>{t("在 Windows 设置 → 系统 → 系统信息查看系统类型：Intel/AMD 电脑选择 x64，ARM 电脑选择 ARM64。")}</p></div></details>
      <details><summary>{t("安装和激活需要什么许可？")}</summary><div className={styles.detailsBody}>
        <p>{t("激活不能替代有效的 Office 许可证，请确认持有相应授权。")}</p>
        <p>{t("激活默认使用 kms.cx 提供的服务器信息，并显示实际服务来源；请确认持有相应 Office 许可证。")}</p>
        <p>{t("确认许可后可一键开始。需要管理员确认、保存文件或重启时，请按程序提示操作。")}</p>
      </div></details>
    </div>
    <details className={styles.technical}><summary>{t("版本与技术信息")}</summary><div className={styles.detailsBody}>
      <p>{t("程序尚未数字签名。运行前可核对 SHA256；若 Windows 拦截，请先核对来源与文件，不要关闭系统防护。")}</p>
      <p>{t("本版实际界面、UAC、安装、激活、卸载及文档与 OneDrive 保留仍待 Windows 验收。")}</p>
      {officeDesktopRelease.files.map(file => <div className={styles.digestRow} key={file.architecture}><strong>{t("{architecture} · SHA256", { architecture: file.architecture })}</strong><code>{file.sha256}</code></div>)}
      <div className={styles.technicalLinks}>
        <a href={officeDesktopRelease.checksums}>{t("下载 SHA256 校验清单")}<Download size={15} aria-hidden="true" /></a>
        <a href={officeDesktopRelease.instructions}>{t("使用说明")}<ExternalLink size={15} aria-hidden="true" /></a>
        <a href={`https://github.com/kyox215/Chinatech-codex/tree/office-assistant-v${officeDesktopRelease.version}/desktop/office-assistant`} target="_blank" rel="noopener noreferrer">{t("查看此版本源码")}<ExternalLink size={15} aria-hidden="true" /></a>
      </div>
    </div></details>
  </section>;
}
