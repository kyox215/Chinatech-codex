"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Clipboard, Download, ExternalLink, FileText, Terminal } from "lucide-react";
import { Brand } from "@/components/brand";
import { PublicHeader } from "@/components/home/public-header";
import { useLanguage } from "@/components/language-provider";
import { officeCommands, type OfficeAction, type OfficeTerminal } from "@/lib/toolbox/office-commands";
import homeStyles from "@/components/home/home.module.css";
import toolboxStyles from "./toolbox.module.css";
import styles from "./office-tools.module.css";

type CopyState = "idle" | "copying" | "copied" | "failed";

export function OfficeToolsPage() {
  const { t } = useLanguage();
  const [action, setAction] = useState<OfficeAction>("install");
  const [terminal, setTerminal] = useState<OfficeTerminal>("powershell");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copyAttempt = useRef(0);
  const current = officeCommands.find(item => item.id === action)!;
  const command = current.commands[terminal];
  const terminalLabel = terminal === "cmd" ? "CMD" : "PowerShell";

  useEffect(() => () => { copyAttempt.current += 1; }, []);

  function chooseAction(value: OfficeAction) { copyAttempt.current += 1; setAction(value); setCopyState("idle"); }
  function chooseTerminal(value: OfficeTerminal) { copyAttempt.current += 1; setTerminal(value); setCopyState("idle"); }
  async function copyCommand() {
    const attempt = ++copyAttempt.current;
    setCopyState("copying");
    try {
      if (!navigator.clipboard?.writeText) { if (attempt === copyAttempt.current) setCopyState("failed"); return; }
      await navigator.clipboard.writeText(command);
      if (attempt === copyAttempt.current) setCopyState("copied");
    } catch {
      if (attempt === copyAttempt.current) setCopyState("failed");
    }
  }

  return <div className={toolboxStyles.page}>
    <a className={homeStyles.skipLink} href="#main-content">{t("跳到主要内容")}</a>
    <PublicHeader page="office" />
    <main className={styles.main} id="main-content">
      <div className={styles.heading}><span className={styles.headingIcon}><FileText size={26} aria-hidden="true" /></span><div>
        <h1>{t("Office 安装与激活")}</h1>
        <p>{t("Windows 管理员终端 · Office LTSC 专业增强版 2024")}</p>
      </div></div>
      <div className={styles.layout}>
        <aside className={styles.actions} aria-label={t("选择 Office 操作")}>
          {officeCommands.map(item => <button type="button" key={item.id} className={styles.action} aria-pressed={action === item.id} onClick={() => chooseAction(item.id)}>
            <span>{t(item.title)}</span><small>{t(item.destructive ? "移除现有 Office" : item.id === "install" ? "安装所选组件" : "核对批量激活")}</small>
          </button>)}
        </aside>
        <section className={styles.commandPanel} aria-labelledby="operation-title">
          <div className={styles.operationHeading}><h2 id="operation-title">{t(current.title)}</h2><span>{t("命令参考")}</span></div>
          <p className={styles.operationDescription}>{t(current.description)}</p>
          <div className={styles.notice} data-destructive={current.destructive}><AlertTriangle size={18} aria-hidden="true" /><p>{t(current.notice)}</p></div>
          <div className={styles.terminalBar}><span><Terminal size={17} aria-hidden="true" />{t("选择粘贴的终端")}</span><div className="segmented-control" aria-label={t("终端类型")}>
            <button type="button" className={terminal === "powershell" ? "segmented-control__active" : undefined} aria-pressed={terminal === "powershell"} onClick={() => chooseTerminal("powershell")}>{t("PowerShell")}</button>
            <button type="button" className={terminal === "cmd" ? "segmented-control__active" : undefined} aria-pressed={terminal === "cmd"} onClick={() => chooseTerminal("cmd")}>{t("CMD")}</button>
          </div></div>
          <p className={styles.instruction}>{t("以管理员身份打开 {terminal}，复制整条命令，粘贴后按回车。", { terminal: terminalLabel })}</p>
          <pre className={styles.code} tabIndex={0} aria-label={t("当前 Office 命令")}><code>{command}</code></pre>
          <div className={styles.copyActions}>
            <button className="button button--primary" type="button" disabled={copyState === "copying"} onClick={copyCommand}>
              {copyState === "copied" ? <Check size={17} aria-hidden="true" /> : <Clipboard size={17} aria-hidden="true" />}
              {t(copyState === "copying" ? "正在复制…" : copyState === "copied" ? "已复制完整命令" : "复制完整命令")}
            </button>
            <a className="button button--secondary" href={`/toolbox/office/${action}-${terminal}.txt`} download><Download size={17} aria-hidden="true" />{t("下载命令文本")}</a>
          </div>
          <div className={styles.copyFeedback}>
            {copyState === "copied" && <p role="status">{t("命令已复制，请在所选管理员终端中粘贴。")}</p>}
            {copyState === "failed" && <p role="alert">{t("复制失败。请手动选中上方命令，或下载命令文本；也可以再次尝试复制。")}</p>}
          </div>
          <a className={styles.sourceLink} href={`/toolbox/office/${action}-source.ps1.txt`} target="_blank" rel="noopener noreferrer">{t("查看当前操作脚本源码")}<ExternalLink size={15} aria-hidden="true" /></a>
        </section>
      </div>
      <section className={styles.details} aria-labelledby="usage-title">
        <h2 id="usage-title">{t("使用说明")}</h2>
        <p>{t("网页只提供命令与复制功能。安装、卸载或激活会在你手动执行命令后开始。")}</p>
        <p>{t("所选组件：Word、Excel、Outlook、OneNote、Skype for Business（Lync）、Access、OneDrive、PowerPoint。")}</p>
        <p>{t("命令使用已整理的第三方部署脚本，均校验固定版本；完整重装另校验安装配置。来源变化或下载失败时停止，尚未完成 Windows 真机安装验证。")}</p>
        <p>{t("KMS 通用密钥用于批量授权，不能替代有效的 Office 许可证；激活步骤连接第三方服务 s1.kms.cx。")}</p>
        <div><a href="https://ks.302.pub/b/all.ps1" target="_blank" rel="noopener noreferrer">{t("上游脚本")}<ExternalLink size={14} aria-hidden="true" /></a><a href="https://learn.microsoft.com/en-us/office/volume-license-activation/gvlks" target="_blank" rel="noopener noreferrer">{t("微软批量激活说明")}<ExternalLink size={14} aria-hidden="true" /></a></div>
      </section>
    </main>
    <footer className={toolboxStyles.footer}><Brand compact /><p>{t("© 2026 ChinaTech · 让门店日常井井有条")}</p></footer>
  </div>;
}
