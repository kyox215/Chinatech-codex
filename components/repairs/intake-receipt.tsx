"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X, RotateCcw } from "lucide-react";
import { useLocalIntakes, useRepairDirectory } from "./local-intake-store";
import { useRepairWorkflows } from "./repair-workflow-store";
import { initialRepairWorkflow } from "@/lib/repair-workflow";
import { useBackendMode } from "@/components/backend-snapshot";
import { intakeRequirements, currentRepairRequirements } from "@/lib/repair-requirements";
import { repairRequirementRequest } from "@/lib/repair-requirement-display";
import { repairDetailProjects } from "@/lib/repair-detail-view";
import { itemQuoteTotal } from "@/lib/repair-item-pricing";
import { getRepairOrder } from "@/lib/repair-fixtures";
import { useStoreSettings } from "@/components/settings/settings-store";
import { SelectControl } from "@/components/select-control";
import { matchingIntakeSignature, type IntakeReceiptData } from "@/lib/repair-intake-record";
import { printAccessories, printCustody, printDate, printIssue, printKnownOrOriginal, printLabel, printLanguageName, printLanguages, printMoney, printMonths, printRepairStage, printServiceRequests, type PrintLabel, type PrintLanguage } from "@/lib/print-language";
import { repairIntakeAcknowledgement, repairIntakeStatutoryRights, repairIntakeTerms, repairIntakeTermsVersion } from "@/lib/repair-print-terms";
import { SignatureImage } from "./intake-signature";
import styles from "./intake-receipt.module.css";
export type { IntakeReceiptData } from "@/lib/repair-intake-record";

