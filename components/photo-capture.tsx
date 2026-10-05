"use client";

import { useLanguage } from "@/components/language-provider";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { Camera, ImagePlus, RotateCcw, X } from "lucide-react";
import { SelectControl } from "@/components/select-control";
import { cameraErrorMessage } from "@/lib/repair-scan";
import styles from "./photo-capture.module.css";

type Phase = "idle" | "starting" | "live" | "capturing" | "review" | "saving";
type CapturedPhoto = { file: File; url: string };
type PhotoCaptureProps = {
  label: string;
  onConfirm: (file: File) => void | Promise<void>;
  triggerLabel?: string;
  triggerClassName?: string;
  disabled?: boolean;
};

/** Capture produces a pending photo; only explicit confirmation reaches the caller. */
export function PhotoCapture({ label, onConfirm, triggerLabel = "拍照", triggerClassName = "button button--secondary", disabled = false }: PhotoCaptureProps) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const media = useRef<MediaStream | null>(null);
  const currentPhoto = useRef<CapturedPhoto | null>(null);
  const generation = useRef(0);
  const lifecycle = useRef({ session: 0, alive: false });
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirming = useRef(false);
  const titleId = useId();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");

  function stopCamera() {
    generation.current++;
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
    media.current?.getTracks().forEach(track => track.stop()); media.current = null;
    if (video.current) { video.current.pause(); video.current.srcObject = null; }
  }
  function releasePhoto() {
    if (currentPhoto.current) URL.revokeObjectURL(currentPhoto.current.url);
    currentPhoto.current = null;
  }
  function clearPhoto() { releasePhoto(); setPhoto(null); setPreviewReady(false); }
  function close() { lifecycle.current.session++; stopCamera(); clearPhoto(); dialog.current?.close(); }
  function reviewPhoto(file: File) {
    stopCamera(); clearPhoto();
    const selected = { file, url: URL.createObjectURL(file) };
    currentPhoto.current = selected; setPhoto(selected); setPreviewReady(false); setPhase("review");
    timeout.current = setTimeout(() => {
      if (currentPhoto.current?.url !== selected.url) return;
      timeout.current = null; setMessage("照片预览超时，请重拍或上传 JPG / PNG。"); setPreviewReady(false);
    },8000);
  }
  function finishPreview(url: string, success: boolean) {
    if (currentPhoto.current?.url !== url) return;
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null; setPreviewReady(success);
    setMessage(success ? "" : "照片无法预览，请重拍或上传 JPG / PNG。");
  }

  useEffect(() => {
    const currentLifecycle = lifecycle.current;
    currentLifecycle.alive = true;
    const pause = () => {
      stopCamera();
      if (!confirming.current) setPhase(currentPhoto.current ? "review" : "idle");
    };
    const visibility = () => { if (document.visibilityState === "hidden") pause(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pause);
    return () => { currentLifecycle.alive = false; currentLifecycle.session++; document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", pause); stopCamera(); releasePhoto(); };
  }, []);

  async function startCamera(deviceId = cameraId) {
    stopCamera(); clearPhoto(); setMessage(""); setPhase("starting");
    const attempt = generation.current;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setPhase("idle"); setMessage("当前地址无法使用相机。请使用 HTTPS 地址，或选择上传照片。"); return;
    }
    timeout.current = setTimeout(() => {
      if (attempt !== generation.current) return;
      stopCamera(); setPhase("idle"); setMessage("相机尚未开启，请确认浏览器权限后重试，或上传照片。");
    }, 15000);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } }), width: { ideal: 1920 }, height: { ideal: 1080 } } });
      if (attempt !== generation.current || !dialog.current?.open || !video.current) { stream.getTracks().forEach(track => track.stop()); return; }
      media.current = stream;
      const camera = stream.getVideoTracks()[0];
      const activeId = camera?.getSettings().deviceId;
      if (activeId) setCameraId(activeId);
      if (camera) camera.addEventListener("ended", () => {
        if (attempt !== generation.current) return;
        stopCamera(); setPhase("idle"); setMessage("相机已中断，请重新开启或上传照片。");
      }, { once: true });
      void navigator.mediaDevices.enumerateDevices().then(devices => { if (attempt === generation.current) setCameras(devices.filter(device => device.kind === "videoinput")); }).catch(() => {});
      const player = video.current;
      player.srcObject = stream;
      await player.play();
      if (attempt !== generation.current) return;
      if (!player.videoWidth || !player.videoHeight) throw new Error("视频画面尚未就绪");
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = null;
      setPhase("live");
    } catch (failure) {
      if (attempt !== generation.current) return;
      stopCamera(); setPhase("idle"); setMessage(cameraErrorMessage(failure).replace("请使用相册或手动输入","请上传照片").replace("使用相册、手动输入","上传照片"));
    }
  }

  async function takePhoto() {
    const player = video.current;
    if (phase !== "live" || !player?.videoWidth || !player.videoHeight) return;
    const attempt = generation.current;
    setPhase("capturing"); setMessage("");
    timeout.current = setTimeout(() => {
      if (attempt !== generation.current) return;
      stopCamera(); setPhase("idle"); setMessage("拍照超时，请重试或上传照片。");
    }, 8000);
    try {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1,2560 / Math.max(player.videoWidth,player.videoHeight));
      canvas.width = Math.max(1,Math.round(player.videoWidth * scale));
      canvas.height = Math.max(1,Math.round(player.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("当前浏览器无法生成照片，请改用上传。");
      context.drawImage(player,0,0,canvas.width,canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve,"image/jpeg",0.9));
      if (attempt !== generation.current || !dialog.current?.open) return;
      if (!blob?.size) throw new Error("未能生成照片，请重拍或上传照片。");
      const file = new File([blob],`接机-${label}-${Date.now()}.jpg`,{ type: "image/jpeg", lastModified: Date.now() });
      reviewPhoto(file);
    } catch (failure) {
      if (attempt !== generation.current) return;
      stopCamera(); setPhase("idle"); setMessage(failure instanceof Error ? failure.message : "拍照失败，请重试或上传照片。");
    }
  }

  function selectUpload(file: File | undefined) {
    if (!file) return;
    stopCamera(); setMessage("");
    if (!file.size || !/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) { setMessage("请选择有效的 JPG、PNG、WebP 或 HEIC 照片。"); setPhase(currentPhoto.current ? "review" : "idle"); return; }
    reviewPhoto(file);
  }

  async function confirmPhoto() {
    if (!photo || !previewReady || confirming.current) return;
    const session = lifecycle.current.session;
    confirming.current = true; setPhase("saving"); setMessage("");
    try {
      await onConfirm(photo.file);
      if (lifecycle.current.alive && session === lifecycle.current.session && dialog.current?.open) close();
    } catch (failure) {
      if (lifecycle.current.alive && session === lifecycle.current.session && dialog.current?.open) { setPhase("review"); setMessage(failure instanceof Error ? failure.message : "照片未能加入，请重试。"); }
    } finally { confirming.current = false; }
  }

  const busy = phase === "starting" || phase === "capturing" || phase === "saving";
  return <>
    <button className={triggerClassName} type="button" aria-label={t(label)} disabled={disabled} onClick={() => { lifecycle.current.session++; setMessage(""); dialog.current?.showModal(); void startCamera(); }}><Camera size={16} />{t(triggerLabel)}</button>
    <dialog className={styles.dialog} ref={dialog} aria-labelledby={titleId} onCancel={() => { lifecycle.current.session++; stopCamera(); clearPhoto(); setPhase("idle"); }} onClose={() => { lifecycle.current.session++; stopCamera(); clearPhoto(); setPhase("idle"); }}>
      <header className={styles.header}><h2 id={titleId}>{t(label)}</h2><button className="icon-button" type="button" aria-label={t("关闭拍照")} onClick={close}><X size={20} /></button></header>
      <div className={styles.preview} data-live={phase === "live" || phase === "starting" || phase === "capturing"}><video ref={video} autoPlay muted playsInline aria-label={t("拍照相机画面")} />{photo ? <Image unoptimized width={640} height={480} src={photo.url} alt={t("待确认的接机照片")} onLoad={() => finishPreview(photo.url,true)} onError={() => finishPreview(photo.url,false)} /> : phase !== "live" ? <div className={styles.placeholder}><Camera size={36} /><span>{phase === "starting" ? t("正在开启相机…") : phase === "capturing" ? t("正在生成照片…") : t("相机未开启")}</span></div> : null}</div>
      {cameras.length > 1 && !photo ? <label className="field"><span>{t("镜头")}</span><SelectControl aria-label={t("拍照镜头")} value={cameraId} disabled={busy} onChange={event => { const id = event.target.value; setCameraId(id); if (phase === "live") void startCamera(id); }}>{cameras.map((camera,index) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label || `镜头 ${index + 1}`}</option>)}</SelectControl></label> : null}
      {message ? <p className={styles.error} role="alert">{message}</p> : null}
      {photo ? <p className={styles.status} role="status">{phase === "saving" ? t("正在读取照片…") : previewReady ? t("请核对照片后确认。") : message ? t("照片尚未就绪。") : t("正在读取照片预览…")}</p> : null}
      <div className={styles.actions}>{photo ? <><button className="button button--primary" type="button" disabled={!previewReady || busy} onClick={() => void confirmPhoto()}><Camera size={17} />{t("确认照片")}</button><button className="button button--secondary" type="button" disabled={busy} onClick={() => void startCamera()}><RotateCcw size={17} />{t("重拍")}</button></> : phase === "live" ? <button className="button button--primary" type="button" onClick={() => void takePhoto()}><Camera size={17} />{t("拍摄")}</button> : <button className="button button--primary" type="button" disabled={busy} onClick={() => void startCamera()}><Camera size={17} />{phase === "starting" ? t("正在开启…") : phase === "capturing" ? t("正在拍摄…") : t("重新开启相机")}</button>}<label className={`button button--secondary${busy ? ` ${styles.disabled}` : ""}`} onClick={() => { if (!busy) { stopCamera(); if (!photo) setPhase("idle"); } }}><ImagePlus size={17} />{t("上传照片")}<input className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" aria-label={t("上传照片作为拍照回退")} disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; selectUpload(file); }} /></label></div>
    </dialog>
  </>;
}
