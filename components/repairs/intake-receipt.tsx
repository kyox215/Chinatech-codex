"use client";
import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Printer, X, RotateCcw } from "lucide-react";
import { useLocalIntakes, useRepairDirectory } from "./local-intake-store";
import { useRepairWorkflows } from "./repair-workflow-store";
import { initialRepairWorkflow } from "@/lib/repair-workflow";
import { useBackendState } from "@/components/backend-snapshot";
import { ContentProgress, useActivityFeedback } from "@/components/operation-feedback";
import { intakeRequirements, currentRepairRequirements } from "@/lib/repair-requirements";
import { itemQuoteTotal } from "@/lib/repair-item-pricing";
import { getRepairOrder } from "@/lib/repair-fixtures";
import { useStoreSettings } from "@/components/settings/settings-store";
import { SelectControl } from "@/components/select-control";
import { matchingIntakeSignature, type IntakeReceiptData } from "@/lib/repair-intake-record";
import { printLabel, printLanguages, type PrintLabel, type PrintLanguage } from "@/lib/print-language";
import { canonicalPrintJson, repairPrintProjection, receiptMaster, receiptPaperGeometry, receiptSmallScale, type ReceiptPaper, type RepairPrintProjection } from "@/lib/repair-print-layout";
import { SignatureImage } from "./intake-signature";
import styles from "./intake-receipt.module.css";
export type { IntakeReceiptData } from "@/lib/repair-intake-record";

