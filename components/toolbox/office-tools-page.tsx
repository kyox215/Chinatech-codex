"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Clipboard, Download, ExternalLink, FileText, Play, Terminal } from "lucide-react";
import { Brand } from "@/components/brand";
import { OfficeDesktopDownload } from "./office-desktop-download";
import { PublicHeader } from "@/components/home/public-header";
import { TutorialLibrary } from "@/components/home/tutorial-library";
import { getOfficeTutorials } from "@/lib/office-tutorials";
import type { Tutorial } from "@/lib/tutorials";
import { useLanguage } from "@/components/language-provider";
import { officeCommands, type OfficeAction, type OfficeTerminal } from "@/lib/toolbox/office-commands";
import homeStyles from "@/components/home/home.module.css";
import toolboxStyles from "./toolbox.module.css";
import styles from "./office-tools.module.css";

type CopyState = "idle" | "copying" | "copied" | "failed";

function actionFromHash(hash: string): OfficeAction | undefined { return officeCommands.find(item => hash === `#command-${item.id}`)?.id; }

export function OfficeToolsPage() {
  const { t, systemText, locale } = useLanguage();
  const [action, setAction] = useState<OfficeAction>("install");
  const [terminal, setTerminal] = useState<OfficeTerminal>("powershell");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copyAttempt = useRef(0);
  const commandPanel = useRef<HTMLElement>(null);
  const current = officeCommands.find(item => item.id === action)!;
  const scope = `${action}:${terminal}:${locale}`;
  const [generated,setGenerated]=useState<{scope:string;command:string;sourceUrl:string}|null>(null);
  const [phase,setPhase]=useState<"loading"|"ready"|"stopped"|"failed">("loading");
  const [message,setMessage]=useState("");
  const [reload,setReload]=useState(0);
  const generation=useRef(0);
  const data=generated?.scope===scope && phase==="ready" ? generated : null;
  const command=data?.command || "";
  const displayPhase=generated && generated.scope!==scope ? "loading" : phase;
  useEffect(()=>{
    const controller=new AbortController(),attempt=++generation.current;
    void Promise.resolve().then(async()=>{
      if(controller.signal.aborted)return;
      setGenerated(null);setPhase("loading");setMessage("");setCopyState("idle");copyAttempt.current+=1;
      try{
        const response=await fetch("/api/toolbox/office",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,terminal,language:locale}),cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
        const result=await response.json();
        if(controller.signal.aborted || attempt!==generation.current)return;
        if(!response.ok){setPhase(response.status===403?"stopped":"failed");setMessage(result.message || "Office 服务暂不可用，请稍后重试。");return;}
        if(typeof result.command!=="string" || result.command.length>8191 || !/^powershell\.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand [A-Za-z0-9+/=]+$/.test(result.command) || typeof result.sourceUrl!=="string" || !result.sourceUrl.startsWith("/api/toolbox/office/script?token=") || result.action!==action || result.terminal!==terminal)throw new Error();
        setGenerated({scope,command:result.command,sourceUrl:result.sourceUrl});setPhase("ready");
      }catch{if(!controller.signal.aborted && attempt===generation.current){setPhase("failed");setMessage("无法生成命令，请检查网络后重试。");}}
    });
    return()=>{controller.abort();generation.current+=1;copyAttempt.current+=1;};
  },[action,terminal,locale,reload,scope]);
  useEffect(()=>{const refresh=()=>{if(document.visibilityState==="visible")setReload(v=>v+1);};window.addEventListener("focus",refresh);window.addEventListener("online",refresh);return()=>{window.removeEventListener("focus",refresh);window.removeEventListener("online",refresh);};},[]);
  function downloadCommand(){
    if(!data)return;
    const url=URL.createObjectURL(new Blob([data.command+"\n"],{type:"text/plain;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download=`office-${action}-${terminal}.txt`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const terminalLabel = terminal === "cmd" ? "CMD" : "PowerShell";

  useEffect(() => () => { copyAttempt.current += 1; }, []);

  useEffect(() => {
    let pendingScroll = 0;
    function restoreCommandHash() {
      const value = actionFromHash(window.location.hash);
      if (!value) return;
      copyAttempt.current += 1; setAction(value); setCopyState("idle");
      cancelAnimationFrame(pendingScroll);
      pendingScroll = requestAnimationFrame(() => commandPanel.current?.scrollIntoView({ block: "start", behavior: "instant" }));
    }
    restoreCommandHash();
    window.addEventListener("hashchange", restoreCommandHash);
    window.addEventListener("popstate", restoreCommandHash);
    return () => { cancelAnimationFrame(pendingScroll); window.removeEventListener("hashchange", restoreCommandHash); window.removeEventListener("popstate", restoreCommandHash); };
  }, []);
  function chooseAction(value: OfficeAction, syncExistingHash = true) {
    if(syncExistingHash && actionFromHash(window.location.hash)) window.history.replaceState(window.history.state, "", `#command-${value}`);
    if(value===action)return;
    copyAttempt.current += 1; setGenerated(null); setPhase("loading"); setAction(value); setCopyState("idle");
  }
  function openTutorialCommand(tutorial: Tutorial) {
    const value = actionFromHash(tutorial.href); if (!value) return;
    chooseAction(value, false);
    if (window.location.hash !== tutorial.href) window.history.pushState(null, "", tutorial.href);
    commandPanel.current?.focus({ preventScroll: true });
    commandPanel.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }
  function chooseTerminal(value: OfficeTerminal) { if(value===terminal)return; copyAttempt.current += 1; setGenerated(null); setPhase("loading"); setTerminal(value); setCopyState("idle"); }
  async function copyCommand() {
    if (!data) return;
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
      </div><a className={`button button--secondary ${styles.tutorialEntry}`} href="#office-tutorials"><Play size={17} aria-hidden="true" />{t("观看 Office 视频教程")}</a></div>
      <OfficeDesktopDownload />
      <div className={styles.layout}>
        <aside className={styles.actions} aria-label={t("选择 Office 操作")}>
          {officeCommands.map(item => <button type="button" key={item.id} className={styles.action} aria-pressed={action === item.id} onClick={() => chooseAction(item.id)}>
            <span>{t(item.title)}</span><small>{t(item.destructive ? "移除现有 Office" : item.id === "install" ? "安装所选组件" : "核对批量激活")}</small>
          </button>)}
        </aside>
        <section className={styles.commandPanel} id={`command-${action}`} ref={commandPanel} tabIndex={-1} aria-labelledby="operation-title">
          <div className={styles.operationHeading}><h2 id="operation-title">{t(current.title)}</h2><span>{t("命令参考")}</span></div>
          <p className={styles.operationDescription}>{t(current.description)}</p>
          <div className={styles.notice} data-destructive={current.destructive}><AlertTriangle size={18} aria-hidden="true" /><p>{t(current.notice)}</p></div>
          <div className={styles.terminalBar}><span><Terminal size={17} aria-hidden="true" />{t("选择粘贴的终端")}</span><div className="segmented-control" aria-label={t("终端类型")}>
            <button type="button" className={terminal === "powershell" ? "segmented-control__active" : undefined} aria-pressed={terminal === "powershell"} onClick={() => chooseTerminal("powershell")}>{t("PowerShell")}</button>
            <button type="button" className={terminal === "cmd" ? "segmented-control__active" : undefined} aria-pressed={terminal === "cmd"} onClick={() => chooseTerminal("cmd")}>{t("CMD")}</button>
          </div></div>
          <p className={styles.instruction}>{t("以管理员身份打开 {terminal}，复制整条命令，粘贴后按回车。", { terminal: terminalLabel })}</p>
          {data ? <pre className={styles.code} tabIndex={0} aria-label={t("当前 Office 命令")}><code>{command}</code></pre> : <div className={styles.notice} role={displayPhase==="loading"?"status":"alert"}><p>{displayPhase==="loading" ? t("正在生成联网命令…") : systemText(message)}</p></div>}
          <button type="button" className="button button--secondary" disabled={phase==="loading"} onClick={()=>{setGenerated(null);setPhase("loading");setReload(v=>v+1);}}>{t("重新生成命令")}</button>
          <div className={styles.copyActions}>
            <button className="button button--primary" type="button" disabled={!data || copyState === "copying"} onClick={copyCommand}>
              {copyState === "copied" ? <Check size={17} aria-hidden="true" /> : <Clipboard size={17} aria-hidden="true" />}
              {t(copyState === "copying" ? "正在复制…" : copyState === "copied" ? "已复制完整命令" : "复制完整命令")}
            </button>
            <button className="button button--secondary" type="button" disabled={!data} onClick={downloadCommand}><Download size={17} aria-hidden="true" />{t("下载命令文本")}</button>
          </div>
          <div className={styles.copyFeedback}>
            {data && copyState === "copied" && <p role="status">{t("命令已复制，请在所选管理员终端中粘贴。")}</p>}
            {data && copyState === "failed" && <p role="alert">{t("复制失败。请手动选中上方命令，或下载命令文本；也可以再次尝试复制。")}</p>}
          </div>
          {data ? <a className={styles.sourceLink} href={data.sourceUrl} target="_blank" rel="noopener noreferrer">{t("查看当前操作脚本源码")}<ExternalLink size={15} aria-hidden="true" /></a> : null}
        </section>
      </div>
      <section className={styles.details} aria-labelledby="usage-title">
        <h2 id="usage-title">{t("使用说明")}</h2>
        <p>{t("命令需联网获取脚本。开关只控制新版联网命令，之前复制的静态命令无法撤销。关闭后本页旧命令失效，重开须重新生成；已取得的脚本和已开始的操作无法回收。")}</p>
        <p>{t("网页只提供命令与复制功能。安装、卸载或激活会在你手动执行命令后开始。")}</p>
        <p>{t("所选组件：Word、Excel、Outlook、OneNote、Skype for Business（Lync）、Access、OneDrive、PowerPoint。")}</p>
        <p>{t("命令使用已整理的第三方部署脚本，均校验固定版本；完整重装另校验安装配置。来源变化或下载失败时停止，尚未完成 Windows 真机安装验证。")}</p>
        <p>{t("KMS 通用密钥用于批量授权，不能替代有效的 Office 许可证；激活步骤连接第三方服务 s1.kms.cx。")}</p>
        <div><a href="https://ks.302.pub/b/all.ps1" target="_blank" rel="noopener noreferrer">{t("上游脚本")}<ExternalLink size={14} aria-hidden="true" /></a><a href="https://learn.microsoft.com/en-us/office/volume-license-activation/gvlks" target="_blank" rel="noopener noreferrer">{t("微软批量激活说明")}<ExternalLink size={14} aria-hidden="true" /></a></div>
      </section>
      <section className={styles.tutorials} id="office-tutorials" aria-labelledby="office-tutorials-title">
        <div className={styles.tutorialHeading}><h2 id="office-tutorials-title">{t("Office 视频教程")}</h2><p>{t("选择安装、激活、卸载或完整重装，按章节查看操作方法。")}</p></div>
        <TutorialLibrary tutorials={getOfficeTutorials(locale)} aspectRatio="16:9" onAction={openTutorialCommand} />
      </section>
    </main>
    <footer className={toolboxStyles.footer}><Brand compact /><p>{t("© 2026 ChinaTech · 让门店日常井井有条")}</p></footer>
  </div>;
}
