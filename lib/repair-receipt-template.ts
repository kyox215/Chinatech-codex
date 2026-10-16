import { printLabel } from "./print-language";
import type { RepairPrintProjection } from "./repair-print-layout";

// A static, escaped template shared by the server renderer and isolated fixtures.
// No URLs, scripts or browser application state enter this document.
export const receiptDensities = ["spacious", "standard", "compact"] as const;
export type ReceiptDensity = typeof receiptDensities[number];

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
export function repairReceiptHtml(p: RepairPrintProjection, fonts: { latin: string; chinese: string; chineseBold?: string }, copy: "customerCopy" | "shopCopy" = "customerCopy", density: ReceiptDensity = "spacious") {
  const fact = (row: { key: string; label: string; value: string }) => `<p data-fact="${escape(row.key)}"><span class="fact-label">${escape(row.label)}:</span> ${escape(row.value)}</p>`;
  const section = (name: string, label: string, html: string) => `<section data-block="${name}" data-label="${escape(label)}">${html}</section>`;
  const trackingHelp = `${escape(p.labels.tracking)} · ${escape(p.labels.scan)}`;
  const textAmounts = p.rows.some(row => row.ambiguous || row.amountCents == null);
  const rows = p.rows.map(row => `<tr data-requirement-id="${escape(row.id)}"><td>${row.texts.map(escape).join(p.merged ? "<br>" : " · ")}${row.ambiguous ? `<p class="body">${escape(p.labels.projectReview)}</p>` : ""}</td><td class="${row.ambiguous || row.amountCents == null ? "amount-state" : "amount-value"}">${escape(row.amount)}</td></tr>`).join("");
  const groups: { kind: string; note: string; quotes: typeof p.reviewQuotes }[] = [];
  for (const quote of p.reviewQuotes) {
    const previous = groups.at(-1);
    if (previous?.kind === quote.associationKind) previous.quotes.push(quote);
    else groups.push({ kind: quote.associationKind, note: quote.note, quotes: [quote] });
  }
  const review = groups.map(group => `<div class="review" data-quote-association="${group.kind}"><p><b>${escape(p.labels.review)}:</b> ${escape(group.note)}</p>${group.quotes.map(q => `<p class="core">${escape(q.label)} — ${escape(q.amount)}</p>`).join("")}</div>`).join("");
  const qr = p.qr ? `<svg class="qr" viewBox="0 0 ${p.qr.size} ${p.qr.size}" shape-rendering="crispEdges" role="img" aria-label="${escape(p.labels.qr)}"><rect width="100%" height="100%" fill="white"/><path d="${escape(p.qr.path)}" fill="black"/></svg>` : "";
  const height = 800 / (p.signature?.aspectRatio ?? 800 / 240);
  const signature = p.signature ? `<svg viewBox="0 0 800 ${height}" preserveAspectRatio="xMinYMid meet" role="img" aria-label="${escape(p.labels.signature)}">${p.signature.strokes.map(stroke => `<polyline points="${stroke.map(point => `${point.x * 800},${point.y * height}`).join(" ")}" fill="none" stroke="#161616" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}</svg>` : "";
  return `<!doctype html><html lang="${p.language}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:"><title>${escape(p.orderId)}</title><style>
