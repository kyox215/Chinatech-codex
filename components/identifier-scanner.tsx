"use client";

import { useLanguage } from "@/components/language-provider";
import { InputControl } from "@/components/input-control";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Camera, ImagePlus, ScanLine, X } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { SelectControl } from "@/components/select-control";
import { identifierScanValue, type IdentifierKind } from "@/lib/identifier-scan";
import { cameraErrorMessage } from "@/lib/repair-scan";
import styles from "./identifier-scanner.module.css";

type Phase = "idle" | "starting" | "scanning" | "photo";
type ScannerResultActions = { close: () => void; reset: () => void };
type IdentifierScannerProps = {
  title?: string;
  triggerLabel?: string;
  iconOnly?: boolean;
  disabled?: boolean;
  prompt?: string;
  inputLabel?: string;
  manualAction?: string;
  placeholder?: string;
  kind?: IdentifierKind;
  onConfirm?: (value: string) => void;
  renderResult?: (raw: string, actions: ScannerResultActions) => ReactNode;
};

function ScannerResult({ raw, renderResult, onClose, onReset }: { raw: string; renderResult: NonNullable<IdentifierScannerProps["renderResult"]>; onClose: () => void; onReset: () => void }) {
  return renderResult(raw, { close: onClose, reset: onReset });
}

