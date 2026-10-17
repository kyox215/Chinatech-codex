import { printLabel } from "./print-language";
import type { RepairPrintProjection } from "./repair-print-layout";

// A static, escaped template shared by the server renderer and isolated fixtures.
// No URLs, scripts or browser application state enter this document.
export const receiptDensities = ["spacious", "standard", "compact"] as const;
export type ReceiptDensity = typeof receiptDensities[number];

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
export function repairReceiptHtml(p: RepairPrintProjection, fonts: { latin: string; chinese: string; chineseBold?: string }, copy: "customerCopy" | "shopCopy" = "customerCopy", density: ReceiptDensity = "spacious") {
  const fact = (row: { key: string; label: string; value: string }) => `<p data-fact="${escape(row.key)}"><span class="fact-label">${escape(row.label)}:</span> <span class="fact-value">${escape(row.value)}</span></p>`;
  // Preserve field pair identity while allowing long values to continue on the next line.
  const serviceRows = Array.from({ length: Math.ceil(p.serviceFacts.length / 2) }, (_, index) => `<div class="service-row">${p.serviceFacts.slice(index * 2, index * 2 + 2).map(fact).join("")}</div>`).join("");
  const section = (name: string, label: string, html: string) => `<section data-block="${name}" data-label="${escape(label)}">${html}</section>`;
  const trackingHelp = `${escape(p.labels.tracking)} · ${escape(p.labels.scan)}`;
  const trackingOnWarranty = !p.merged && p.reviewQuotes.length > 0 && Boolean(p.signature || p.signatureHistory);
  const historicalSignatureReview = trackingOnWarranty && !p.signature && Boolean(p.signatureHistory);
  const tracking = `<div class="tracking" data-block="tracking" data-label="${escape(p.labels.tracking)}"><p data-tracking-help>${trackingHelp} ${escape(p.labels.keepReceipt)} ${escape(p.labels.trackingLimit)}</p></div>`;
  const textAmounts = p.total === printLabel("unquoted", p.language) || p.rows.some(row => row.ambiguous || row.amountCents == null);
  const rows = p.rows.map(row => `<tr data-requirement-id="${escape(row.id)}"><td>${row.texts.map(escape).join(" · ")}${row.ambiguous ? `<p class="body">${escape(p.labels.projectReview)}</p>` : ""}</td><td class="${row.ambiguous || row.amountCents == null ? "amount-state" : "amount-value"}">${escape(row.amount)}</td></tr>`).join("");
  const groups: { kind: string; note: string; quotes: typeof p.reviewQuotes }[] = [];
  for (const quote of p.reviewQuotes) {
    const previous = groups.at(-1);
    if (previous?.kind === quote.associationKind) previous.quotes.push(quote);
    else groups.push({ kind: quote.associationKind, note: quote.note, quotes: [quote] });
  }
  const review = groups.map(group => `<div class="review quote-review" data-quote-association="${group.kind}"><p><b>${escape(p.labels.review)}:</b> ${escape(group.note)}</p>${group.quotes.map(q => `<p class="core">${escape(q.label)} — ${escape(q.amount)}</p>`).join("")}</div>`).join("");
  const qr = p.qr ? `<svg class="qr" viewBox="0 0 ${p.qr.size} ${p.qr.size}" shape-rendering="crispEdges" role="img" aria-label="${escape(p.labels.qr)}"><rect width="100%" height="100%" fill="white"/><path d="${escape(p.qr.path)}" fill="black"/></svg>` : "";
  const date = p.identity.find(row => row.key === "date");
  const deviceTitle = ["brand", "model"].map(key => p.device.find(row => row.key === key)!).map(row => `<span data-fact="${escape(row.key)}">${escape(row.value)}</span>`).join(" ");
  const total = `<tr data-block="amount" data-label="${escape(p.labels.total)}" class="total"><th scope="row">${escape(p.labels.total)}</th><td class="${p.total === printLabel("unquoted", p.language) ? "amount-state" : "amount-value"}">${escape(p.total)}</td></tr>`;
  const height = 800 / (p.signature?.aspectRatio ?? 800 / 240);
  const signature = p.signature ? `<svg viewBox="0 0 800 ${height}" preserveAspectRatio="xMinYMid meet" role="img" aria-label="${escape(p.labels.signature)}">${p.signature.strokes.map(stroke => `<polyline points="${stroke.map(point => `${point.x * 800},${point.y * height}`).join(" ")}" fill="none" stroke="#161616" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}</svg>` : "";
  return `<!doctype html><html lang="${p.language}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:"><title>${escape(p.orderId)}</title><style>
