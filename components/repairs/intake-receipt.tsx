"use client";
import { lazy, Suspense, useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Printer, X, RotateCcw, Download } from "lucide-react";
import { useBackendState } from "@/components/backend-snapshot";
import { ContentProgress, useActivityFeedback } from "@/components/operation-feedback";
import { useStoreSettings } from "@/components/settings/settings-store";
import { SelectControl } from "@/components/select-control";
import { can } from "@/lib/staff";
import type { IntakeReceiptData } from "@/lib/repair-intake-record";
import { printLabel, printLanguages, type PrintLabel, type PrintLanguage } from "@/lib/print-language";
import { canonicalPrintJson, type ReceiptPaper } from "@/lib/repair-print-layout";
import styles from "./intake-receipt.module.css";
export type { IntakeReceiptData } from "@/lib/repair-intake-record";
const PdfPreview = lazy(() => import("./receipt-pdf-preview"));
type PdfFile = { bytes: Uint8Array; url: string; name: string };
const fallbackError: PrintLabel = "receiptUnavailable";
type Result = { source: string; selection: string; file?: PdfFile; error?: PrintLabel; blocks?: string[] };

export function IntakeReceipt({ data, onClose, restoreFocusRef }: { data: IntakeReceiptData; onClose: () => void; restoreFocusRef?: RefObject<HTMLElement | null> }) {
  const backend = useBackendState();
  const { settings, ready: settingsReady, error: settingsError } = useStoreSettings();
  const [paperChoice, setPaper] = useState<ReceiptPaper | null>(null), [language, setLanguage] = useState<PrintLanguage>("it"), [zoom, setZoom] = useState("fit"), [attempt, setAttempt] = useState(0);
  const paper = paperChoice ?? settings.paper;
  const [result, setResult] = useState<Result | null>(null), [printHelp, setPrintHelp] = useState(false), [printError, setPrintError] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [lastSuccess, setLastSuccess] = useState<{ source: string; file: PdfFile } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), cache = useRef(new Map<string, Promise<PdfFile>>()), urls = useRef(new Set<string>()), controllers = useRef(new Set<AbortController>()), windows = useRef(new Set<Window>());
  const generation = useRef(0), title = useId();
  const member = backend.snapshot?.staff.members.find(m => m.id === backend.snapshot?.staff.currentId);
  const current = backend.snapshot?.intakes.find(row => row.id === data.id);
  const scope = canonicalPrintJson([backend.snapshot?.storeId, backend.snapshot?.staff.currentId, member]);
  const [openedScope, setOpenedScope] = useState<string | null>(member ? scope : null);
  if (openedScope === null && member) setOpenedScope(scope);
  const unavailable = accessDenied || !backend.formal || !backend.active || !member || !can(member, "repairs.view") || !current || scope !== openedScope || !settingsReady || Boolean(settingsError);
  const source = canonicalPrintJson([scope, backend.active, unavailable, current, backend.snapshot?.workflows[data.id], backend.snapshot?.signatures.filter(s => s.orderId === data.id), { shopName: settings.shopName, address: settings.address, phone: settings.phone, repairWarrantyMonths: settings.repairWarrantyMonths }]);
  const selection = canonicalPrintJson([paper, language]);
  const live = useRef({ source, selection, unavailable });
  useLayoutEffect(() => { live.current = { source, selection, unavailable }; }, [source, selection, unavailable]);
  const shown = result?.source === source && result.selection === selection ? result : null;
  const file = !unavailable ? shown?.file : undefined;
  const previewFile = !unavailable && lastSuccess?.source === source ? lastSuccess.file : undefined;
  const busy = !unavailable && !shown;
  const t = (key: PrintLabel) => printLabel(key, language);
  useActivityFeedback(busy, { kind: "read", scope: "receipt-pdf" });
  useLayoutEffect(() => {
    const previous = restoreFocusRef?.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const element = dialog.current; element?.showModal();
    return () => { element?.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [restoreFocusRef]);
  useLayoutEffect(() => {
    const epochs = generation;
    epochs.current++;
    const pending = controllers.current, knownUrls = urls.current, opened = windows.current, entries = cache.current;
    return () => {
      epochs.current++;
      for (const controller of pending) controller.abort(); pending.clear(); entries.clear();
      for (const url of knownUrls) URL.revokeObjectURL(url); knownUrls.clear();
      for (const window of opened) { try { window.close(); } catch {} } opened.clear();
    };
  }, [source]);
  useEffect(() => {
    if (unavailable || !current) return;
    const epoch = generation.current;
    let subscribed = true;
    let pending = cache.current.get(selection);
    if (!pending) {
      const controller = new AbortController(); controllers.current.add(controller);
      pending = (async () => {
        const response = await fetch("/api/backend/repair-receipt", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store", signal: controller.signal, body: JSON.stringify({ id: data.id, paper, language, expectedRevision: current.revision ?? 1 }) });
        if (!response.ok) {
          if ((response.status === 401 || response.status === 403) && epoch === generation.current && live.current.source === source) setAccessDenied(true);
          const body = await response.json().catch(() => ({}));
          const code: PrintLabel = ["receiptChanged", "receiptBusy", "printOverflow", "printFontError", "printLayoutError"].includes(body.code) ? body.code : "receiptUnavailable";
          throw { code, blocks: Array.isArray(body.blocks) ? body.blocks.filter((b: unknown) => typeof b === "string") : [] };
        }
        if (!response.headers.get("content-type")?.startsWith("application/pdf")) throw { code: "printLayoutError" };
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length > 4 * 1024 * 1024 || new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") throw { code: "printLayoutError" };
        if (epoch !== generation.current || live.current.source !== source || live.current.unavailable) throw new DOMException("Stale receipt", "AbortError");
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })); urls.current.add(url);
        return { bytes, url, name: `${data.id}-${language}-${paper}.pdf` };
      })().finally(() => controllers.current.delete(controller));
      cache.current.set(selection, pending);
    }
    pending.then(file => { if (subscribed && epoch === generation.current && live.current.source === source && live.current.selection === selection && !live.current.unavailable) { setResult({ source, selection, file }); setLastSuccess({ source, file }); } }).catch((error: { code?: PrintLabel; blocks?: string[] }) => {
      if (subscribed && epoch === generation.current && live.current.source === source && live.current.selection === selection) { cache.current.delete(selection); setResult({ source, selection, error: error.code ?? fallbackError, blocks: error.blocks }); }
    });
    return () => { subscribed = false; };
  }, [source, selection, attempt, unavailable, current, data.id, paper, language]);
  const retry = () => { setResult(null); setAttempt(n => n + 1); };
  const print = () => {
    if (!file || live.current.unavailable || live.current.source !== source || live.current.selection !== selection) return;
    const opened = window.open("about:blank", "_blank");
    if (!opened) { setPrintError(true); return; }
    opened.opener = null; opened.location.replace(file.url); windows.current.add(opened); setPrintHelp(true); setPrintError(false);
  };
  return createPortal(<dialog ref={dialog} className={"intake-receipt-dialog " + styles.root} aria-labelledby={title} data-pdf-phase={unavailable ? "unavailable" : busy ? "generating" : file ? "ready" : "error"} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header className="intake-receipt-toolbar"><h2 id={title}>{t("repairPreview")}</h2><button type="button" className="icon-button" aria-label={t("close")} onClick={onClose}><X size={20}/></button></header>
    <div className={"intake-receipt-toolbar intake-receipt-options " + styles.options}>
      <label className="field"><span>{t("paper")}</span><SelectControl key={language} value={paper} aria-label={t("paper")} onChange={e => setPaper(e.target.value as ReceiptPaper)}>{(["a4", "a5", "half", "double"] as const).map(value => <option key={value} value={value}>{t(value)}</option>)}</SelectControl></label>
      <label className="field"><span>{t("printLanguage")}</span><SelectControl value={language} aria-label={t("printLanguage")} onChange={e => setLanguage(e.target.value as PrintLanguage)}>{printLanguages.map(row => <option key={row.value} value={row.value}>{row.label}</option>)}</SelectControl></label>
      <label className="field"><span>{t("previewZoom")}</span><SelectControl key={language} value={zoom} aria-label={t("previewZoom")} onChange={e => setZoom(e.target.value)}><option value="fit">{t("fitScreen")}</option><option value="1">100%</option></SelectControl></label>
      <button type="button" className="button button--primary" disabled={!file} onClick={print}><Printer size={17}/>{t("pdfOpenPrint")}</button>
      {file ? <a className="button button--secondary" href={file.url} download={file.name}><Download size={17}/>{t("pdfDownload")}</a> : <button type="button" className="button button--secondary" disabled><Download size={17}/>{t("pdfDownload")}</button>}
      {busy ? <p className={styles.feedback} role="status">{t("pdfGenerating")}</p> : null}
      {previewFile && !file ? <p className={styles.feedback} role="note">{t("pdfPreviousPreview")}</p> : null}
      {unavailable || shown?.error ? <p className={styles.feedback + " form-error"} role="alert">{t(!backend.formal ? "receiptFormalOnly" : unavailable ? "receiptUnavailable" : shown!.error!)}{shown?.blocks?.length ? " " + shown.blocks.join(" · ") : null}{!unavailable ? <button type="button" className="button button--secondary" onClick={retry}><RotateCcw size={17}/>{t("printCheckRetry")}</button> : null}</p> : null}
      {printError ? <p className={styles.feedback + " form-error"} role="alert">{t("printWindowError")}</p> : null}
      {printHelp && file ? <p className={styles.feedback} role="status">{t("pdfPrintHelp")}</p> : null}
    </div>
    <ContentProgress scope="receipt-pdf"/>
    <div className={styles.viewer} aria-busy={busy}>{previewFile ? <Suspense fallback={<p role="status">{t("pdfPreview")}</p>}><PdfPreview key={previewFile.url} bytes={previewFile.bytes} zoom={zoom} language={language}/></Suspense> : null}</div>
  </dialog>, document.body);
}