@font-face{font-family:ReceiptLatin;src:url(data:font/woff2;base64,${fonts.latin}) format('woff2');font-weight:200 900;font-style:normal;font-display:block}
@font-face{font-family:ReceiptChinese;src:url(data:font/ttf;base64,${fonts.chinese}) format('truetype');font-weight:400;font-style:normal;font-display:block}
@font-face{font-family:ReceiptChinese;src:url(data:font/ttf;base64,${fonts.chineseBold ?? fonts.chinese}) format('truetype');font-weight:700;font-style:normal;font-display:block}
@page{size:297mm 210mm;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:white;color:#161616}
body{font-family:ReceiptLatin,ReceiptChinese,sans-serif;font-size:14.4pt;line-height:var(--leading)}
main{--leading:1.12;--core-leading:1.10;--section-space:.8mm;--row-space:.7mm;--fact-gap:.6mm;--term-gap:1.3mm;--para-gap:1mm;position:relative;width:297mm;min-height:210mm;padding:8mm;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:4mm;align-items:start}
main[data-density=standard]{--leading:1.06;--core-leading:1.06;--section-space:.8mm;--row-space:.7mm;--fact-gap:.6mm;--term-gap:1.3mm;--para-gap:1mm}
main[data-density=compact]{--leading:1;--core-leading:1;--section-space:.4mm;--row-space:.5mm;--fact-gap:.4mm;--term-gap:.15mm;--para-gap:.25mm}
main[data-density=compact] h1{font-size:18pt;line-height:1.04}
main[data-density=compact] .shop{padding:0;border:0}
main[data-density=compact] .total{padding:0;border:0}
main[data-density=compact] .device .minor{gap:0 3mm;margin-top:0}
main[data-density=compact] .tracking{padding-top:0;margin-top:.2mm}
main[data-density=compact] .warranty-head{padding-bottom:0}
main:after{content:'';position:absolute;left:148.5mm;top:8mm;height:194mm;border-left:.15mm dashed #bbb}
article{min-width:0;line-height:var(--leading)}
p,h1,h2,h3,ol{margin:0}
p,li,td,th{overflow-wrap:anywhere}
h1{font-size:20pt;line-height:1.05;font-weight:700}
h2,.core{font-size:16pt;line-height:var(--core-leading)}
h3,.body{font-size:14.4pt;line-height:var(--leading)}
h2,h3{font-weight:700}
section{padding:var(--section-space) 0}
section:first-child{padding-top:0}
.fact-label{font-weight:400;color:#444}
.shop{padding-bottom:.6mm;border-bottom:.2mm solid #333}
.shop .brand{display:flex;gap:2mm;justify-content:space-between;align-items:baseline}
.shop h2{font-size:14.4pt;font-weight:400;line-height:var(--leading)}
.shop p{margin-top:var(--fact-gap)}
.identity{display:grid;grid-template-columns:1fr 1fr;gap:var(--fact-gap) 2mm}
.identity p:first-child{grid-column:1/-1}
.device p:first-child{font-size:16pt;line-height:var(--core-leading);font-weight:700}
.device .minor{display:flex;flex-wrap:wrap;gap:var(--fact-gap) 3mm;margin-top:var(--fact-gap)}
.device .minor p{font-size:14.4pt;font-weight:400;line-height:var(--leading)}
table{width:100%;border-collapse:collapse;table-layout:fixed}
th,td{padding:var(--row-space) 0;vertical-align:top;text-align:left;font-weight:400}
th{font-size:14.4pt;background:#f2f2f2;border-top:.15mm solid #c5c5c5;border-bottom:.15mm solid #c5c5c5;line-height:var(--leading)}
td{font-size:16pt;line-height:var(--core-leading);border-bottom:.1mm solid #ddd}
td:last-child,th:last-child{width:27mm;text-align:right;padding-left:1mm}
.amount-value{white-space:nowrap}
.amount-state{white-space:normal;overflow-wrap:normal}
.text-amounts td:last-child,.text-amounts th:last-child{width:29mm}
.review{margin-top:var(--para-gap)}
.review b{font-weight:400}
.faults p{white-space:break-spaces}
.faults p+p{margin-top:var(--fact-gap)}
.faults b{font-size:14.4pt;font-weight:400;color:#444}
.total{display:flex;justify-content:space-between;gap:2mm;font-size:16pt;line-height:var(--core-leading);font-weight:700;background:#f2f2f2;border-top:.2mm solid #888;border-bottom:.2mm solid #888;padding:var(--row-space) 0}
.service{display:grid;grid-template-columns:1fr 1fr;gap:var(--fact-gap) 2mm}
.service [data-fact=accessories],.service [data-fact=custody]{grid-column:1/-1}
.warranty-head{padding-top:0;padding-bottom:var(--fact-gap)}
.warranty-head>div{min-width:0}
.qr{display:block;width:29mm;height:29mm;float:right;margin:0 0 1.5mm 2mm}
.terms ol{padding-left:4.5mm}
.terms li{padding-left:.2mm;margin-bottom:var(--term-gap)}
.terms>p{margin-top:var(--para-gap)}
.signature{padding-top:var(--section-space)}
.signature-heading{display:flex;align-items:baseline;justify-content:space-between;gap:2mm}
.signature-heading p{margin:0}
.ink{width:100%;height:13mm;border-bottom:.15mm solid #333}
.ink svg{display:block;width:100%;height:13mm}
.signature p{margin-top:var(--fact-gap)}
.tracking{margin-top:var(--section-space);padding-top:var(--fact-gap);border-top:.15mm solid #aaa}
.tracking p+p{margin-top:var(--fact-gap)}
.scope{font-size:14.4pt;margin-top:var(--para-gap)}
</style></head><body><main data-density="${density}" data-receipt-master data-projection-hash="${p.canonicalProjectionHash}"><article data-fold="order">
${section("shop", p.labels.repairTitle, `<header class="shop"><div class="brand"><h1>${escape(p.shopName)}</h1><h2>${escape(p.labels.repairTitle)}</h2></div><p>${escape(p.shopContact)}</p><p><span class="fact-label">${escape(p.labels.orderNumber)}:</span> ${escape(p.orderId)} · ${escape(printLabel(copy, p.language))}</p></header>`)}
${section("customer", printLabel("customer", p.language), `<div class="identity">${p.identity.map(fact).join("")}</div>`)}
${section("device", printLabel("device", p.language), `<div class="device">${fact(p.device[0])}<div class="minor">${p.device.slice(1).map(fact).join("")}${p.shortFacts.map(fact).join("")}</div></div>`)}
${section("requests", p.labels.projects, `${p.rows.length ? `<table${textAmounts ? ' class="text-amounts"' : ""}><thead><tr><th>${escape(p.labels.projects)}</th><th>${escape(p.labels.amount)}</th></tr></thead><tbody>${rows}</tbody></table>` : `<p>${escape(p.labels.projects)}: ${escape(p.labels.evaluate)}</p>`}${review}${!p.merged ? `<div class="review"><h3>${escape(p.labels.intake)}</h3>${(p.intakeServices.length ? p.intakeServices : [p.labels.evaluate]).map(t => `<p class="core">${escape(t)}</p>`).join("")}</div>` : ""}<p class="scope">${escape(p.scope)}</p>`)}
${section("faults", p.labels.fault, `<div class="faults core"><p><b>${escape(p.labels.fault)}:</b> ${escape(p.issue.faults.join("; ") || "—")}</p>${p.issue.note ? `<p><b>${escape(p.labels.note)}:</b> ${escape(p.issue.note)}</p>` : ""}</div>`)}
${section("amount", p.labels.total, `<p class="total"><span>${escape(p.labels.total)}</span><span>${escape(p.total)}</span></p>`)}
${section("service", printLabel("receiptCustody", p.language), `<div class="service">${p.serviceFacts.map(fact).join("")}</div>${p.local ? `<p>${escape(p.local)}</p>` : ""}`)}
<div class="tracking" data-block="tracking" data-label="${escape(p.labels.tracking)}">${density === "compact" ? "" : `<p data-tracking-help>${trackingHelp}</p>`}<p>${escape(p.labels.trackingLimit)} · ${escape(p.labels.keepReceipt)}</p></div>
</article><article data-fold="warranty">${qr}
${section("warranty-header", p.warrantyTitle, `<header class="warranty-head"><div><h2>${escape(p.warrantyTitle)}</h2>${density === "compact" ? `<p data-tracking-help>${trackingHelp}</p>` : ""}</div></header>`)}
${section("terms", p.warrantyTitle, `<div class="terms"><ol>${p.terms.map(t => `<li>${escape(t)}</li>`).join("")}</ol><p>${escape(p.rights)}</p><p>${escape(p.acknowledgement)}</p></div>`)}
${section("signature", p.labels.signature, `<div class="signature"><div class="signature-heading"><h3>${escape(p.labels.signature)}</h3><p>${escape(p.termsVersion)}</p></div><div class="ink">${signature}</div>${p.signature ? `<p>${escape(p.signature.label)}</p>` : p.signatureHistory ? `<p>${escape(p.signatureHistory)}</p>` : ""}</div>`)}
</article></main></body></html>`;
}