/** One camera/photo lifecycle shared by lookup dialogs and identity fields. */
export function IdentifierScanner({ title = "识别设备标识", triggerLabel = "扫码", iconOnly = false, disabled = false, prompt = "扫描设备上的 SN 或 IMEI", inputLabel = "识别内容", manualAction = "核对识别内容", placeholder = "输入或粘贴识别内容", kind = "serial", onConfirm, renderResult }: IdentifierScannerProps) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const controls = useRef<IScannerControls | null>(null);
  const generation = useRef(0);
  const operationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoUrl = useRef<string | null>(null);
  const titleId = useId();
  const inputId = useId();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [open, setOpen] = useState(false);

  function stopOperation() {
    generation.current += 1;
    if (operationTimeout.current) clearTimeout(operationTimeout.current);
    operationTimeout.current = null;
    controls.current?.stop(); controls.current = null;
    stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null;
    if (video.current) { video.current.pause(); video.current.srcObject = null; }
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    photoUrl.current = null;
  }

  useEffect(() => {
    const pause = () => { stopOperation(); setPhase("idle"); };
    const visibility = () => { if (document.visibilityState === "hidden") pause(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pause);
    return () => { document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", pause); stopOperation(); };
  }, []);

  function acceptCode(value: string) {
    stopOperation(); setPhase("idle"); setCode(value); setResult(value); setMessage("");
  }
  function reset() { stopOperation(); setResult(null); setMessage(""); setCode(""); setPhase("idle"); }
  function close() { stopOperation(); setOpen(false); dialog.current?.close(); }

  async function startCamera(deviceId = cameraId) {
    stopOperation(); const attempt = generation.current;
    setMessage(""); setResult(null); setPhase("starting");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setPhase("idle"); setMessage("当前地址无法使用相机。请使用 HTTPS 地址，或通过相册、手动输入。"); return;
    }
    operationTimeout.current = setTimeout(() => {
      if (attempt !== generation.current) return;
      stopOperation(); setPhase("idle"); setMessage("相机尚未开启，请确认浏览器权限后重试，或使用相册、手动输入。");
    }, 15000);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (attempt !== generation.current) return;
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } }), width: { ideal: 1280 }, height: { ideal: 720 } } });
      if (attempt !== generation.current || !dialog.current?.open || !video.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media;
      const activeCamera = media.getVideoTracks()[0]?.getSettings().deviceId;
      if (activeCamera) setCameraId(activeCamera);
      void navigator.mediaDevices.enumerateDevices().then((devices) => { if (attempt === generation.current) setCameras(devices.filter((device) => device.kind === "videoinput")); }).catch(() => {});
      const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 250, delayBetweenScanSuccess: 1000, tryPlayVideoTimeout: 10000 });
      const scanner = await reader.decodeFromStream(media, video.current, (decoded, _error, currentControls) => {
        if (attempt !== generation.current || !decoded) return;
        currentControls.stop(); acceptCode(decoded.getText());
      });
      if (attempt !== generation.current) { scanner.stop(); return; }
      if (operationTimeout.current) clearTimeout(operationTimeout.current);
      operationTimeout.current = null;
      controls.current = scanner; setPhase("scanning");
    } catch (error) {
      if (attempt !== generation.current) return;
      stopOperation(); setPhase("idle"); setMessage(cameraErrorMessage(error));
    }
  }

  async function readPhoto(file: File | undefined) {
    if (!file) return;
    stopOperation(); const attempt = generation.current;
    setResult(null); setMessage(""); setPhase("photo");
    if (!/^image\/(png|jpeg|webp|gif|heic|heif)$/.test(file.type) || file.size > 20 * 1024 * 1024) {
      setPhase("idle"); setMessage("请选择小于 20MB 的条码照片。"); return;
    }
    const url = URL.createObjectURL(file); photoUrl.current = url;
    operationTimeout.current = setTimeout(() => {
      if (attempt !== generation.current) return;
      stopOperation(); setPhase("idle"); setMessage("图片识别超时，请换用清晰的条码照片或手动输入。");
    }, 15000);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (attempt !== generation.current) return;
      const decoded = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
      if (attempt === generation.current) acceptCode(decoded.getText());
    } catch {
      if (attempt === generation.current) { stopOperation(); setPhase("idle"); setMessage("未识别到条码，请裁近、保持清晰后重试，或手动输入。"); }
    } finally { URL.revokeObjectURL(url); if (photoUrl.current === url) photoUrl.current = null; }
  }

  const busy = phase === "starting" || phase === "photo";
  const confirmed = result === null ? null : identifierScanValue(result, kind);
  function submitManual() { const input = document.getElementById(inputId) as HTMLInputElement | null; if (!input?.reportValidity()) return; if (code.trim() && !busy) acceptCode(code.trim()); }

  return <>
    <button className={iconOnly ? `icon-button ${styles.scanButton}` : "button button--secondary button--compact"} type="button" aria-label={t(triggerLabel)} title={t(triggerLabel)} disabled={disabled} onClick={() => { reset(); dialog.current?.showModal(); setOpen(true); }}><ScanLine size={iconOnly ? 20 : 17} />{iconOnly ? null : t(triggerLabel)}</button>
    <dialog className={styles.dialog} ref={dialog} aria-labelledby={titleId} onClose={() => { stopOperation(); setOpen(false); setPhase("idle"); }} onCancel={() => { stopOperation(); setOpen(false); setPhase("idle"); }}>
      <header className={styles.header}><h2 id={titleId}>{t(title)}</h2><button className={`icon-button ${styles.closeButton}`} type="button" aria-label={t("关闭扫码")} onClick={close}><X size={20} /></button></header>
      <div className={styles.preview} data-active={phase === "scanning" || phase === "starting"}><video ref={video} autoPlay muted playsInline aria-label={t("相机扫描画面")} />{phase !== "scanning" ? <div><ScanLine size={36} /><span>{phase === "starting" ? t("正在开启相机…") : phase === "photo" ? t("正在识别…") : t(prompt)}</span></div> : <span className={styles.target} aria-hidden="true" />}</div>
      <div className={styles.actions}>{phase === "scanning" || phase === "starting" ? <button className="button button--secondary" type="button" onClick={() => { stopOperation(); setPhase("idle"); }}>{t("停止扫描")}</button> : <button className="button button--primary" type="button" disabled={busy} onClick={() => void startCamera()}><Camera size={18} />{t("开启相机")}</button>}<label className={`button button--secondary${busy ? ` ${styles.disabled}` : ""}`}><ImagePlus size={18} />{t("相册识码")}<input className="visually-hidden" type="file" accept="image/*" aria-label={t("相册识码")} disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void readPhoto(file); }} /></label></div>
      {cameras.length > 1 ? <label className="field"><span>{t("镜头")}</span><SelectControl aria-label={t("扫描镜头")} value={cameraId} disabled={busy} onChange={(event) => { const value = event.target.value; setCameraId(value); if (phase === "scanning") void startCamera(value); }}>{cameras.map((camera, index) => <option value={camera.deviceId} key={camera.deviceId}>{camera.label || `${t("镜头")} ${index + 1}`}</option>)}</SelectControl></label> : null}
      <div className={styles.manual}><label className="field" htmlFor={inputId}><span>{t(inputLabel)}</span><InputControl required disabled={!open || busy} aria-label={t(inputLabel)} validate={value => !value.trim() ? "请填写识别内容，或使用相机、相册识码。" : !renderResult ? identifierScanValue(value, kind).error ?? "" : ""} onClear={() => { setCode(""); setResult(null); setMessage(""); }} clearLabel={t("清空{v0}", { v0: t(inputLabel) })} id={inputId} inputMode={kind === "imei" ? "numeric" : "text"} value={code} onChange={(event) => { setCode(event.target.value); setResult(null); setMessage(""); }} onKeyDown={(event) => { if (event.nativeEvent.isComposing || event.keyCode === 229) return; if (event.key === "Enter") { event.preventDefault(); submitManual(); } }} autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={512} placeholder={t(placeholder)} /></label><button className="button button--secondary" type="button" disabled={!code.trim() || busy} onClick={submitManual}>{t(manualAction)}</button></div>
      {message ? <p className="procurement-feedback procurement-feedback--error" role="alert">{t(message)}</p> : null}
      {result !== null ? renderResult ? <ScannerResult raw={result} renderResult={renderResult} onClose={close} onReset={reset} /> : <section className={styles.confirmation} aria-live="polite"><strong>{t("识别原文")}</strong><p className={styles.raw}>{result}</p>{confirmed?.error ? <p className="procurement-feedback procurement-feedback--error" role="alert">{t(confirmed.error)}</p> : null}<div className={styles.confirmationButtons}><button className="button button--primary" type="button" disabled={!confirmed?.value} onClick={() => { if (confirmed?.value) { onConfirm?.(confirmed.value); close(); } }}>{t("确认填入")}</button><button className="button button--secondary" type="button" onClick={reset}>{t("重新识别")}</button></div></section> : null}
    </dialog>
  </>;
}
