"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InventoryProductCard } from "../../products/components/inventory-product-queue-components";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { InventorySalesList, InventorySalesListInput } from "../model/contracts";
import type { InventoryProductListItem } from "@/lib/repairdesk/types";
import { salesDocumentMoney } from "../model/sales-document";
import { salesStatusKey } from "./sales-ui-adapter";
import { salesCopy, salesLanguage } from "./sales-copy";

export function salesListProduct(
  row: InventorySalesList["rows"][number],
): InventoryProductListItem {
  return {
    id: row.inventory_item_id,
    sku: row.product.sku,
    category: row.product.category as InventoryProductListItem["category"],
    brand: "",
    color: row.product.color ?? undefined,
    model: row.product.name,
    specification: [row.product.storage, row.product.ram, row.product.color]
      .filter(Boolean)
      .join(" · "),
    masked_identifier: row.product.identifier,
    status:
      row.order?.status === "delivered"
        ? "sold"
        : row.order
          ? "reserved"
          : ["sold", "reserved", "returned"].includes(row.item_status)
            ? (row.item_status as InventoryProductListItem["status"])
            : ["cancelled", "recycled"].includes(row.item_status)
              ? "removed"
              : "in_stock",
    list_price: row.order
      ? row.order.price_cents / 100
      : row.inspection.list_price_cents == null
        ? undefined
        : row.inspection.list_price_cents / 100,
    currency_code: "EUR",
    updated_at: row.item_updated_at,
  };
}
export function SalesQueueBar({
  value,
  counts,
  onChange,
}: {
  value: InventorySalesListInput["queue"];
  counts: InventorySalesList["counts"];
  onChange: (queue: InventorySalesListInput["queue"]) => void;
}) {
  const { locale } = useLocale();
  return (
    <div className="mb-2 flex gap-1 overflow-x-auto pb-1" aria-label={salesCopy(locale, "title")}>
      {(["all", "available", "awaiting_payment", "paid_pending_pickup", "delivered"] as const).map(
        (queue) => (
          <Button
            type="button"
            key={queue}
            variant={value === queue ? "default" : "outline"}
            size="sm"
            className="min-h-11 shrink-0 gap-1 px-2 text-[11px] lg:text-xs"
            aria-pressed={value === queue}
            onClick={() => onChange(queue)}
          >
            {salesCopy(locale, queue)}
            <span className="font-mono tabular-nums">{counts[queue]}</span>
          </Button>
        ),
      )}
    </div>
  );
}
export function SalesListResults({
  data,
  view,
  onPage,
}: {
  data: InventorySalesList;
  view: "list" | "shelf";
  onPage: (offset: number) => void;
}) {
  const { locale } = useLocale();
  const c = (key: Parameters<typeof salesCopy>[1]) => salesCopy(locale, key);
  const money = (amount: number) => salesDocumentMoney(amount, salesLanguage(locale));
  const status = (row: InventorySalesList["rows"][number]) => c(salesStatusKey(row));
  const hint = (row: InventorySalesList["rows"][number]) =>
    !row.stock_unit_id
      ? c("legacy")
      : !row.order && row.inspection_missing.length
        ? c("blocked")
        : row.order?.status === "delivered"
          ? ""
          : row.order
            ? c("heldNote")
            : "";
  return (
    <>
      <div
        className={cn(
          "grid min-w-0 gap-1.5 md:grid-cols-2",
          view === "list" ? "lg:hidden" : "lg:grid-cols-3",
        )}
      >
        {data.rows.map((row) => (
          <InventoryProductCard
            key={row.inventory_item_id}
            item={salesListProduct(row)}
            view={view}
            salesSummary={{
              label: status(row),
              nextStep: hint(row),
              finance: row.order ? (
                <>
                  <span className="text-[10px] text-muted-foreground">
                    {c("paid")} {money(row.order.paid_cents)}
                  </span>
                  <span className="text-[10px] text-primary">
                    {c("balance")} {money(row.order.balance_cents)}
                  </span>
                </>
              ) : null,
            }}
          />
        ))}
      </div>
      {view === "list" ? (
        <div className="hidden overflow-hidden rounded-xl border border-border bg-card lg:block">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,.8fr)_minmax(0,.8fr)_36px] gap-3 border-b border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span>{c("view")}</span>
            <span>{c("title")}</span>
            <span>{c("price")}</span>
            <span>{c("paid")}</span>
            <span>{c("balance")}</span>
            <span />
          </div>
          {data.rows.map((row) => (
            <Link
              href={`/inventory/${row.inventory_item_id}`}
              key={row.inventory_item_id}
              className="grid min-h-20 grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,.8fr)_minmax(0,.8fr)_36px] items-center gap-3 border-b border-border px-3 py-2 text-xs last:border-b-0 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <strong className="block truncate text-sm">{row.product.name}</strong>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {[row.product.storage, row.product.ram, row.product.color]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {row.product.sku} · {row.product.identifier}
                </span>
              </span>
              <span className="min-w-0">
                <span className="text-primary">{status(row)}</span>
                {hint(row) ? (
                  <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">
                    {hint(row)}
                  </span>
                ) : null}
              </span>
              <strong className="tabular-nums">
                {money(row.order?.price_cents ?? row.inspection.list_price_cents ?? 0)}
              </strong>
              <span className="tabular-nums">{row.order ? money(row.order.paid_cents) : "—"}</span>
              <span className="tabular-nums">
                {row.order ? money(row.order.balance_cents) : "—"}
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      ) : null}
      <nav aria-label={c("view")} className="mt-3 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          className="min-h-11"
          disabled={data.offset === 0}
          onClick={() => onPage(Math.max(0, data.offset - data.limit))}
        >
          {c("prev")}
        </Button>
        <span className="text-xs tabular-nums">
          {data.total ? data.offset + 1 : 0}–{Math.min(data.offset + data.rows.length, data.total)}{" "}
          / {data.total}
        </span>
        <Button
          variant="outline"
          className="min-h-11"
          disabled={data.offset + data.limit >= data.total}
          onClick={() => onPage(data.offset + data.limit)}
        >
          {c("next")}
        </Button>
      </nav>
    </>
  );
}
