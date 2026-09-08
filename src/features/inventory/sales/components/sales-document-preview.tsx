"use client";

import { useId, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintPortal } from "@/features/orders/components/print-portal";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import {
  salesDocumentCopy,
  salesDocumentDate,
  salesDocumentMoney,
  type SalesDocument,
  type SalesDocumentLanguage,
  type SalesDocumentPaper,
} from "../model/sales-document";

/** Stateless document body shared by on-screen preview and the existing print portal. */
export function SalesDocumentSheet({
  document,
  language = "it",
}: {
  document: SalesDocument;
  language?: SalesDocumentLanguage;
}) {
  const copy = salesDocumentCopy[language];
  const { source, payment } = document;
  const money = (value: number) => salesDocumentMoney(value, language);
  const date = (value: string) => salesDocumentDate(value, language);
  return (
    <article
      data-ui="sales-document-sheet"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      lang={language === "zh" ? "zh-CN" : language}
      className="min-w-0 space-y-3 bg-card p-4 text-foreground print:bg-white print:p-0 print:text-black"
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-2">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-bold">{source.store.storeName}</h2>
          <p className="break-words text-[10px] leading-4">{source.store.storeSummaryLine}</p>
        </div>
        <div className="text-right">
          <h1 className="text-base font-semibold">{copy[document.kind]}</h1>
          <p className="font-mono text-[10px]">
            {copy.number} · {document.number}
          </p>
        </div>
      </header>
      {source.sample ? (
        <p className="rounded border border-border bg-muted/40 px-2 py-1 text-[10px] font-semibold">
          {copy.sample}
        </p>
      ) : null}
      <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
        <DocumentFact label={copy.customer} value={source.customer.name} />
        <DocumentFact label={copy.phone} value={source.customer.phone} />
        <DocumentFact label={copy.product} value={source.product.name} />
        <DocumentFact label="SKU" value={source.product.sku} />
        <DocumentFact label={source.product.identifierLabel} value={source.product.identifier} />
        <DocumentFact label={copy.agreement} value={date(source.agreedAt)} />
      </dl>
      {source.product.specification ? (
        <p className="break-words text-[11px] text-muted-foreground print:text-black">
          {source.product.specification}
        </p>
      ) : null}
      <section className="rounded-lg border border-border">
        {payment ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
            <div>
              <p className="text-[10px]">{copy.thisPayment}</p>
              <strong className="text-xl">{money(payment.amountCents)}</strong>
            </div>
            <div className="text-right text-[10px]">
              <p>
                {copy.date} · {date(payment.occurredAt)}
              </p>
              <p>
                {copy.method} · {copy[payment.method]}
              </p>
            </div>
          </div>
        ) : null}
        {payment ? <p className="px-3 pt-2 text-[10px] font-semibold">{copy.asOf}</p> : null}
        <dl className="grid grid-cols-3 gap-2 px-3 py-2 text-xs">
          <DocumentFact label={copy.price} value={money(source.priceCents)} />
          <DocumentFact label={copy.paid} value={money(document.paidCents)} />
          <DocumentFact label={copy.balance} value={money(document.balanceCents)} />
        </dl>
      </section>
      {document.kind === "payment" ? (
        <p className="text-[11px] leading-4">{copy.paymentScope}</p>
      ) : (
        <section className="space-y-2 text-[11px] leading-4">
          <dl className="grid grid-cols-2 gap-2">
            <DocumentFact
              label={copy.delivery}
              value={source.deliveredAt ? date(source.deliveredAt) : copy.awaiting}
            />
            {source.warrantyAgreement ? (
              <DocumentFact
                label={copy.warranty}
                value={`${source.warrantyAgreement.months} ${copy.months}`}
              />
            ) : null}
            {source.coverage ? (
              <>
                <DocumentFact label={copy.starts} value={date(source.coverage.startsAt)} />
                <DocumentFact label={copy.ends} value={date(source.coverage.endsOn)} />
              </>
            ) : null}
          </dl>
          {source.warrantyAgreement.months === 12 ? <p>{copy.consent}</p> : null}
          <p>{copy.legal}</p>
          <p>{copy.coverage}</p>
        </section>
      )}
      <footer className="space-y-1 border-t border-border pt-2 text-[10px] leading-4">
        <p className="font-semibold">{copy.rights}</p>
        <p>{source.store.printFooter}</p>
      </footer>
    </article>
  );
}
function DocumentFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] text-muted-foreground print:text-black">{label}</dt>
      <dd className="break-words font-semibold">{value}</dd>
    </div>
  );
}