@font-face{font-family:ReceiptLatin;src:url(data:font/woff2;base64,${fonts.latin}) format('woff2');font-weight:200 900;font-style:normal;font-display:block}
@font-face{font-family:ReceiptChinese;src:url(data:font/ttf;base64,${fonts.chinese}) format('truetype');font-weight:400;font-style:normal;font-display:block}
@font-face{font-family:ReceiptChinese;src:url(data:font/ttf;base64,${fonts.chineseBold ?? fonts.chinese}) format('truetype');font-weight:700;font-style:normal;font-display:block}
@page{size:297mm 210mm;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:white;color:#161616}
body{font-family:ReceiptLatin,ReceiptChinese,sans-serif;font-size:14.4pt;font-weight:350;line-height:var(--leading)}
main{--leading:1.15;--core-leading:1.12;--section-space:.65mm;--heading-gap:.7mm;--row-space:.8mm;--fact-gap:.6mm;--term-gap:1.6mm;--para-gap:2mm;--signature-space:2mm;--tracking-space:1.4mm;position:relative;width:297mm;min-height:210mm;padding:8mm;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:4mm;align-items:start}
main[data-density=standard]{--leading:1.06;--core-leading:1.06;--section-space:.2mm;--heading-gap:.3mm;--row-space:.45mm;--fact-gap:.5mm;--term-gap:.8mm;--para-gap:1mm;--signature-space:1.5mm;--tracking-space:.5mm}
main[data-density=compact]{--leading:1;--core-leading:1;--section-space:.15mm;--heading-gap:.2mm;--row-space:.3mm;--fact-gap:.25mm;--term-gap:.15mm;--para-gap:.35mm;--signature-space:.5mm;--tracking-space:.15mm}
main[data-density=compact][data-requests=separate] .customer-device,main[data-density=compact][data-requests=separate] .intake-handover{padding-top:.1mm;padding-bottom:.1mm}
main[data-density=compact][data-signature-review=side] .signature{padding-top:.25mm;padding-bottom:.25mm}
main[data-density=compact][data-signature-review=side] .signature-review{display:grid;grid-template-columns:minmax(0,1fr) 76mm;gap:.25mm 3mm;align-items:end;margin-top:.25mm}
main[data-density=compact][data-signature-review=side] .signature-history,main[data-density=compact][data-signature-review=side] .signature-date{margin:0}
main[data-density=compact][data-signature-review=side] .signature-date{grid-column:1/-1}
main:after{content:'';position:absolute;left:148.5mm;top:8mm;height:194mm;border-left:.15mm dashed #bbb}
article{min-width:0;line-height:var(--leading)}
[data-fold=warranty]{display:flex;flex-direction:column;min-height:192.5mm}
[data-fold=warranty]>[data-block=signature]{margin-top:auto}
p,h1,h2,h3,ol{margin:0}
p,li,td,th{overflow-wrap:anywhere}
h1{font-size:22pt;line-height:1.05;font-weight:700}
h2,.core{font-size:16pt;line-height:var(--core-leading)}
h3,.body{font-size:14.4pt;line-height:var(--leading)}
h2,h3{font-weight:700}
section{padding:var(--section-space) 0}
section:first-child{padding-top:0}
.section-heading{font-size:16pt;line-height:var(--core-leading);margin-bottom:var(--heading-gap)}
.fact-label{font-weight:350;color:#666}.fact-value{font-weight:350}
.shop{padding-bottom:var(--section-space)}
.receipt-heading{display:grid;grid-template-columns:minmax(0,1fr) 29mm;gap:3mm;align-items:center}
.shop .shop-name{display:flex;flex-wrap:wrap;gap:0 3mm;font-size:14.4pt;font-weight:700;margin:0 0 var(--heading-gap)}
.shop .copy-label{font-weight:350;color:#555}
.shop h1{font-size:24pt}
.shop p{margin-top:var(--fact-gap)}
.identity,.device .minor{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:var(--fact-gap) 3mm}
.identity{grid-template-columns:minmax(0,1.35fr) minmax(0,1fr)}
.service{display:grid;gap:var(--fact-gap)}
.service-row{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr);gap:3mm;align-items:baseline}
.service-row:has([data-fact=accessories]){grid-template-columns:minmax(0,3fr) minmax(0,5fr)}
.service-row p{display:block;min-width:0}
.identity p,.device .minor p{display:block}
.identity .fact-label,.device .minor .fact-label,.service .fact-label{display:inline}
.customer-device{padding:1mm 2mm;border:.15mm solid #ccc;border-radius:2mm;background:#f5f5f5}
.customer-device .identity{margin-top:var(--section-space);padding-top:var(--section-space);border-top:.15mm solid #ccc}
.device .model{font-size:20pt;line-height:var(--core-leading);font-weight:700}
.device .minor{margin-top:var(--fact-gap)}
.device .minor p{font-size:14.4pt;font-weight:350;line-height:var(--leading)}
.quote-card{border:.15mm solid #ccc;border-radius:2mm}
table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed}
th,td{padding:var(--row-space) 1.5mm;vertical-align:top;text-align:left;font-weight:350;border:0;border-bottom:.15mm solid #ccc}
thead th{font-size:14.4pt;font-weight:700;background:#f2f2f2;line-height:var(--leading)}
thead th:first-child{border-top-left-radius:2mm}
thead th:last-child{border-top-right-radius:2mm}
td{font-size:16pt;line-height:var(--core-leading)}
td:last-child,th:last-child{width:27mm;text-align:right;padding-left:1mm}
.amount-value{white-space:nowrap}
.amount-state{white-space:normal;overflow-wrap:normal}
.text-amounts td:last-child,.text-amounts th:last-child{width:36mm}
.review{margin-top:var(--para-gap)}
.review b{font-weight:350}
.quote-review p{display:inline}
.quote-review p+p:before{content:' · '}
.faults p{white-space:break-spaces}
.faults p+p{margin-top:var(--fact-gap)}
.faults b{font-size:14.4pt;font-weight:350;color:#444}
.total th,.total td{font-size:16pt;line-height:var(--core-leading);font-weight:700;background:#ededed;border-bottom:0}
.total th{border-bottom-left-radius:2mm}
.total td{border-bottom-right-radius:2mm}
.intake-handover{padding:1mm 2mm;border:.15mm solid #ccc;border-radius:2mm}
.intake-handover>section:last-child{padding-bottom:0}
.intake-handover .section-heading{padding-bottom:var(--heading-gap);border-bottom:.15mm solid #bbb}

.warranty-head{display:flex;align-items:center;gap:2mm;justify-content:space-between;padding:1mm 2mm;background:#efefef;border-radius:1.5mm}
.warranty-head h1{min-width:0;flex:1;font-size:20pt}
html[lang=en] .warranty-head h1{font-size:19pt}
html[lang=en] .warranty-period{max-width:60mm}
.warranty-period{flex:0 0 auto;width:max-content;max-width:60mm;padding:1mm 1.5mm;border:.2mm solid #888;border-radius:1mm;font-size:16pt;line-height:var(--core-leading);font-weight:700;text-align:center}
.qr{display:block;width:29mm;height:29mm;flex:none}
.terms{font-weight:300}
main:not([data-density=compact]) [data-block=terms]{--leading:1.11;--term-gap:1.4mm;--para-gap:1.5mm}
html[lang=zh] main:not([data-density=compact]) [data-block=terms]{font-weight:400;--leading:1.2;--term-gap:2.2mm;--para-gap:2.3mm}
.terms ol{padding-left:4.5mm}
.terms li{padding-left:.2mm;margin-bottom:var(--term-gap)}
.terms li::marker{font-weight:700}
.terms>p{margin-top:var(--para-gap)}
.terms .rights{padding-top:var(--para-gap);border-top:.15mm solid #aaa}
.signature{padding:var(--signature-space) 2mm .8mm;border:.15mm solid #ccc;border-radius:2mm;background:#f5f5f5}
.signature-heading{display:flex;align-items:baseline;justify-content:space-between;gap:2mm}
.signature-heading .section-heading,.signature .signature-heading p{margin:0}
.ink{width:100%;height:13mm;border-bottom:.15mm solid #333}
.ink svg{display:block;width:100%;height:13mm}
.signature p{margin-top:var(--fact-gap)}
.signature-date{display:flex;align-items:baseline;gap:3mm}
.signature-date span:last-child{display:block;width:55mm;border-bottom:.15mm solid #333}
.terms-version{text-align:right;color:#555}
.tracking{margin-top:var(--tracking-space)}
.tracking p+p{margin-top:var(--fact-gap)}
.scope{font-size:14.4pt;margin-top:var(--fact-gap)}
</style></head><body><main data-density="${density}" data-requests="${p.merged ? "merged" : "separate"}" data-signature-review="${historicalSignatureReview ? "side" : "full"}" data-receipt-master data-projection-hash="${p.canonicalProjectionHash}"><article data-fold="order">
${section("shop", p.labels.repairTitle, `<header class="shop"><div class="receipt-heading"><div><p class="shop-name"><span>${escape(p.shopName)}</span><span class="copy-label">${escape(printLabel(copy, p.language))}</span></p><h1>${escape(p.labels.repairTitle)}</h1><p><span class="fact-label">${escape(p.labels.orderNumber)}:</span> ${escape(p.orderId)}${date ? ` · <span data-fact="date">${escape(date.value)}</span>` : ""}</p></div>${qr}</div><p>${escape(p.shopContact)}</p></header>`)}
${section("customer-device", p.labels.customerDevice, `<div class="customer-device"><div class="device"><p class="model">${deviceTitle}</p><div class="minor">${["serial", "category", "color", "priority"].map(key => [...p.device, ...p.shortFacts].find(row => row.key === key)!).map(fact).join("")}</div></div><div class="identity">${p.identity.filter(row => row.key !== "date").map(fact).join("")}</div></div>`)}
${section("requests", p.labels.projects, `<div class="quote-card"><table${textAmounts ? ' class="text-amounts"' : ""}><thead><tr><th scope="col">${escape(p.labels.projects)}</th><th scope="col">${escape(p.labels.amount)}</th></tr></thead><tbody>${rows || `<tr><td colspan="2">${escape(p.labels.evaluate)}</td></tr>`}</tbody><tfoot>${total}</tfoot></table></div>${review}${!p.merged ? `<div class="review intake-requests"><h3>${escape(p.labels.intake)}</h3><p class="core">${(p.intakeServices.length ? p.intakeServices : [p.labels.evaluate]).map(escape).join(" · ")}</p></div>` : ""}<p class="scope">${escape(p.scope)}</p>`)}
${section("intake-handover", p.labels.handover, `<div class="intake-handover">${section("faults", p.labels.intakeNotes, `<h3 class="section-heading">${escape(p.labels.intakeNotes)}</h3><div class="faults core"><p><b>${escape(p.labels.fault)}:</b> ${escape(p.issue.faults.join("; ") || "—")}</p>${p.issue.note ? `<p><b>${escape(p.labels.note)}:</b> ${escape(p.issue.note)}</p>` : ""}</div>`)}${section("service", p.labels.handover, `<h3 class="section-heading">${escape(p.labels.handover)}</h3><div class="service">${serviceRows}</div>${p.local ? `<p>${escape(p.local)}</p>` : ""}`)}</div>`)}
${trackingOnWarranty ? "" : tracking}
</article><article data-fold="warranty">
${section("warranty-header", p.warrantyTitle, `<header class="warranty-head"><h1>${escape(p.labels.warrantyConfirmation)}</h1><p class="warranty-period">${escape(p.warrantyTitle)}</p></header>`)}
${section("terms", p.warrantyTitle, `<div class="terms"><ol>${p.terms.map(t => `<li>${escape(t)}</li>`).join("")}</ol><p class="rights">${escape(p.rights)}</p><p>${escape(p.acknowledgement)}</p></div>`)}
${trackingOnWarranty ? tracking : ""}
${section("signature", p.labels.signature, `<div class="signature"><div class="signature-heading"><h3 class="section-heading">${escape(p.labels.signature)}</h3><p class="terms-version">${escape(p.termsVersion)}</p></div>${historicalSignatureReview ? '<div class="signature-review">' : ""}<div class="ink">${signature}</div>${p.signature ? `<p>${escape(p.signature.label)}</p>` : `${p.signatureHistory ? `<p class="signature-history">${escape(p.signatureHistory)}</p>` : ""}<p class="signature-date"><span>${escape(printLabel("signedAt", p.language))}:</span><span></span></p>`}${historicalSignatureReview ? "</div>" : ""}</div>`)}
</article></main></body></html>`;
}