type QrData = { path: string; size: number };
type Fit = { key: string; generation: number; phase: "measuring" | "fit" | "overflow" | "error" | "unavailable"; reason: PrintLabel; heightMm: number; widthMm: number; smallHeightMm?: number };
const css = (value: Record<string, string | number>) => value as CSSProperties;
function MasterContent({ projection: p, copy, contentRef }: { projection: RepairPrintProjection; copy: "customerCopy" | "shopCopy"; contentRef?: React.Ref<HTMLDivElement> }) {
  const notePrefix = useId();
  const fact = (row: { key: string; label: string; value: string }, core = false) => <span key={row.key} data-fact={row.key} className={styles.fact + (core ? " " + styles.core : "")}><b>{row.label}:</b> <span>{row.value}</span></span>;
  const quoteGroups: Array<{ kind: RepairPrintProjection["reviewQuotes"][number]["associationKind"]; note: string; quotes: RepairPrintProjection["reviewQuotes"] }> = [];
  for (const quote of p.reviewQuotes) {
    const previous = quoteGroups[quoteGroups.length - 1];
    if (previous?.kind === quote.associationKind) previous.quotes.push(quote);
    else quoteGroups.push({ kind: quote.associationKind, note: quote.note, quotes: [quote] });
  }
  const signatureMeta = <div className={styles.signatureMeta}>{p.signature ? <p>{p.signature.label}</p> : p.signatureHistory ? <p className={styles.signatureHistory}>{p.signatureHistory}</p> : null}<p>{p.termsVersion}</p></div>;
  return <article className={"intake-receipt-sheet " + styles.copy} lang={p.language} data-copy={copy} data-projection-hash={p.canonicalProjectionHash}>
    <div className={styles.content} ref={contentRef} data-master-content>
      <section className={styles.order} data-fold="order">
        <header className={styles.shop}><div className={styles.brand}><strong>{p.shopName}</strong><h3>{p.labels.repairTitle}</h3></div><p>{p.shopContact}</p><p><b>{p.labels.orderNumber}:</b> {p.orderId} · <span data-copy-label>{printLabel(copy, p.language)}</span></p></header>
        <section className={styles.summary}><div className={styles.factFlow}>{p.identity.map(row => fact(row))}</div><div className={styles.factFlow + " " + styles.model}>{p.device.map(row => fact(row, row.key === "model"))}</div><div className={styles.factFlow}>{p.shortFacts.map(row => fact(row))}</div><p className={styles.total + " " + styles.core} data-fact="total"><b>{p.labels.total}: {p.total}</b></p></section>
        <section className={styles.work} data-print-current-projects data-merged={p.merged}>
          {p.rows.length ? <table className={styles.requests + " " + styles.core}><thead><tr><th>{p.labels.projects}</th><th>{p.labels.amount}</th></tr></thead><tbody>{p.rows.map(row => <Fragment key={row.id}><tr data-requirement-id={row.id} data-requirement-revision={row.revision} data-requirement-request={row.rawRequest}><td>{p.merged ? row.texts[0] : row.texts.join(" · ")}{row.ambiguous ? <div className={styles.rowWarning}>{p.labels.projectReview}</div> : null}</td><td>{row.amount}</td></tr>{p.merged ? row.texts.slice(1).map((text, index) => <tr data-service-detail={row.id} key={row.id + ":" + index}><td colSpan={2}>{text}</td></tr>) : null}</Fragment>)}</tbody></table> : <p><b>{p.labels.projects}:</b> {p.labels.evaluate}</p>}
          {quoteGroups.map((group, index) => { const noteId = notePrefix + "-quote-" + index; return <section key={index} data-print-review-quotes data-quote-group={group.kind}><h4>{p.labels.review}</h4><p id={noteId} className={styles.associationNote}>{group.note}</p><table className={styles.requests + " " + styles.core} aria-describedby={noteId}><thead><tr><th>{p.labels.description}</th><th>{p.labels.amount}</th></tr></thead><tbody>{group.quotes.map(quote => <tr key={quote.item} data-quote-item={quote.item} data-association-kind={quote.associationKind} aria-describedby={noteId}><td>{quote.label}</td><td>{quote.amount}</td></tr>)}</tbody></table></section>; })}
          {!p.merged ? <section className={styles.separateIntake} data-print-intake-requests><h4>{p.labels.intake}</h4>{p.intakeServices.length ? p.intakeServices.map(text => <p key={text} className={styles.core}>{text}</p>) : <p>{p.labels.evaluate}</p>}</section> : null}
        </section>
        <p className={styles.scope}>{p.scope}</p>
        <section className={styles.faults + " " + styles.core}><p><b>{p.labels.fault}:</b> {p.issue.faults.join("; ") || "—"}</p>{p.issue.note ? <p><b>{p.labels.note}:</b> {p.issue.note}</p> : null}</section>
        <section className={styles.service + " " + styles.factFlow}>{p.serviceFacts.map(row => fact(row))}{p.local ? <p>{p.local}</p> : null}</section>
      </section>
      <section className={styles.warranty} data-fold="warranty">
        <header className={styles.warrantyHead}><h3>{p.warrantyTitle}</h3></header>
        <section className={styles.terms}><ol>{p.terms.map((text, index) => <li key={index}>{text}</li>)}</ol><p>{p.rights}</p><p>{p.acknowledgement}</p></section>
        <section className={styles.footer} data-signature-history={!p.signature && Boolean(p.signatureHistory)}><div className={styles.signature}><h4>{p.labels.signature}</h4><div className={styles.signatureInk}>{p.signature ? <SignatureImage strokes={p.signature.strokes} aspectRatio={p.signature.aspectRatio} label={p.labels.signature} /> : null}</div>{!p.signature ? signatureMeta : null}</div>{p.signature ? signatureMeta : null}{p.qr ? <svg className={styles.qr} role="img" aria-label={p.labels.qr + " " + p.orderId} viewBox={"0 0 " + p.qr.size + " " + p.qr.size} shapeRendering="crispEdges"><rect width="100%" height="100%" fill="white" /><path d={p.qr.path} fill="black" /></svg> : <span className={styles.qr} />}</section>
        <section className={styles.tracking}><p><b>{p.labels.tracking}</b> · {p.labels.scan} · {p.labels.trackingLimit} · {p.labels.keepReceipt}</p></section>
      </section>
    </div>
  </article>;
}

function masterBounds(content: HTMLElement, scale = 1) {
  const bounds = content.getBoundingClientRect(); let left = bounds.left, right = bounds.right, top = bounds.top, bottom = bounds.bottom;
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT); let node: Node | null;
  while ((node = walker.nextNode())) if (node.textContent?.trim()) { const range = document.createRange(); range.selectNodeContents(node); for (const rect of range.getClientRects()) { left = Math.min(left, rect.left); right = Math.max(right, rect.right); top = Math.min(top, rect.top); bottom = Math.max(bottom, rect.bottom); } }
  for (const svg of content.querySelectorAll("svg")) { const rect = svg.getBoundingClientRect(); right = Math.max(right, rect.right); bottom = Math.max(bottom, rect.bottom); left = Math.min(left, rect.left); top = Math.min(top, rect.top); }
  return { heightMm: (bottom - Math.min(top, bounds.top)) * 25.4 / 96 / scale, widthMm: (right - left) * 25.4 / 96 / scale, horizontalOverflow: left < bounds.left - .01 || right > bounds.right + .01, width: bounds.width };
}

