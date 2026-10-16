"use client";
import { useEffect, useRef, useState } from "react";
import { printLabel, type PrintLanguage } from "@/lib/print-language";
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask, TextLayer } from "pdfjs-dist";
import styles from "./intake-receipt.module.css";

export default function ReceiptPdfPreview({ bytes, zoom, language }: { bytes: Uint8Array; zoom: string; language: PrintLanguage }) {
  const host = useRef<HTMLDivElement>(null), sheet = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), textHost = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true, document: PDFDocumentProxy | undefined, loading: PDFDocumentLoadingTask | undefined, task: RenderTask | undefined, observer: ResizeObserver | undefined, textLayer: TextLayer | undefined, library: typeof import("pdfjs-dist") | undefined, sequence = 0;
    let pending = false;
    const render = async () => {
      if (!active || !document || !canvas.current || !host.current) return;
      const renderId = ++sequence;
      try {
      task?.cancel(); textLayer?.cancel();
      const page = await document.getPage(1);
      if (!active || renderId !== sequence || !canvas.current || !host.current || !sheet.current || !textHost.current || !library) return;
      const base = page.getViewport({ scale: 1 });
      const width = zoom === "fit" ? Math.max(1, host.current.clientWidth) : base.width * 96 / 72;
      const scale = width / base.width, ratio = Math.min(window.devicePixelRatio || 1, 2), viewport = page.getViewport({ scale: scale * ratio });
      const element = canvas.current;
      element.width = Math.ceil(viewport.width); element.height = Math.ceil(viewport.height);
      element.style.width = `${width}px`; element.style.height = `${base.height * scale}px`;
      sheet.current.style.width = `${width}px`; sheet.current.style.height = `${base.height * scale}px`;
      textHost.current.replaceChildren();
      textHost.current.style.setProperty("--total-scale-factor", String(scale));
      textLayer = new library.TextLayer({ textContentSource: page.streamTextContent({ disableNormalization: true }), container: textHost.current, viewport: page.getViewport({ scale }) });
      task = page.render({ canvas: element, viewport });
      await Promise.all([task.promise, textLayer.render()]);
      } catch (reason) { if (active && renderId === sequence && !(reason instanceof Error && reason.name === "RenderingCancelledException")) setError(true); }
    };
    import("pdfjs-dist").then(async pdfjs => {
      if (!active) return;
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      library = pdfjs;
      loading = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false });
      const loaded = await loading.promise;
      if (!active) { await loaded.loadingTask.destroy(); return; }
      document = loaded;
      if (loaded.numPages !== 1) { setError(true); return; }
      await render();
      observer = new ResizeObserver(() => { if (pending) return; pending = true; queueMicrotask(() => { pending = false; void render(); }); });
      if (host.current) observer.observe(host.current);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; observer?.disconnect(); task?.cancel(); textLayer?.cancel(); void loading?.destroy(); };
  }, [bytes, zoom]);
  return <div ref={host} className={styles.pdfHost}>{error ? <p className="form-error" role="alert">{printLabel("pdfPreviewError", language)}</p> : <div ref={sheet} className={styles.pdfSheet}><canvas ref={canvas} aria-hidden="true"/><div ref={textHost} className={styles.textLayer} role="document" aria-label={printLabel("pdfPreview", language)}/></div>}</div>;
}
