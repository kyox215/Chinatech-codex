"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowDown, Download, Play, RotateCcw } from "lucide-react";
import { Brand } from "@/components/brand";
import { PublicHeader } from "@/components/home/public-header";
import { useLanguage } from "@/components/language-provider";
import { OfficeDesktopDownload } from "./office-desktop-download";
import { officeDesktopRelease } from "@/lib/toolbox/office-desktop-release";
import homeStyles from "@/components/home/home.module.css";
import toolboxStyles from "./toolbox.module.css";
import styles from "./office-tools.module.css";

const apps = [
  { name: "Word", letter: "W", description: "文档与排版" },
  { name: "Excel", letter: "X", description: "表格与数据" },
  { name: "PowerPoint", letter: "P", description: "演示与表达" },
  { name: "Outlook", letter: "O", description: "经典版邮件与日历" },
  { name: "OneNote", letter: "N", description: "笔记与整理" },
  { name: "Access", letter: "A", description: "数据库与记录" },
  { name: "OneDrive", letter: "D", description: "文件同步" },
  { name: "Skype for Business", letter: "S", description: "企业沟通" },
] as const;

const steps = [
  { title: "下载适合电脑的版本", description: "按系统类型选择 x64 或 ARM64，使用本人 Windows 管理员账号运行。" },
  { title: "选择应用与语言", description: "在桌面程序中选择需要的应用，核对安装语言与现有 Office 状态。" },
  { title: "确认后查看进度", description: "核对操作内容后再开始，在程序中查看任务进度与诊断记录。" },
] as const;

const productVideoSource = "/media/office-product-intro-zh.mp4";
type VideoPhase = "idle" | "loading" | "ready" | "failed" | "blocked";

