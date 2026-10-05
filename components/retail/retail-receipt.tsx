"use client";

import { isBackendClient } from "@/lib/backend/client";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { SelectControl } from "@/components/select-control";
import { useStoreSettings } from "@/components/settings/settings-store";
import { saleProductUnit, retailPaidCents, retailRefundedCents, retailWarrantyExpiry, type RetailSale, type RetailUnit } from "@/lib/retail";
import { retailStatutoryRights, retailWarrantyTerms } from "@/lib/retail-warranty-terms";
import { printDate, printKnownOrOriginal, printLabel, printLanguages, printMoney, printMonths, printRetailAccessories, printRetailSpecs, type PrintLabel, type PrintLanguage } from "@/lib/print-language";

const formats = { a5: "A5 landscape", a4: "A4 landscape", half: "A4 portrait", double: "A4 portrait" } as const;

export function RetailReceipt({ unit, sale, onClose, restoreFocusRef }: { unit: RetailUnit; sale?: RetailSale; onClose: () => void; restoreFocusRef?: RefObject<HTMLElement | null> }) {
  const { settings, ready, error } = useStoreSettings();
  const [format, setFormat] = useState(settings.paper);
  const [language, setLanguage] = useState<PrintLanguage>("it");
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const t = (key: PrintLabel) => printLabel(key, language);
  const entry = (key: PrintLabel, value: string) => <div key={key}><dt>{t(key)}:</dt><dd>{value}</dd></div>;
  const identity = (label: string, value: string) => <div key={label}><dt>{label}:</dt><dd>{value}</dd></div>;
  const duration = (months: number | null) => months === null ? t("noCommercialWarranty") : printMonths(months, language, true);
  useEffect(() => {
    const previous = restoreFocusRef?.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const current = dialog.current; current?.showModal();
    return () => { current?.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [restoreFocusRef]);
  const product = sale ? saleProductUnit(unit, sale) : unit;
  const warranty = sale?.warranty;
  const unknown = Boolean(sale && !warranty);
  const months = sale ? warranty?.months : unit.warrantyMonths;
  // Current shop details are only contact details for a reprint lacking the original warranty.
  const shop = warranty ? { name: warranty.shopName, address: warranty.address, phone: warranty.phone } : { name: settings.shopName, address: settings.address, phone: settings.phone };
  const expiry = sale?.deliveryDate && warranty ? retailWarrantyExpiry(sale.deliveryDate, warranty.months) : null;
  const copies: PrintLabel[] = format === "double" ? ["customerCopy", "shopCopy"] : ["customerCopy"];
  return createPortal(<dialog ref={dialog} className="intake-receipt-dialog" aria-labelledby={title} onCancel={event => { event.preventDefault(); onClose(); }}>
    <style media="print">{"@page { size: " + formats[format] + "; margin: 8mm; }"}</style>
    <header className="intake-receipt-toolbar"><h2 id={title}>{t(sale ? "salePreview" : "productPreview")}</h2><button type="button" className="icon-button" aria-label={t("close")} onClick={onClose}><X size={20} /></button></header>
    <div className="intake-receipt-toolbar intake-receipt-options">
      <label className="field"><span>{t("paper")}</span><SelectControl key={language} aria-label={t("paper")} value={format} onChange={event => setFormat(event.target.value as typeof format)}>{Object.keys(formats).map(key => <option key={key} value={key}>{t(key as keyof typeof formats)}</option>)}</SelectControl></label>
      <label className="field"><span>{t("printLanguage")}</span><SelectControl value={language} aria-label={t("printLanguage")} onChange={event => setLanguage(event.target.value as PrintLanguage)}>{printLanguages.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</SelectControl></label>
      <button type="button" className="button button--primary" disabled={(!ready || Boolean(error)) && !warranty} onClick={() => window.print()}><Printer size={17} />{t("print")}</button>{error && !warranty ? <span className="form-error" role="alert">{t("receiptUnavailable")}</span> : null}
    </div>
    <div className={"intake-receipt-sheets intake-receipt-sheets--" + format}>{copies.map(copy => <article className="intake-receipt-sheet" lang={language} key={copy}>
      <section className="intake-receipt-order"><header className="intake-receipt-brand"><strong>{shop.name}</strong>{unknown ? <small>{t("reprintShop")}</small> : null}<p>{shop.address}<br />{shop.phone ? t("contact") + ": " + shop.phone : ""}</p><h3>{t(sale ? "salesTitle" : "productTitle")}</h3><small>{t(copy)} · {t(sale ? "saleRecorded" : "notSale")}</small></header>
        <dl className="intake-receipt-identity">{entry("reference", product?.code || t("historicalProduct"))}{entry("registrationDate", sale ? printDate(sale.time, language) : t("notSold"))}{entry("customer", sale?.customerName || t("unrecorded"))}{entry("phone", sale?.customerPhone || t("unrecorded"))}</dl>
        <section className="intake-receipt-block"><h4>{t("product")}</h4>{product ? <dl>{entry("brandModel", [product.brand, product.model].filter(Boolean).join(" "))}{entry("productType", printKnownOrOriginal(({ phone: "手机", tablet: "平板", laptop: "笔记本", desktop: "台式电脑", console: "游戏机", other: "其他商品" })[product.category], language))}{entry("condition", printKnownOrOriginal(product.condition, language))}{entry("color", printKnownOrOriginal(product.color, language))}{entry("specs", printRetailSpecs(product, language))}{identity("SN", product.serial || t("unrecorded"))}{product.imei1 ? identity("IMEI 1", product.imei1) : null}{product.imei2 ? identity("IMEI 2", product.imei2) : null}{entry("appearanceGrade", printKnownOrOriginal(product.grade, language))}{entry("batteryHealth", product.batteryPercent === null ? t("unrecorded") : `${product.batteryPercent}%`)}{entry("accessories", printRetailAccessories(product.accessories, language))}{entry("declaredCondition", product.knownIssues || t("unrecorded"))}</dl> : <p>{t("productMissing")}</p>}{sale?.customerEmail || sale?.customerAddress ? <dl>{entry("email", sale.customerEmail || t("unrecorded"))}{entry("address", sale.customerAddress || t("unrecorded"))}</dl> : null}{sale?.customerNote ? <dl>{entry("buyerNote", sale.customerNote)}</dl> : null}</section>
        <section className="intake-receipt-block"><h4>{t("amounts")}</h4><dl>{entry(sale ? "salePrice" : "indicativePrice", printMoney(sale?.priceCents ?? unit.priceCents, language))}{entry("payment", !sale || retailPaidCents(sale) === null ? t("pending") : printMoney(retailPaidCents(sale), language))}{sale ? entry("refunds", printMoney(retailRefundedCents(sale), language)) : null}{sale?.returned ? entry("returnedProduct", printDate(sale.returned.date, language) + " · " + t("recordedText") + ": " + sale.returned.reason) : null}{entry("delivery", sale?.delivered ? sale.deliveryDate ? printDate(sale.deliveryDate, language) : t("deliveryUndated") : t("pending"))}</dl></section>
        <section className="intake-receipt-block"><h4>{t("commercialWarranty")}</h4><dl>{entry("duration", unknown || months === undefined ? t("warrantyUnknown") : duration(months))}{entry("starts", sale?.deliveryDate ? printDate(sale.deliveryDate, language) : t("actualDelivery"))}{entry("expires", expiry ? printDate(expiry, language) : unknown ? t("unrecorded") : months === null ? t("notApplicable") : t("afterDelivery"))}</dl></section>
        <small className="intake-receipt-local">{!isBackendClient() ? t("local") + " · " : ""}{t("nonFiscal")}</small>
      </section>
      <section className="intake-receipt-warranty"><header className="intake-receipt-brand"><h3>{t("saleWarrantyTitle")}</h3><p>{unknown ? t("guarantorUnknown") : <>{t("guarantor")}: {shop.name}<br />{shop.address}<br />{shop.phone}</>}</p></header>
        <section className="intake-receipt-terms"><h4>{t("statutoryRights")}</h4><p>{unknown ? t("historicalRights") : retailStatutoryRights[language]}</p><h4>{t("warrantyTerms")}</h4>{unknown ? <p>{t("historicalTerms")}</p> : <><p><b>{duration(months ?? null)}.</b></p>{months !== null ? <ul>{retailWarrantyTerms.map(term => <li key={term.title}>{term[language]}</li>)}</ul> : null}</>}</section>
        <section className="intake-receipt-signature"><h4>{t("saleSignature")}</h4><div /><p>{t("saleSignatureNote")} {warranty ? warranty.termsVersion : t(sale ? "originalTermsUnknown" : "currentTerms")}</p></section>
      </section>
    </article>)}</div>
  </dialog>, document.body);
}