const formats = { a5: "A5 landscape", a4: "A4 landscape", half: "A4 portrait", double: "A4 portrait" } as const;
type QrData = { path: string; size: number };
export function IntakeReceipt({ data, onClose }: { data: IntakeReceiptData; onClose: () => void }) {
  const formal = useBackendMode();
  const { settings, ready: settingsReady, error: settingsError } = useStoreSettings();
  const { signatures, ready: intakesReady, error: intakesError } = useLocalIntakes();
  const unavailable = !settingsReady || !!settingsError || !intakesReady || !!intakesError;
  const directory = useRepairDirectory();
  const order = directory.find(order => order.id === data.id);
  const { workflows } = useRepairWorkflows();
  const workflow = order ? workflows[data.id] ?? initialRepairWorkflow(order) : null;
  const intakeSourceRequirements = intakeRequirements(data);
  const requirements = order ? currentRepairRequirements(order, workflow ?? undefined) : intakeSourceRequirements;
  const projects = repairDetailProjects(data, requirements, []);
  const reviewQuotes = (data.itemQuotes ?? []).filter(quote => projects.unmatchedQuotes.includes(quote) || projects.rows.some(row => row.ambiguous && row.title === quote.item));
  const quoteTotal = itemQuoteTotal(data.itemQuotes, requirements.map(row => row.title));
  const quote = formal ? undefined : getRepairOrder(data.id)?.quote;
  const policy = data.policy ?? { months: settings.repairWarrantyMonths, shopName: settings.shopName, address: settings.address, phone: settings.phone };
  const signature = matchingIntakeSignature(signatures, data, policy);
  const hasHistory = signatures.some(item => item.orderId === data.id);
  const dialog = useRef<HTMLDialogElement>(null);
  const sheets = useRef<HTMLDivElement>(null);
  const title = useId();
  const [format, setFormat] = useState<keyof typeof formats>(settings.paper);
  const [language, setLanguage] = useState<PrintLanguage>("it");
  const [qr, setQr] = useState<QrData | null>(null);
  const [qrError, setQrError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const t = (key: PrintLabel) => printLabel(key, language);
  const fact = (key: PrintLabel, value: string) => <div key={key}><dt>{t(key)}:</dt><dd>{value}</dd></div>;
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const current = dialog.current; current?.showModal();
    return () => { current?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    let active = true;
    import("@zxing/library").then(({ MultiFormatWriter, BarcodeFormat }) => {
      const payload = new URL("/app/repairs/" + data.id, window.location.origin).href;
      const matrix = new MultiFormatWriter().encode(payload, BarcodeFormat.QR_CODE, 0, 0, new Map());
      let path = "";
      for (let y = 0; y < matrix.getHeight(); y++) for (let x = 0; x < matrix.getWidth(); x++) if (matrix.get(x, y)) path += "M" + x + " " + y + "h1v1h-1z";
      if (active) { setQr({ path, size: matrix.getWidth() }); setQrError(false); }
    }).catch(() => { if (active) setQrError(true); });
    return () => { active = false; };
  }, [data.id, attempt]);
  useEffect(() => {
    const container = sheets.current;
    if (!container || format !== "double") return;
    const printMedia = window.matchMedia("print");
    // Two short, complete copies may share A4. Longer copies each start a page
    // and remain free to continue; no content is scaled or clipped to a half.
    const measure = () => {
      const paired = String(printMedia.matches && [...container.children].every(copy => (copy.firstElementChild?.getBoundingClientRect().height ?? Infinity) <= 132 * 96 / 25.4));
      if (container.dataset.paired !== paired) container.dataset.paired = paired;
    };
    const observer = new ResizeObserver(measure);
    [...container.children].forEach(copy => { if (copy.firstElementChild) observer.observe(copy.firstElementChild); });
    measure();
    document.fonts.ready.then(() => { if (container.isConnected) measure(); });
    window.addEventListener("beforeprint", measure);
    printMedia.addEventListener("change", measure);
    return () => { observer.disconnect(); window.removeEventListener("beforeprint", measure); printMedia.removeEventListener("change", measure); };
  }, [format, language, data]);
  const copies: PrintLabel[] = format === "double" ? ["customerCopy", "shopCopy"] : ["customerCopy"];
  const requests = printServiceRequests(data.services, language);
  const currentRequest = (row: typeof projects.rows[number]) => repairRequirementRequest(row.requirement, intakeSourceRequirements, source => {
    const label = printKnownOrOriginal(source.title, language);
    const details = requests.filter(request => request.startsWith(label + " · ") || (source.id === "intake:电池" && request.startsWith("Apple · " + label + " · ")));
    return details.length ? details.map(request => request.startsWith(label + " · ") ? request.slice(label.length + 3) : request).join("; ") : source.request;
  });
  const issue = printIssue(data, language);

  const contact = policy.phone ? `${t("contact")}: ${policy.phone}` : "";
  return createPortal(<dialog ref={dialog} className={"intake-receipt-dialog " + styles.dialog} aria-labelledby={title} onCancel={event => { event.preventDefault(); onClose(); }}>
    <style media="print">{"@page { size: " + formats[format] + "; margin: " + (format === "half" ? "8mm 8mm 156.5mm 8mm" : "8mm") + "; @bottom-right { content: counter(page) ' / ' counter(pages); font: 10.1pt sans-serif; color: #161616; " + (format === "half" ? "vertical-align: top; padding-top: 1mm;" : "") + " } }"}</style>
    <header className="intake-receipt-toolbar"><h2 id={title}>{t("repairPreview")}</h2><button type="button" className="icon-button" aria-label={t("close")} onClick={onClose}><X size={20} /></button></header>
    <div className="intake-receipt-toolbar intake-receipt-options">
      <label className="field"><span>{t("paper")}</span><SelectControl key={language} value={format} aria-label={t("paper")} onChange={event => setFormat(event.target.value as keyof typeof formats)}>{Object.keys(formats).map(value => <option key={value} value={value}>{t(value as keyof typeof formats)}</option>)}</SelectControl></label>
      <label className="field"><span>{t("printLanguage")}</span><SelectControl value={language} aria-label={t("printLanguage")} onChange={event => setLanguage(event.target.value as PrintLanguage)}>{printLanguages.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</SelectControl></label>
      <button type="button" className="button button--primary" disabled={!qr || unavailable} onClick={() => window.print()}><Printer size={17} />{t("print")}</button>
      {unavailable ? <span className="form-error" role="alert">{t("receiptUnavailable")}</span> : null}
      {qrError ? <span className="form-error" role="alert">{t("qrError")}<button className="icon-button" type="button" aria-label={t("qrRetry")} onClick={() => setAttempt(value => value + 1)}><RotateCcw size={17} /></button></span> : null}
      <p className={styles.continuation}>{t("longContentContinues")}</p>
    </div>
    <div ref={sheets} className={styles.sheets} data-format={format}>{copies.map(copy => <article className={"intake-receipt-sheet " + styles.copy} key={copy} lang={language} data-copy={copy}>
      <table className={styles.document} role="presentation">
        <thead className={styles.pageHeader}><tr><td colSpan={2}><div className={styles.pageIdentity}><span><b>{t("orderNumber")}:</b> {data.id} · {t("customerDocument")}</span><b>{t(copy)}</b></div></td></tr></thead>
        <tbody>
          <tr><td colSpan={2}><header className={styles.brand}><div><strong>{policy.shopName}</strong><h3>{t("repairTitle")}</h3></div><p>{[policy.address, contact].filter(Boolean).join(" · ")}</p></header></td></tr>
          <tr className={styles.columns}><td><dl className={styles.identity}>{fact("date", printDate(data.previewAt, language))}{fact("customer", data.customerName || "—")}{fact("phone", data.phone)}</dl>
          <section className={styles.block}><h4>{t("device")}</h4><dl className={styles.facts}>{fact("category", printKnownOrOriginal(data.category, language))}{fact("brand", data.brand)}<div className={styles.model}><dt>{t("model")}:</dt><dd>{data.model}</dd></div>{fact("serial", data.serial || "—")}{fact("color", printKnownOrOriginal(data.color, language, true))}</dl></section>
          <section className={"intake-receipt-block " + styles.block}><h4>{t("amounts")}</h4><dl className={styles.amounts}>{fact("total", data.itemQuotes?.length ? quoteTotal===null?t("unquoted"):printMoney(quoteTotal,language) : quote && quote.version > 0 ? printMoney(Math.round(quote.total * 100), language) : t("unquoted"))}{fact("deposit", t("unrecorded"))}{fact("balance", t("define"))}</dl></section>
          <section className={styles.block} data-print-current-projects><h4>{t("currentRepairProjects")}</h4><p>{t("currentProjectsSignatureScope")}</p>{projects.rows.length ? <table className={styles.requests}><thead><tr><th>{t("description")}</th><th>{t("amount")}</th></tr></thead><tbody>{projects.rows.map(row => <tr key={row.id} data-requirement-id={row.id} data-requirement-revision={row.requirement.revision} data-requirement-request={row.request}><td>{printKnownOrOriginal(row.title, language)}{row.request ? <><br />{currentRequest(row)}</> : null}{row.ambiguous ? <small>{t("projectAssociationReview")}</small> : null}</td><td>{row.ambiguous ? t("pending") : row.quote?.amountCents == null ? t("define") : printMoney(row.quote.amountCents, language)}</td></tr>)}</tbody></table> : <p>{t("evaluate")}</p>}</section>
          {reviewQuotes.length ? <section className={styles.block} data-print-review-quotes><h4>{t("quotesToReview")}</h4><table className={styles.requests}><thead><tr><th>{t("description")}</th><th>{t("amount")}</th></tr></thead><tbody>{reviewQuotes.map(row => <tr key={row.item}><td>{printKnownOrOriginal(row.item, language)}<small>{t(projects.unmatchedQuotes.includes(row) ? "historicalQuote" : "projectAssociationReview")}</small></td><td>{row.amountCents === null ? t("define") : printMoney(row.amountCents, language)}</td></tr>)}</tbody></table></section> : null}
          <section className={styles.block} data-print-intake-requests><h4>{t("intakeRequests")}</h4>{requests.length ? requests.map(request => <p key={request}>{request}</p>) : <p>{t("evaluate")}</p>}</section>
          <section className={styles.block}><p className={styles.issue}><b>{t("reportedFault")}:</b> {issue.faults.join("; ") || "—"}</p>{issue.note ? <p className={styles.issue}><b>{t("issueNote")}:</b> {issue.note}</p> : null}<p><b>{t("diagnosis")}:</b> {t("incomplete")}</p></section>
          <section className={styles.block}><h4>{t("service")}</h4><dl className={styles.facts}>{fact("technician", order?.technician && order.technician !== "未分配" ? order.technician : t("unassigned"))}{fact("orderType", t("repair"))}{fact("status", printRepairStage(workflow?.status ?? order?.status ?? "diagnosis", language))}{fact("custody", printCustody(workflow?.custody ?? data.custody ?? "unknown", language))}{fact("warrantyDuration", printMonths(policy.months, language))}{fact("accessories", printAccessories(data.accessories, language))}{fact("priority", printKnownOrOriginal(data.priority, language))}</dl>{!formal ? <small className={styles.local}>{t("local")}</small> : null}</section>
          </td><td><section className={styles.terms}><h3>{t("repairWarrantyTitle")}</h3><h4>{t("warrantyTerms")} · {printMonths(policy.months, language)}</h4><ul>{repairIntakeTerms[language].map((term, index) => <li key={index}>{term}</li>)}</ul><p>{repairIntakeStatutoryRights[language]}</p></section>
          <section className={styles.signature}><div className={styles.signatureTop}><div className={styles.signatureDetails}><h4>{t("customerSignature")}</h4>{signature ? <><div className={styles.signatureImage}><SignatureImage strokes={signature.strokes} aspectRatio={signature.aspectRatio} label={t("customerSignature")} /></div><small>{t("signatureLanguage")}: {printLanguageName(signature.language, language)} · {t("signedAt")}: {printDate(signature.signedAt, language)}</small></> : <><div className={styles.signatureImage} />{hasHistory ? <p>{t("historicalSignature")}</p> : null}</>}</div><section className={styles.tracking}>{qr ? <svg role="img" aria-label={t("qr") + " " + data.id} viewBox={"0 0 " + qr.size + " " + qr.size} className={styles.qr} shapeRendering="crispEdges"><rect width={qr.size} height={qr.size} fill="white" /><path d={qr.path} fill="black" /></svg> : <span className={styles.qr} role="status">{t("qrLoading")}</span>}</section></div><div className={styles.trackingInfo}><p><b>{t("trackingTitle")}</b> · {t("scan")} · {data.id}</p><small>{t("trackingLimit")}</small></div><p>{repairIntakeAcknowledgement[language]}</p><small>{signature?.termsVersion ?? repairIntakeTermsVersion}</small><p>{t("keepReceipt")}</p></section></td></tr>
        </tbody>
      </table>
    </article>)}</div>
  </dialog>, document.body);
}