function fontReadiness(): "loaded" | "loading" | "error" {
  const faces = [...document.fonts].filter(face => face.family.replaceAll('"', "").replaceAll("'", "") === "Source Sans 3");
  if (!faces.length || faces.some(face => face.status === "error")) return "error";
  if (faces.some(face => face.status !== "loaded") || document.fonts.status === "loading") return "loading";
  return document.fonts.check('14.4pt "Source Sans 3"') && document.fonts.check('700 16pt "Source Sans 3"') ? "loaded" : "error";
}
export function IntakeReceipt({ data, onClose }: { data: IntakeReceiptData; onClose: () => void }) {
  const backend = useBackendState(), formal = backend.formal;
  const { settings, ready: settingsReady, error: settingsError } = useStoreSettings();
  const { signatures, ready: intakesReady, error: intakesError } = useLocalIntakes();
  const directory = useRepairDirectory(), order = directory.find(row => row.id === data.id);
  const { workflows, ready: workflowsReady, error: workflowsError } = useRepairWorkflows();
  const workflow = order ? workflows[data.id] ?? initialRepairWorkflow(order) : null;
  const requirements = order ? currentRepairRequirements(order, workflow ?? undefined) : intakeRequirements(data);
  const quoteTotal = itemQuoteTotal(data.itemQuotes, requirements.map(row => row.title));
  const quote = formal ? undefined : getRepairOrder(data.id)?.quote;
  const totalCents = data.itemQuotes?.length ? quoteTotal : quote && quote.version > 0 ? Math.round(quote.total * 100) : null;
  const policy = data.policy ?? { months: settings.repairWarrantyMonths, shopName: settings.shopName, address: settings.address, phone: settings.phone };
  const signature = matchingIntakeSignature(signatures, data, policy);
  const member = backend.snapshot?.staff.members.find(row => row.id === backend.snapshot?.staff.currentId);
  const scope = formal ? backend.snapshot ? JSON.stringify([backend.snapshot.storeId, backend.snapshot.staff.currentId, member?.revision, member?.permissions, member?.accountStatus, member?.membershipStatus, member?.role]) : null : "local";
  const [openedScope, setOpenedScope] = useState<string | null>(scope);
  if (openedScope === null && scope !== null) setOpenedScope(scope);
  const privateUnavailable = formal && (!backend.active || !scope || scope !== openedScope);
  const unavailable = privateUnavailable || !settingsReady || !!settingsError || !intakesReady || !!intakesError || !workflowsReady || !!workflowsError;
  const [paper, setPaper] = useState<ReceiptPaper>(settings.paper), [language, setLanguage] = useState<PrintLanguage>("it"), [zoom, setZoom] = useState("fit");
  const [attempt, setAttempt] = useState(0), [qrState, setQrState] = useState<{key:string;qr:QrData|null;error:boolean} | null>(null), [fontEpoch, setFontEpoch] = useState(0), [printing, setPrinting] = useState(false), [printError, setPrintError] = useState(false);
  const qrKey = JSON.stringify([data.id, attempt]);
  const qr = qrState?.key === qrKey ? qrState.qr : null, qrError = qrState?.key === qrKey ? qrState.error : false;
  const [previewZoom, setPreviewZoom] = useState(1), [fontPending, setFontPending] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null), measureHost = useRef<HTMLDivElement>(null), viewer = useRef<HTMLDivElement>(null), blockedTitle = useRef<HTMLHeadingElement>(null), blockedMessage = useRef<HTMLParagraphElement>(null);
  const fontDirty = useRef(false);
  const mounted = useRef(false), printLock = useRef(false), frame = useRef<number | null>(null), generation = useRef(0);
  const title = useId();
  const t = (key: PrintLabel) => printLabel(key, language);
  const geometry = receiptPaperGeometry(paper);
  const projectionInput = canonicalPrintJson({ data, requirements, policy, signature, hasHistory: signatures.some(row => row.orderId === data.id), language, totalCents, technician: order?.technician && order.technician !== "未分配" ? order.technician : t("unassigned"), status: workflow?.status ?? order?.status ?? "diagnosis", custody: workflow?.custody ?? data.custody ?? "unknown", formal, qr });
  const projection = useMemo(() => repairPrintProjection(JSON.parse(projectionInput)), [projectionInput]);
  const key = JSON.stringify([projection.serialized, paper, scope, unavailable, fontEpoch, qrError]);
  const [fit, setFit] = useState<Fit>({ key: "", generation: 0, phase: "measuring", reason: "printMeasuring", heightMm: 0, widthMm: 0 });
  const phase = fit.key === key ? fit.phase : unavailable ? "unavailable" : "measuring";
  const liveInput = useMemo(() => ({ key, paper, language, unavailable, qr, qrError, projection }), [key, paper, language, unavailable, qr, qrError, projection]);
  const runtime = useRef<(typeof liveInput & {generation:number}) | null>(null);
  const measureNow = useCallback((commit = true): Fit => {
    const live = runtime.current;
    if (!live) return {key:"",generation:0,phase:"measuring",reason:"printMeasuring",heightMm:0,widthMm:0};
    const result: Fit = { key: live.key, generation: live.generation, phase: "measuring", reason: "printMeasuring", heightMm: 0, widthMm: 0 };
    const content = measureHost.current?.querySelector<HTMLElement>("[data-master-content]");
    const fonts = fontReadiness();
    if (live.unavailable) { result.phase = "unavailable"; result.reason = "receiptUnavailable"; }
    else if (fontDirty.current) { result.phase = "measuring"; }
    else if (live.qrError) { result.phase = "error"; result.reason = "qrError"; }
    else if (fonts === "error") { result.phase = "error"; result.reason = "printFontError"; }
    else if (fonts === "loaded" && live.qr && content && measureHost.current?.dataset.generation === String(live.generation)) {
      const bounds = masterBounds(content);
      const smallContent = measureHost.current?.querySelector<HTMLElement>("[data-small-probe] [data-master-content]");
      const small = smallContent ? masterBounds(smallContent, receiptSmallScale) : null;
      result.heightMm = bounds.heightMm; result.smallHeightMm = small?.heightMm; result.widthMm = Math.max(bounds.widthMm, small?.widthMm ?? Infinity);
      const bodyElement = smallContent?.querySelector<HTMLElement>("." + styles.terms);
      const coreElement = smallContent?.querySelector<HTMLElement>("." + styles.core);
      const smallQr = smallContent?.querySelector<SVGElement>("." + styles.qr);
      const physicalBodyPt = bodyElement ? parseFloat(getComputedStyle(bodyElement).fontSize) * .75 * receiptSmallScale : 0;
      const physicalCorePt = coreElement ? parseFloat(getComputedStyle(coreElement).fontSize) * .75 * receiptSmallScale : 0;
      const qrMm = smallQr ? smallQr.getBoundingClientRect().width * 25.4 / 96 : 0;
      const clipped = [...content.querySelectorAll("*")].some(element => { const style = getComputedStyle(element); return element instanceof HTMLElement && (/hidden|clip/.test(style.overflowX + style.overflowY) || style.textOverflow === "ellipsis"); });
      if (!Number.isFinite(result.heightMm) || bounds.width <= 0 || !small || small.width <= 0 || clipped || physicalBodyPt < 10 || physicalCorePt < 11.1 || qrMm < 20) { result.phase = "error"; result.reason = "printLayoutError"; }
      else if (result.heightMm + receiptMaster.reserveMm > receiptMaster.innerHeightMm || (small?.heightMm ?? Infinity) + receiptMaster.reserveMm > receiptMaster.innerHeightMm || result.widthMm > receiptMaster.innerWidthMm + .01 || bounds.horizontalOverflow || small?.horizontalOverflow || [...content.querySelectorAll<HTMLElement>("[data-fold]")].some(panel => masterBounds(panel).horizontalOverflow) || [...smallContent!.querySelectorAll<HTMLElement>("[data-fold]")].some(panel => masterBounds(panel, receiptSmallScale).horizontalOverflow)) { result.phase = "overflow"; result.reason = "printOverflow"; }
      else { result.phase = "fit"; }
    }
    if (dialog.current) dialog.current.dataset.printAllowed = String(result.phase === "fit");
    if (blockedTitle.current) blockedTitle.current.textContent = printLabel("printBlocked", live.language);
    if (blockedMessage.current) blockedMessage.current.textContent = printLabel(result.reason, live.language);
    if (commit && mounted.current && runtime.current?.key === live.key) setFit(previous => JSON.stringify(previous) === JSON.stringify(result) ? previous : result);
    return result;
  }, []);
  const schedule = useCallback(() => { if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = requestAnimationFrame(() => { frame.current = null; if (mounted.current) measureNow(); }); }, [measureNow]);
  useActivityFeedback((!qr && !qrError) || fontPending, { kind: "read", scope: "receipt-layout" });
  useLayoutEffect(() => {
    mounted.current = true; const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null; const current = dialog.current; current?.showModal();
    const before = () => { printLock.current = true; setPrinting(true); measureNow(); }, after = () => { printLock.current = false; if (mounted.current) setPrinting(false); };
    window.addEventListener("beforeprint", before); window.addEventListener("afterprint", after);
    return () => { mounted.current = false; if (frame.current !== null) cancelAnimationFrame(frame.current); window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); current?.close(); if (previous?.isConnected) previous.focus(); };
  }, [measureNow]);
  useEffect(() => {
    let active = true;
    import("@zxing/library").then(({ MultiFormatWriter, BarcodeFormat }) => {
      const matrix = new MultiFormatWriter().encode(new URL("/app/repairs/" + data.id, window.location.origin).href, BarcodeFormat.QR_CODE, 0, 0, new Map()); let path = "";
      for (let y = 0; y < matrix.getHeight(); y++) for (let x = 0; x < matrix.getWidth(); x++) if (matrix.get(x, y)) path += "M" + x + " " + y + "h1v1h-1z";
      if (active) setQrState({ key:qrKey, qr:{ path, size: matrix.getWidth() }, error:false });
    }).catch(() => { if (active) setQrState({ key:qrKey, qr:null, error:true }); }); return () => { active = false; };
  }, [data.id, qrKey]);
  useEffect(() => {
    let active = true;
    const changed = () => { if (!active) return; fontDirty.current = true; if (dialog.current) dialog.current.dataset.printAllowed = "false"; setFontPending(fontReadiness() === "loading"); setFontEpoch(value => value + 1); };
    document.fonts.addEventListener("loading", changed); document.fonts.addEventListener("loadingdone", changed); document.fonts.addEventListener("loadingerror", changed);
    document.fonts.ready.then(changed); return () => { active = false; document.fonts.removeEventListener("loading", changed); document.fonts.removeEventListener("loadingdone", changed); document.fonts.removeEventListener("loadingerror", changed); };
  }, []);
  useLayoutEffect(() => {
    generation.current += 1;
    runtime.current = { ...liveInput, generation: generation.current };
    fontDirty.current = false;
    if (measureHost.current) measureHost.current.dataset.generation = String(generation.current);
    if (dialog.current) dialog.current.dataset.printAllowed = "false";
    const content = measureHost.current?.querySelector("[data-master-content]"); const observer = new ResizeObserver(() => schedule()); if (content) observer.observe(content);
    schedule(); return () => { observer.disconnect(); if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; } };
  }, [liveInput, schedule]);
  useLayoutEffect(() => {
    const current = viewer.current; if (!current) return;
    const resize = () => setPreviewZoom(zoom === "1" ? 1 : Math.min(1, Math.max(0.05, (current.clientWidth - 32) / (geometry.widthMm * 96 / 25.4))));
    const observer = new ResizeObserver(resize); observer.observe(current); return () => observer.disconnect();
  }, [geometry.widthMm, zoom, privateUnavailable]);
  const retry = () => { setFontPending(fontReadiness() === "loading"); setFontEpoch(value => value + 1); schedule(); };
  const print = () => { if (printLock.current) return; setPrintError(false); const checked = measureNow(); if (checked.phase !== "fit") return; printLock.current = true; setPrinting(true); try { window.print(); } catch { printLock.current = false; setPrinting(false); setPrintError(true); } };
  const currentFit = fit.key === key ? fit : null;
  const previewHeight = phase === "fit" ? geometry.heightMm : Math.max(geometry.heightMm, ((currentFit?.heightMm || 194) + 16) * geometry.slots[0].scale);
  const paperStyle = css({ "--paper-width": geometry.widthMm + "mm", "--paper-height": geometry.heightMm + "mm", "--preview-height": previewHeight + "mm", "--preview-zoom": previewZoom });
  const slots = phase === "fit" ? geometry.slots : geometry.slots.slice(0, 1);
  const reason = currentFit?.reason ?? (unavailable ? "receiptUnavailable" : "printMeasuring");
  return createPortal(<dialog ref={dialog} className={"intake-receipt-dialog " + styles.root} aria-labelledby={title} data-print-allowed="false" data-fit-phase={phase} data-fit-generation={fit.key === key ? fit.generation : undefined} data-natural-height-mm={fit.key === key ? fit.heightMm : undefined} data-small-height-mm={fit.key === key ? fit.smallHeightMm : undefined} data-projection-hash={projection.canonicalProjectionHash} onCancel={event => { event.preventDefault(); onClose(); }}>
    <style media="print">{"@page{size:" + geometry.widthMm + "mm " + geometry.heightMm + "mm;margin:0}"}</style>
    <header className="intake-receipt-toolbar"><h2 id={title}>{t("repairPreview")}</h2><button type="button" className="icon-button" aria-label={t("close")} onClick={onClose}><X size={20} /></button></header>
    <div className={"intake-receipt-toolbar intake-receipt-options " + styles.options}><label className="field"><span>{t("paper")}</span><SelectControl key={language} value={paper} aria-label={t("paper")} onChange={event => setPaper(event.target.value as ReceiptPaper)}>{(["a4", "a5", "half", "double"] as const).map(value => <option key={value} value={value}>{t(value)}</option>)}</SelectControl></label><label className="field"><span>{t("printLanguage")}</span><SelectControl value={language} aria-label={t("printLanguage")} onChange={event => setLanguage(event.target.value as PrintLanguage)}>{printLanguages.map(row => <option key={row.value} value={row.value}>{row.label}</option>)}</SelectControl></label><label className="field"><span>{t("previewZoom")}</span><SelectControl key={language} value={zoom} aria-label={t("previewZoom")} onChange={event => setZoom(event.target.value)}><option value="fit">{t("fitScreen")}</option><option value="1">100%</option></SelectControl></label><button type="button" className="button button--primary" disabled={phase !== "fit" || printing} onClick={print}><Printer size={17} />{t("print")}</button>{phase !== "fit" ? <p className={styles.feedback + (phase === "error" || phase === "overflow" || phase === "unavailable" ? " form-error" : "")} role={phase === "measuring" ? "status" : "alert"}>{t(reason)}{phase === "error" ? <button type="button" className="button button--secondary" onClick={qrError ? () => setAttempt(value => value + 1) : retry}><RotateCcw size={17} />{t(qrError ? "qrRetry" : "printCheckRetry")}</button> : null}</p> : null}{printError ? <p className={styles.feedback + " form-error"} role="alert">{t("printWindowError")}</p> : null}</div>
    <ContentProgress scope="receipt-layout" />
    <div ref={measureHost} className={styles.measure} aria-hidden="true" inert>{!privateUnavailable ? <><MasterContent projection={projection} copy="customerCopy" /><div className={styles.scaleProbe} data-small-probe><MasterContent projection={projection} copy="customerCopy" /></div></> : null}</div>
    {!privateUnavailable ? <div ref={viewer} className={styles.viewer}><div className={styles.viewport} style={paperStyle}><div className={styles.paper} data-complete-preview={phase !== "fit"}>{slots.map(slot => <div key={slot.copy} className={styles.slot} style={css({ "--slot-x": slot.xMm + "mm", "--slot-y": slot.yMm + "mm", "--slot-width": slot.widthMm + "mm", "--slot-height": slot.heightMm + "mm", "--paper-scale": slot.scale })}><MasterContent projection={projection} copy={slot.copy} /></div>)}{paper === "double" && phase === "fit" ? <div className={styles.cut} /> : null}</div></div></div> : null}
    <section className={styles.blocked} data-print-blocked><h3 ref={blockedTitle}>{t("printBlocked")}</h3><p ref={blockedMessage}>{t(reason)}</p></section>
  </dialog>, document.body);
}
