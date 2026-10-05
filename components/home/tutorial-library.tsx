"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Captions, Clock3, LoaderCircle, Play, RotateCcw, Volume2 } from "lucide-react";
import { getTutorials } from "@/lib/tutorials";
import { useLanguage } from "@/components/language-provider";
import styles from "./tutorial-library.module.css";

type PlaybackStatus = "idle" | "loading" | "ready" | "error";

function timestamp(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function releaseVideo(video: HTMLVideoElement | null) {
  if (!video) return;
  video.pause();
  video.removeAttribute("src");
  video.load();
}

export function TutorialLibrary() {
  const { locale } = useLanguage();
  const [selectedId, setSelectedId] = useState(getTutorials(locale)[0].id);
  return <TutorialLibraryContent key={locale} selectedId={selectedId} setSelectedId={setSelectedId} />;
}

function TutorialLibraryContent({ selectedId, setSelectedId }: { selectedId: string; setSelectedId: (id: string) => void }) {
  const { locale, t } = useLanguage();
  const tutorials = getTutorials(locale);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [hasStarted, setHasStarted] = useState(false);
  const [playbackHint, setPlaybackHint] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingSeek = useRef<number | null>(null);
  const resumeAt = useRef(0);
  const tutorial = tutorials.find(item => item.id === selectedId) ?? tutorials[0];

  // Strict Mode replays ref cleanup/setup too. Release only if the element was not rebound.
  const attachVideo = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video;
    return () => {
      if (videoRef.current === video) videoRef.current = null;
      queueMicrotask(() => {
        if (videoRef.current !== video) releaseVideo(video);
      });
    };
  }, []);

  function applyPendingSeek(video: HTMLVideoElement) {
    if (pendingSeek.current === null) return;
    const end = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.05) : pendingSeek.current;
    video.currentTime = Math.min(pendingSeek.current, end);
    pendingSeek.current = null;
  }

  function playAt(at = 0, reload = false) {
    const video = videoRef.current;
    if (!video) return;
    setHasStarted(true);
    setPlaybackHint("");
    setStatus("loading");
    pendingSeek.current = Math.max(0, at);
    const needsSource = !video.hasAttribute("src");

    // A source is attached only in this user action, keeping the homepage media idle.
    if (needsSource) video.src = tutorial.src;
    if (needsSource || reload || status === "error") video.load();
    else if (video.readyState >= 1) applyPendingSeek(video);

    // Keep play() in the click event so browsers can permit audible playback.
    void video.play().catch((error: unknown) => {
      if (videoRef.current !== video || !video.hasAttribute("src")) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setStatus("ready");
        setPlaybackHint("点击播放器的播放按钮继续观看。");
        return;
      }
      setStatus("error");
    });
  }

  function selectTutorial(id: string) {
    if (id === selectedId) return;
    releaseVideo(videoRef.current);
    pendingSeek.current = null;
    resumeAt.current = 0;
    setHasStarted(false);
    setPlaybackHint("");
    setStatus("idle");
    setSelectedId(id);
  }

  function jumpToStep(at: number) {
    playAt(at);
    const video = videoRef.current;
    video?.focus({ preventScroll: true });
    video?.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }

  return <div className={styles.tutorials}>
    <div className={styles.library}>
      <div className={styles.watchColumn}>
        <div className={styles.player} aria-busy={status === "loading"}>
          <video
            key={tutorial.id}
            ref={attachVideo}
            className={styles.video}
            aria-label={t("视频教程：{title}", { title: tutorial.title })}
            controls
            playsInline
            preload="none"
            poster={tutorial.poster}
            width={1280}
            height={960}
            tabIndex={0}
            onLoadStart={event => { if (event.currentTarget === videoRef.current && event.currentTarget.hasAttribute("src")) setStatus("loading"); }}
            onLoadedMetadata={event => { if (event.currentTarget === videoRef.current) applyPendingSeek(event.currentTarget); }}
            onCanPlay={event => { if (event.currentTarget === videoRef.current && event.currentTarget.hasAttribute("src")) setStatus("ready"); }}
            onPlaying={event => { if (event.currentTarget === videoRef.current) { setStatus("ready"); setPlaybackHint(""); } }}
            onWaiting={event => { if (event.currentTarget === videoRef.current && event.currentTarget.hasAttribute("src")) setStatus("loading"); }}
            onTimeUpdate={event => { if (event.currentTarget === videoRef.current) resumeAt.current = event.currentTarget.currentTime; }}
            onError={event => { if (event.currentTarget === videoRef.current && event.currentTarget.hasAttribute("src")) setStatus("error"); }}
          >
            <track kind="captions" src={tutorial.captions} srcLang={locale} label={t("中文字幕")} />
            {t("当前浏览器无法播放视频，请查看下方的本集步骤。")}
          </video>
          {!hasStarted && <button type="button" className={styles.playOverlay} onClick={() => playAt()} aria-label={t("播放教程：{title}", { title: tutorial.title })}>
            <span className={`button button--primary ${styles.playAction}`}><Play size={20} fill="currentColor" aria-hidden="true" />{t("播放第 {number} 集", { number: tutorial.number })}</span>
          </button>}
          {status === "loading" && <div className={styles.loading} role="status"><LoaderCircle size={16} className={styles.loadingIcon} aria-hidden="true" />{t("视频加载中…")}</div>}
          {status === "error" && <div className={styles.error} role="alert">
            <AlertCircle size={27} aria-hidden="true" />
            <strong>{t("视频暂时无法播放")}</strong>
            <p>{t("请重试，或先查看下方步骤。")}</p>
            <button type="button" className="button button--primary" onClick={() => playAt(resumeAt.current, true)}><RotateCcw size={16} aria-hidden="true" />{t("重试播放")}</button>
          </div>}
        </div>
        <div className={styles.videoInfo}>
          <div className={styles.metadata}><span>{t("第 {number} 集", { number: tutorial.number })}</span><span><Clock3 size={14} aria-hidden="true" />{tutorial.duration}</span><span><Volume2 size={14} aria-hidden="true" />{t("中文配音")}</span><span><Captions size={15} aria-hidden="true" />{t("中文字幕")}</span></div>
          <div className={styles.descriptionRow}>
            <div><h3 id="current-tutorial-title">{tutorial.title}</h3><p>{tutorial.description}</p></div>
            <Link className={`button button--secondary ${styles.actionLink}`} href={tutorial.href} prefetch={false}>{tutorial.actionLabel}<ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
          {playbackHint && <p className={styles.playbackHint} role="status">{t(playbackHint)}</p>}
        </div>
      </div>
      <aside className={styles.playlist} aria-label={t("教程选集")}>
        <div className={styles.playlistHeading}><h3>{t("全部教程")}</h3><span>{t("{count} 集", { count: tutorials.length })}</span></div>
        <ol className={styles.episodes}>{tutorials.map(item => <li key={item.id}>
          <button
            type="button"
            className={styles.episode}
            aria-pressed={tutorial.id === item.id}
            aria-label={t("第 {number} 集 {title}", { number: item.number, title: item.title })}
            onClick={() => selectTutorial(item.id)}
          >
            <span className={styles.episodeNumber} aria-hidden="true">{item.number}</span>
            <span className={styles.episodeCopy}><strong>{item.title}</strong><span>{item.duration}{tutorial.id === item.id && <span className={styles.currentLabel}>{t("当前选择")}</span>}</span></span>
            <Play size={15} className={styles.episodePlay} aria-hidden="true" />
          </button>
        </li>)}</ol>
      </aside>
    </div>
    <div className={styles.stepSection} aria-labelledby="tutorial-steps-heading">
      <div className={styles.stepsHeading}><h3 id="tutorial-steps-heading">{t("本集步骤")}</h3><span>{t("点击时间，直接观看")}</span></div>
      <ol className={styles.steps}>{tutorial.steps.map(step => <li key={`${tutorial.id}-${step.at}`}>
        <button type="button" className={styles.stepTime} onClick={() => jumpToStep(step.at)} aria-label={t("从 {time} 观看：{title}", { time: timestamp(step.at), title: step.title })}><Play size={13} aria-hidden="true" />{timestamp(step.at)}</button>
        <div><h4>{step.title}</h4><p>{step.body}</p></div>
      </li>)}</ol>
    </div>
    <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{t("已选择第 {number} 集：{title}", { number: tutorial.number, title: tutorial.title })}</p>
  </div>;
}
