"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X, RotateCcw } from "lucide-react";
import { useLocalIntakes, useRepairDirectory } from "./local-intake-store";
import { useRepairWorkflows } from "./repair-workflow-store";
import { initialRepairWorkflow } from "@/lib/repair-workflow";
import { getRepairOrder } from "@/lib/repair-fixtures";
import { useStoreSettings } from "@/components/settings/settings-store";
import { SelectControl } from "@/components/select-control";
import { matchingIntakeSignature, type IntakeReceiptData } from "@/lib/repair-intake-record";
import { printAccessories, printCustody, printDate, printIssue, printKnownOrOriginal, printLabel, printLanguageName, printLanguages, printMoney, printMonths, printRepairStage, printServiceRequests, type PrintLabel, type PrintLanguage } from "@/lib/print-language";
import { repairIntakeAcknowledgement, repairIntakeStatutoryRights, repairIntakeTerms, repairIntakeTermsVersion } from "@/lib/repair-print-terms";
import { SignatureImage } from "./intake-signature";
export type { IntakeReceiptData } from "@/lib/repair-intake-record";

const formats = { a5: "A5 landscape", a4: "A4 landscape", half: "A4 portrait", double: "A4 portrait" } as const;
type QrData = { path: string; size: number };
export function IntakeReceipt({ data, onClose }: { data: IntakeReceiptData; onClose: () => void }) {
  const { settings, ready: settingsReady, error: settingsError } = useStoreSettings();
  const { signatures, ready: intakesReady, error: intakesError } = useLocalIntakes();
  const unavailable = !settingsReady || !!settingsError || !intakesReady || !!intakesError;
  const directory = useRepairDirectory();
  const order = directory.find(order => order.id === data.id);
  const { workflows } = useRepairWorkflows();
  const workflow = order ? workflows[data.id] ?? initialRepairWorkflow(order) : null;
  const quote = getRepairOrder(data.id)?.quote;
  const policy = data.policy ?? { months: settings.repairWarrantyMonths, shopName: settings.shopName, address: settings.address, phone: settings.phone };
  const signature = matchingIntakeSignature(signatures, data, policy);
  const hasHistory = signatures.some(item => item.orderId === data.id);
  const dialog = useRef<HTMLDialogElement>(null);
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
  const copies: PrintLabel[] = format === "double" ? ["customerCopy", "shopCopy"] : ["customerCopy"];
  const requests = printServiceRequests(data.services, language);
  const issue = printIssue(data, language);
  const contact = policy.phone ? `${t("contact")}: ${policy.phone}` : "";
  return createPortal(<dialog ref={dialog} className="intake-receipt-dialog" aria-labelledby={title} onCancel={event => { event.preventDefault(); onClose(); }}>
    <style media="print">{"@page { size: " + formats[format] + "; margin: 8mm; }"}</style>
    <header className="intake-receipt-toolbar"><h2 id={title}>{t("repairPreview")}</h2><button type="button" className="icon-button" aria-label={t("close")} onClick={onClose}><X size={20} /></button></header>
    <div className="intake-receipt-toolbar intake-receipt-options">
      <label className="field"><span>{t("paper")}</span><SelectControl key={language} value={format} aria-label={t("paper")} onChange={event => setFormat(event.target.value as keyof typeof formats)}>{Object.keys(formats).map(value => <option key={value} value={value}>{t(value as keyof typeof formats)}</option>)}</SelectControl></label>
      <label className="field"><span>{t("printLanguage")}</span><SelectControl value={language} aria-label={t("printLanguage")} onChange={event => setLanguage(event.target.value as PrintLanguage)}>{printLanguages.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</SelectControl></label>
      <button type="button" className="button button--primary" disabled={!qr || unavailable} onClick={() => window.print()}><Printer size={17} />{t("print")}</button>
      {unavailable ? <span className="form-error" role="alert">{t("receiptUnavailable")}</span> : null}
      {qrError ? <span className="form-error" role="alert">{t("qrError")}<button className="icon-button" type="button" aria-label={t("qrRetry")} onClick={() => setAttempt(value => value + 1)}><RotateCcw size={17} /></button></span> : null}
    </div>
    <div className={"intake-receipt-sheets intake-receipt-sheets--" + format}>{copies.map(copy => <article className="intake-receipt-sheet" key={copy} lang={language}>
      <section className="intake-receipt-order">
        <header className="intake-receipt-brand"><strong>{policy.shopName}</strong><p>{[policy.address, contact].filter(Boolean).join(" · ")}</p><h3>{t("repairTitle")}</h3><small>{t("customerDocument")} · {t(copy)}</small></header>
        <dl className="intake-receipt-identity">{fact("orderNumber", data.id)}{fact("date", printDate(data.previewAt, language))}{fact("customer", data.customerName || "—")}{fact("phone", data.phone)}</dl>
        <section className="intake-receipt-block"><h4>{t("device")}</h4><dl>{fact("category", printKnownOrOriginal(data.category, language))}{fact("brand", data.brand)}{fact("model", data.model)}{fact("serial", data.serial || "—")}{fact("color", printKnownOrOriginal(data.color, language, true))}</dl></section>
        <section className="intake-receipt-block"><h4>{t("requested")}</h4><table><thead><tr><th>{t("description")}</th><th>{t("amount")}</th></tr></thead><tbody>{(requests.length ? requests : [t("evaluate")]).map(request => <tr key={request}><td>{request}</td><td>{t("define")}</td></tr>)}</tbody></table><p><b>{t("reportedFault")}:</b> {issue.faults.join("; ") || "—"}</p>{issue.note ? <p><b>{t("issueNote")}:</b> {issue.note}</p> : null}<p><b>{t("diagnosis")}:</b> {t("incomplete")}</p></section>
        <section className="intake-receipt-block"><h4>{t("amounts")}</h4><dl>{fact("total", quote && quote.version > 0 ? printMoney(Math.round(quote.total * 100), language) : t("unquoted"))}{fact("deposit", t("unrecorded"))}{fact("balance", t("define"))}</dl></section>
        <section className="intake-receipt-block"><h4>{t("service")}</h4><dl>{fact("technician", order?.technician && order.technician !== "未分配" ? order.technician : t("unassigned"))}{fact("orderType", t("repair"))}{fact("status", printRepairStage(workflow?.status ?? order?.status ?? "diagnosis", language))}{fact("custody", printCustody(workflow?.custody ?? data.custody ?? "unknown", language))}{fact("warrantyDuration", printMonths(policy.months, language))}{fact("accessories", printAccessories(data.accessories, language))}{fact("priority", printKnownOrOriginal(data.priority, language))}</dl></section>
        <small className="intake-receipt-local">{t("local")}</small>
      </section>
      <section className="intake-receipt-warranty">
        <header className="intake-receipt-brand"><h3>{t("repairWarrantyTitle")}</h3><p>{policy.shopName}<br />{policy.address}<br />{contact}</p></header>
        <section className="intake-receipt-tracking">{qr ? <svg role="img" aria-label={t("qr") + " " + data.id} viewBox={"0 0 " + qr.size + " " + qr.size} className="intake-receipt-qr" shapeRendering="crispEdges"><rect width={qr.size} height={qr.size} fill="white" /><path d={qr.path} fill="black" /></svg> : <span className="intake-receipt-qr" role="status">{t("qrLoading")}</span>}<div><h4>{t("trackingTitle")}</h4><p>{t("scan")}</p><strong>{data.id}</strong><small>{t("trackingLimit")}</small></div></section>
        <section className="intake-receipt-terms"><h4>{t("warrantyTerms")}</h4><p><b>{printMonths(policy.months, language)}</b></p><ul>{repairIntakeTerms[language].map((term, index) => <li key={index}>{term}</li>)}</ul><p>{repairIntakeStatutoryRights[language]}</p></section>
        <section className="intake-receipt-signature"><h4>{t("customerSignature")}</h4>{signature ? <><div className="intake-receipt-signature-image"><SignatureImage strokes={signature.strokes} aspectRatio={signature.aspectRatio} label={t("customerSignature")} /></div><small>{t("signatureLanguage")}: {printLanguageName(signature.language, language)} · {t("signedAt")}: {printDate(signature.signedAt, language)}</small></> : <><div />{hasHistory ? <p>{t("historicalSignature")}</p> : null}</>}<p>{repairIntakeAcknowledgement[language]}</p><small>{signature?.termsVersion ?? repairIntakeTermsVersion}</small><p>{t("keepReceipt")}</p></section>
      </section>
    </article>)}</div>
  </dialog>, document.body);
}