export function OfficeToolsPage() {
  const { t } = useLanguage();
  const video = useRef<HTMLVideoElement>(null);
  const attempt = useRef(0);
  const playPending = useRef(false);
  const [videoRevision, setVideoRevision] = useState(0);
  const [videoPhase, setVideoPhase] = useState<VideoPhase>("idle");

  useEffect(() => {
    const element = video.current;
    return () => {
      if (element && !element.isConnected && element.hasAttribute("src")) {
        element.pause();
        element.removeAttribute("src");
        element.load();
      }
    };
  }, [videoRevision]);

  function startVideo() {
    const previous = video.current;
    if (!previous || playPending.current) return;
    playPending.current = true;
    if (previous.hasAttribute("src")) {
      previous.pause();
      previous.removeAttribute("src");
      previous.load();
      // A retry needs a fresh media resource while preserving this user gesture.
      flushSync(() => { setVideoRevision(value => value + 1); setVideoPhase("loading"); });
    } else setVideoPhase("loading");
    const element = video.current;
    if (!element) { playPending.current = false; setVideoPhase("failed"); return; }
    const currentAttempt = ++attempt.current;
    function failed(error: unknown) {
      if (currentAttempt !== attempt.current || video.current !== element) return;
      playPending.current = false;
      setVideoPhase(error instanceof Error && error.name === "NotAllowedError" ? "blocked" : "failed");
    }
    try {
      // Set the source and request playback in this click's user gesture.
      element.src = productVideoSource;
      void element.play().then(() => {
        if (currentAttempt !== attempt.current || video.current !== element) return;
        playPending.current = false;
        setVideoPhase("ready");
      }, failed);
    } catch (error) { failed(error); }
  }

  return <div className={toolboxStyles.page}>
    <a className={homeStyles.skipLink} href="#main-content">{t("跳到主要内容")}</a>
    <PublicHeader page="office" />
    <main className={styles.main} id="main-content">
      <section className={styles.hero} aria-labelledby="office-product-title">
        <div className={styles.heroCopy}>
          <h1 id="office-product-title">{t("ChinaTech Office 助手")}</h1>
          <p>{t("用清晰的桌面界面，选择应用并安装 Office LTSC 2024。")}</p>
          <a className="button button--primary" href="#office-desktop"><Download size={18} aria-hidden="true" />{t("下载桌面程序")}</a>
          <span className={styles.heroFact}>{t("Windows 11 · 64 位 · {version} 测试版", { version: officeDesktopRelease.version })}</span>
        </div>
        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.visualMark}>{t("Office")}<span>{t("LTSC 2024")}</span></div>
          <div className={styles.visualApps}>{["W", "X", "P", "O"].map(letter => <span key={letter}>{t(letter)}</span>)}</div>
        </div>
      </section>

      <section aria-labelledby="office-apps-title">
        <div className={styles.sectionHeading}><h2 id="office-apps-title">{t("需要哪些应用，由你选择")}</h2><p>{t("八项应用可在桌面程序中选择，默认全选。")}</p></div>
        <ul className={styles.appGrid}>
          {apps.map(app => <li key={app.name}><span className={styles.appMark} aria-hidden="true">{t(app.letter)}</span><div><h3>{t(app.name)}</h3><p>{t(app.description)}</p></div></li>)}
        </ul>
      </section>

      <section aria-labelledby="office-steps-title">
        <div className={styles.sectionHeading}><h2 id="office-steps-title">{t("三步开始")}</h2></div>
        <ol className={styles.steps}>
          {steps.map((step, index) => <li key={step.title}><span className={styles.stepNumber} aria-hidden="true">{index + 1}</span><h3>{t(step.title)}</h3><p>{t(step.description)}</p></li>)}
        </ol>
      </section>

      <section className={styles.videoSection} id="office-product-video" aria-labelledby="office-video-title">
        <div className={styles.videoCopy}><h2 id="office-video-title">{t("约 40 秒了解桌面程序")}</h2><p>{t("中文解说与字幕，展示组件选择与应用管理。")}</p><p className={styles.muted}>{t("界面演示；不代表实际安装或激活已完成验收。")}</p><a className={styles.inlineLink} href="#office-desktop">{t("选择下载版本")}<ArrowDown size={16} aria-hidden="true" /></a></div>
        <div className={styles.videoCard}>
          <div className={styles.videoStage}>
            <video key={videoRevision} ref={video} controls={videoPhase !== "idle"} playsInline preload="none" poster="/media/office-product-intro-zh-poster.jpg" aria-label={t("ChinaTech Office 助手产品介绍视频（中文）")} onError={event => {
              if (event.currentTarget !== video.current || !attempt.current || !event.currentTarget.error) return;
              playPending.current = false;
              setVideoPhase("failed");
            }} onPlaying={event => {
              if (event.currentTarget !== video.current || !attempt.current || event.currentTarget.paused || event.currentTarget.error) return;
              playPending.current = false;
              setVideoPhase("ready");
            }} />
            {(videoPhase === "idle" || videoPhase === "loading") && <div className={styles.videoStartOverlay}><button className={`button button--primary ${styles.videoStartButton}`} type="button" disabled={videoPhase === "loading"} onClick={startVideo}><Play size={18} aria-hidden="true" />{t("播放产品介绍视频")}</button></div>}
          </div>
          {videoPhase === "loading" && <p className={styles.videoLoading} role="status">{t("正在加载视频…")}</p>}
          {(videoPhase === "failed" || videoPhase === "blocked") && <div className={styles.videoFeedback} role="alert"><p>{t(videoPhase === "blocked" ? "浏览器阻止了视频播放，请点击重试。" : "视频暂时无法播放，请稍后重试。")}</p><button className="button button--secondary" type="button" onClick={startVideo}><RotateCcw size={16} aria-hidden="true" />{t("重新加载视频")}</button></div>}
        </div>
      </section>

      <OfficeDesktopDownload />
    </main>
    <footer className={toolboxStyles.footer}><Brand compact /><p>{t("© 2026 ChinaTech · 让门店日常井井有条")}</p></footer>
  </div>;
}
