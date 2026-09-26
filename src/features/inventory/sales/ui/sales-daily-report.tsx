"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readInventorySalesWorkflowReport } from "@/lib/repairdesk/api";
import { useLocale } from "@/shared/i18n/locale-provider";
import { inventorySalesKeys } from "../api/query-keys";
import { salesDocumentMoney } from "../model/sales-document";
import { Fact, Field, SalesDialog } from "./sales-transaction-dialog";
import { salesCopy, salesLanguage, type SalesCopyKey } from "./sales-copy";
import { salesWorkflowCopy, type SalesWorkflowCopyKey } from "./sales-workflow-copy";
import { romeDateTime, salesErrorKey, salesRomeDateTime } from "./sales-ui-adapter";

export function SalesDailyReportButton({ storeId }: { storeId: string }) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" className="min-h-11" onClick={() => setOpen(true)}>
        {salesWorkflowCopy(locale, "report")}
      </Button>
      {open ? <SalesDailyReport storeId={storeId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function SalesDailyReport({ storeId, onClose }: { storeId: string; onClose: () => void }) {
  const { locale } = useLocale();
  const t = (key: SalesWorkflowCopyKey) => salesWorkflowCopy(locale, key);
  const c = (key: SalesCopyKey) => salesCopy(locale, key);
  const money = (value: number) => salesDocumentMoney(value, salesLanguage(locale));
  const [date, setDate] = useState(() => romeDateTime().slice(0, 10));
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: [...inventorySalesKeys.store(storeId), "workflow-report", date, offset],
    queryFn: () => readInventorySalesWorkflowReport({ business_date: date, offset, limit: 30 }),
    enabled: Boolean(date),
    retry: false,
  });
  const data = query.data;
  return (
    <SalesDialog title={t("report")} description={t("reportHelp")} onClose={onClose} workspace>
      <div className="grid min-h-0 gap-4 overflow-y-auto p-3" data-ui="sales-daily-report">
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("date")}>
            <Input
              type="date"
              aria-label={t("date")}
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setOffset(0);
              }}
            />
          </Field>
          <Button
            variant="outline"
            disabled={query.isFetching || !date}
            onClick={() => void query.refetch()}
          >
            {c("refresh")}
          </Button>
        </div>
        {query.isFetching ? <p role="status">{c("loading")}</p> : null}
        {query.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {c(salesErrorKey(query.error))}
          </p>
        ) : null}
        {data && !query.isError ? (
          <>
            {data.finance ? (
              <section className="grid gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <Fact
                    label={`${t("sales")} · ${data.finance.agreed_sale_count}`}
                    value={money(data.finance.agreed_sales_cents)}
                  />
                  <Fact
                    label={`${t("receipts")} · ${data.finance.collected_payment_count}`}
                    value={money(data.finance.collected_cents)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  {Object.entries(data.finance.collected_by_method).map(([method, amount]) => (
                    <Fact key={method} label={c(method as SalesCopyKey)} value={money(amount)} />
                  ))}
                </div>
                <p
                  className={
                    data.finance.ledger_mismatch_count
                      ? "text-sm text-destructive"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {t("ledger")} · {data.finance.ledger_mismatch_count} ·{" "}
                  {money(data.finance.ledger_difference_cents)}
                </p>
              </section>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noFinance")}</p>
            )}
            <section className="grid gap-3 border-t border-border pt-3">
              <div>
                <h3 className="text-sm font-semibold">
                  {t("pending")} · {t(data.pending.scope)}
                </h3>
                <p className="text-xs text-muted-foreground">{t("pendingHelp")}</p>
              </div>
              <dl className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {[
                  [c("awaiting_payment"), data.pending.awaiting_payment_count],
                  [c("paid_pending_pickup"), data.pending.paid_pending_pickup_count],
                  [t("missingFiscal"), data.pending.missing_fiscal_count],
                  [t("unverifiedFiscal"), data.pending.unverified_fiscal_count],
                  [t("issues"), data.pending.open_issue_count],
                  [t("overdue"), data.pending.overdue_followup_count],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg bg-muted/40 p-2 text-xs">
                    <dt>{label}</dt>
                    <dd className="mt-1 text-base font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              {!data.pending.total ? <p className="text-sm">{t("noTasks")}</p> : null}
              <div className="grid gap-2">
                {data.pending.rows.map((row) => (
                  <Link
                    key={row.sale_order_id}
                    href={`/inventory/${row.inventory_item_id}`}
                    onClick={onClose}
                    className="grid min-h-11 gap-1 rounded-lg border border-border p-3 text-xs hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <strong>
                      {row.sale_number} · {c(row.status)}
                    </strong>
                    <span>
                      {row.assignee_name ?? t("unassigned")}
                      {row.follow_up_at
                        ? ` · ${salesRomeDateTime(row.follow_up_at, salesLanguage(locale))}`
                        : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {[
                        row.missing_fiscal ? t("missingFiscal") : null,
                        row.unverified_fiscal ? t("unverifiedFiscal") : null,
                        row.open_issue_count ? `${t("issues")} ${row.open_issue_count}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Link>
                ))}
              </div>
              <nav className="flex items-center justify-between gap-2" aria-label={t("pending")}>
                <Button
                  variant="outline"
                  disabled={!offset || query.isFetching}
                  onClick={() => setOffset(Math.max(0, offset - 30))}
                >
                  {c("prev")}
                </Button>
                <span className="text-xs">
                  {data.pending.total ? offset + 1 : 0}–
                  {Math.min(offset + data.pending.rows.length, data.pending.total)} /{" "}
                  {data.pending.total}
                </span>
                <Button
                  variant="outline"
                  disabled={offset + 30 >= data.pending.total || query.isFetching}
                  onClick={() => setOffset(offset + 30)}
                >
                  {c("next")}
                </Button>
              </nav>
            </section>
          </>
        ) : null}
      </div>
      <footer className="shrink-0 border-t border-border p-3">
        <Button className="min-h-11 w-full" variant="outline" onClick={onClose}>
          {c("cancel")}
        </Button>
      </footer>
    </SalesDialog>
  );
}
