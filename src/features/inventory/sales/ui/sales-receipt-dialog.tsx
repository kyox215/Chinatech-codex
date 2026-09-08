"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { InventorySalesReceiptInput } from "../model/contracts";
import { inventorySalesReceiptOptions } from "../api/queries";
import { SalesDocumentPreview } from "../components/sales-document-preview";
import { salesCopy, type SalesCopyKey } from "./sales-copy";
import { salesErrorKey, salesReceiptDocument } from "./sales-ui-adapter";
import { SalesDialog } from "./sales-transaction-dialog";

export function SalesReceiptDialog({
  input,
  storeId,
  onClose,
}: {
  input: InventorySalesReceiptInput;
  storeId: string;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const c = (key: SalesCopyKey) => salesCopy(locale, key);
  const query = useQuery({ ...inventorySalesReceiptOptions(input, storeId), retry: false });
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState("");
  let document = null;
  let failure: SalesCopyKey | null = query.isError ? salesErrorKey(query.error) : null;
  if (query.data && !query.isError) {
    try {
      document = salesReceiptDocument(query.data, storeId);
    } catch (error) {
      failure = error instanceof Error && error.message === "historical" ? "historical" : "error";
    }
  }
  const target = query.data?.output_identity.recoveryTarget;
  async function print() {
    if (printing) return;
    setPrinting(true);
    setPrintError("");
    try {
      const latest = await query.refetch();
      if (!latest.isSuccess || !latest.data || !salesReceiptDocument(latest.data, storeId)) return;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      window.print();
    } catch {
      setPrintError(c("error"));
    } finally {
      setPrinting(false);
    }
  }
  return (
    <SalesDialog
      title={c(input.kind === "warranty" ? "warrantyDoc" : input.kind)}
      description={c("title")}
      onClose={onClose}
      pending={printing}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {query.isLoading ? (
          <p role="status">{c("loading")}</p>
        ) : document ? (
          <SalesDocumentPreview
            document={document}
            defaultLanguage={query.data?.language ?? "it"}
            onPrint={() => void print()}
            printPending={printing}
            printError={printError}
          />
        ) : (
          <div role="alert" className="space-y-3 p-3 text-sm">
            <p>
              {failure
                ? c(failure)
                : c(target === "reload_store_context" ? "conflict" : "currentIdentity")}
            </p>
            {failure !== "historical" ? (
              <>
                <Button variant="outline" onClick={() => void query.refetch()}>
                  {c("retry")}
                </Button>
                {target === "reload_store_context" ? (
                  <Button variant="outline" onClick={() => window.location.reload()}>
                    {c("refresh")}
                  </Button>
                ) : null}
                {target === "store" || target === "notifications" ? (
                  <Button asChild variant="outline">
                    <Link href={`/settings?section=${target}`}>{c("settings")}</Link>
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        )}
      </div>
      <footer className="shrink-0 border-t border-border p-2">
        <Button className="w-full min-h-11" variant="outline" disabled={printing} onClick={onClose}>
          {c("cancel")}
        </Button>
      </footer>
    </SalesDialog>
  );
}