export function SalesDocumentPrintSheet({
  document,
  language = "it",
  paper = "a5-landscape",
}: {
  document: SalesDocument;
  language?: SalesDocumentLanguage;
  paper?: SalesDocumentPaper;
}) {
  if (!document.source.store.canOutput) return null;
  return (
    <PrintPortal paperMode={paper}>
      <section
        className="repair-print-sheet"
        aria-hidden="true"
        style={{
          width: paper === "a5-landscape" ? "210mm" : "297mm",
          padding: "8mm",
          boxSizing: "border-box",
        }}
      >
        <SalesDocumentSheet document={document} language={language} />
      </section>
    </PrintPortal>
  );
}

/** Mount/key once per document opening. A per-document language choice never changes the store default. */
export function SalesDocumentPreview({
  document,
  defaultLanguage = "it",
  onPrint,
  printError,
  printPending = false,
}: {
  document: SalesDocument;
  defaultLanguage?: SalesDocumentLanguage;
  onPrint?: () => void;
  printError?: string;
  printPending?: boolean;
}) {
  const id = useId();
  const [language, setLanguage] = useState(defaultLanguage);
  const [paper, setPaper] = useState<SalesDocumentPaper>("a5-landscape");
  const copy = salesDocumentCopy[language];
  return (
    <section data-ui="sales-document-preview" className="grid min-w-0 gap-2 print:hidden">
      <div className={cn(repairOs.mobileInfoCard, "flex flex-wrap items-end gap-2 p-2")}>
        <label className="grid min-w-0 flex-1 gap-1 text-[10px]" htmlFor={`${id}-language`}>
          {copy.language}
          <select
            id={`${id}-language`}
            className="min-h-11 rounded-lg border border-border bg-card px-2 text-base lg:text-xs"
            value={language}
            onChange={(event) => setLanguage(event.target.value as SalesDocumentLanguage)}
          >
            <option value="it">Italiano</option>
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </label>
        <label className="grid min-w-0 flex-1 gap-1 text-[10px]" htmlFor={`${id}-paper`}>
          {copy.paper}
          <select
            id={`${id}-paper`}
            className="min-h-11 rounded-lg border border-border bg-card px-2 text-base lg:text-xs"
            value={paper}
            onChange={(event) => setPaper(event.target.value as SalesDocumentPaper)}
          >
            <option value="a5-landscape">A5 ↔</option>
            <option value="a4-landscape-full">A4 ↔</option>
          </select>
        </label>
        <Button
          type="button"
          className="min-h-11"
          disabled={printPending || !onPrint || !document.source.store.canOutput}
          onClick={onPrint}
        >
          <Printer className="size-4" aria-hidden="true" />
          {copy.print}
        </Button>
      </div>
      {printError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive"
        >
          {printError}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border shadow-sm">
        <SalesDocumentSheet document={document} language={language} />
      </div>
      {!document.source.store.canOutput ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 p-2 text-xs text-destructive"
        >
          {document.source.store.blockReason || copy.unavailable}
        </p>
      ) : null}
      {onPrint && document.source.store.canOutput ? (
        <SalesDocumentPrintSheet document={document} language={language} paper={paper} />
      ) : null}
    </section>
  );
}
