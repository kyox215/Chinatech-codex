"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ChevronRight, Play, RotateCcw, X } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useOfficeModalScrollLock } from "./office-modal-scroll";
import styles from "./office-tools.module.css";

type VideoPhase = "idle" | "loading" | "ready" | "failed" | "blocked";
export function OfficeProductVideo() {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const attempt = useRef(0);
  const playPending = useRef(false);
  const scrollLock = useOfficeModalScrollLock();
  const [revision, setRevision] = useState(0);
  const [phase, setPhase] = useState<VideoPhase>("idle");
  useEffect(() => {
    const element = video.current;
    return () => { if (element && !element.isConnected && element.hasAttribute("src")) { element.pause(); element.removeAttribute("src"); element.load(); } };
  }, [revision]);
  function stop() { attempt.current++; playPending.current = false; video.current?.pause(); video.current?.removeAttribute("src"); video.current?.load(); setPhase("idle"); scrollLock.unlock(); }
  function start() {
    const previous = video.current;
    if (!previous || playPending.current) return;
    playPending.current = true;
    if (previous.hasAttribute("src")) {
      previous.pause(); previous.removeAttribute("src"); previous.load();
      flushSync(() => { setRevision(value => value + 1); setPhase("loading"); });
    } else setPhase("loading");
    const element = video.current;
    if (!element) { playPending.current = false; setPhase("failed"); return; }
    const current = ++attempt.current;
    const failed = (error: unknown) => { if (current !== attempt.current || video.current !== element) return; playPending.current = false; setPhase(error instanceof Error && error.name === "NotAllowedError" ? "blocked" : "failed"); };
    try { element.src = "/media/office-public-access-zh.mp4"; void element.play().then(() => { if (current === attempt.current && video.current === element) { playPending.current = false; setPhase("ready"); } }, failed); } catch (error) { failed(error); }
  }
  return <section id="office-product-video" aria-labelledby="office-video-title" className={styles.videoSection}>
    <button type="button" className={styles.videoEntry} onClick={() => { scrollLock.lock(); dialog.current?.showModal(); start(); }}>
      <span className={styles.videoThumb}><Image src="/media/office-public-access-zh-poster.jpg" width={144} height={88} loading="eager" alt="" /><Play size={22} aria-hidden="true" /></span>
      <span className={styles.videoEntryCopy}><strong id="office-video-title">{t("观看使用演示")}</strong><span>{t("中文女声讲解与字幕")}</span></span><ChevronRight size={20} aria-hidden="true" />
    </button>
    <dialog ref={dialog} className={styles.videoDialog} aria-label={t("ChinaTech Office 助手产品介绍视频（中文）")} onCancel={event => { event.preventDefault(); dialog.current?.close(); }} onClose={stop}>
      <div className={styles.dialogHeading}><h2>{t("观看使用演示")}</h2><button type="button" className="icon-button" aria-label={t("关闭视频")} onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button></div>
      <div className={styles.videoStage}>
        <video key={revision} ref={video} controls playsInline preload="none" poster="/media/office-public-access-zh-poster.jpg" aria-label={t("ChinaTech Office 助手产品介绍视频（中文）")} onError={event => {
          if (event.currentTarget !== video.current || !attempt.current || !event.currentTarget.error) return;
          playPending.current = false; setPhase("failed");
        }} onPlaying={event => {
          if (event.currentTarget !== video.current || !attempt.current || event.currentTarget.paused || event.currentTarget.error) return;
          playPending.current = false; setPhase("ready");
        }} />
      </div>
      {phase === "loading" && <p role="status" className={styles.videoLoading}>{t("正在加载视频…")}</p>}
      {(phase === "failed" || phase === "blocked") && <div className={styles.videoFeedback} role="alert"><p>{t(phase === "blocked" ? "浏览器阻止了视频播放，请点击重试。" : "视频暂时无法播放，请稍后重试。")}</p><button className="button button--secondary" type="button" onClick={start}><RotateCcw size={16} aria-hidden="true" />{t("重新加载视频")}</button></div>}
      <p className={styles.videoCaption}>{t("流程示意；不代表实际安装或激活已经完成。")}</p>
    </dialog>
  </section>;
}
