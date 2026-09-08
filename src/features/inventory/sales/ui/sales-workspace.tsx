"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { applyInventoryWorkflowV2 } from "@/lib/repairdesk/api";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import type {
  InventorySalesCommand,
  InventorySalesReceiptInput,
  InventorySalesSummary,
} from "../model/contracts";
import { inventorySalesDetailOptions, invalidateInventorySales } from "../api/queries";
import { salesDocumentDate, salesDocumentMoney } from "../model/sales-document";
import { salesCopy, salesLanguage, type SalesCopyKey } from "./sales-copy";
import { commandIdentity, salesErrorKey, salesStatusKey } from "./sales-ui-adapter";
import { Fact, SalesTransactionDialog } from "./sales-transaction-dialog";
import { SalesInspectionDialog } from "./sales-inspection-dialog";
import { SalesReceiptDialog } from "./sales-receipt-dialog";

export function SalesWorkspace({
  summary,
  storeId,
  onRefresh,
}: {
  summary: InventorySalesSummary;
  storeId: string;
  onRefresh: () => Promise<unknown>;
}) {
  const { locale } = useLocale();
  const c = (key: SalesCopyKey) => salesCopy(locale, key);
  const language = salesLanguage(locale);
  const client = useQueryClient();
  const detail = useQuery({
    ...inventorySalesDetailOptions(summary.order?.id ?? "", storeId),
    enabled: Boolean(summary.order),
    retry: false,
  });
  const current = detail.isSuccess && !detail.isError && detail.data ? detail.data : summary;
  const [command, setCommand] = useState<InventorySalesCommand | null>(null);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [receipt, setReceipt] = useState<InventorySalesReceiptInput | null>(null);
  const [error, setError] = useState<SalesCopyKey | null>(null);
  const transitionIdentity = useRef<ReturnType<typeof commandIdentity> | null>(null);
  const lock = useRef(false);
  const transition = useMutation({
    mutationFn: (input: Parameters<typeof applyInventoryWorkflowV2>[1]) =>
      applyInventoryWorkflowV2(current.inventory_item_id, input),
  });
  async function prepare() {
    if (lock.current || !current.capabilities.can_prepare_for_sale) return;
    lock.current = true;
    setError(null);
    const input = {
      expected_updated_at: current.item_updated_at,
      operation: "transition" as const,
      target_status: "ready_for_sale" as const,
    };
    transitionIdentity.current = commandIdentity(transitionIdentity.current, input);
    try {
      await transition.mutateAsync({ ...input, idempotency_key: transitionIdentity.current.key });
      await invalidateInventorySales(client, storeId);
    } catch (cause) {
      setError(salesErrorKey(cause));
    } finally {
      lock.current = false;
    }
  }
  const order = current.order;
  const caps = current.capabilities;
  const inspectionEditable = !["reserved", "sold", "returned", "cancelled", "recycled"].includes(
    current.item_status,
  );
  const missingLabel = (missing: string): SalesCopyKey =>
    (({
      identifier_check: "imei_check_status",
      activation_lock: "activation_lock_status",
      data_wipe: "data_wipe_status",
      functional: "functional_grade",
      cosmetic: "cosmetic_grade",
      list_price: "price",
      stock_unit_required: "legacy",
      ready_for_sale: "prepare",
      device_identifier: "identifier",
      stock_projection: "projection",
      existing_sale_payment: "projection",
    })[missing] as SalesCopyKey) ?? "blocked";
  return (
    <section
      className={cn(repairOs.mobileInfoCard, "grid min-w-0 gap-2 p-2.5 lg:p-3")}
      data-ui="inventory-sales-workspace"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{c("title")}</h2>
        <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] text-primary">
          {c(salesStatusKey(current))}
        </span>
      </div>
      {order ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Fact label={c("price")} value={salesDocumentMoney(order.price_cents, language)} />
            <Fact label={c("paid")} value={salesDocumentMoney(order.paid_cents, language)} />
            <Fact label={c("balance")} value={salesDocumentMoney(order.balance_cents, language)} />
          </div>
          {detail.data?.customer && !detail.isError ? (
            <Link
              href={`/customers/${order.customer_id}`}
              className="break-words text-xs text-primary"
            >
              {detail.data.customer.phone} · {detail.data.customer.name}
            </Link>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {order.delivered_at
              ? `${c("delivered")} · ${salesDocumentDate(order.delivered_at, language)}`
              : c("heldNote")}
          </p>
          {detail.data?.warranty && !detail.isError ? (
            <p className="text-xs">
              {c("warranty")} · {detail.data.warranty.starts_on} — {detail.data.warranty.ends_on}
            </p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">{c("occupied")}</p>
          {detail.isError ? (
            <div role="alert" className="text-xs text-destructive">
              {c(salesErrorKey(detail.error))}
              <Button variant="outline" onClick={() => void detail.refetch()}>
                {c("retry")}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
      {!current.stock_unit_id ? (
        <p className="text-xs text-muted-foreground">{c("legacy")}</p>
      ) : null}
      {!order && current.stock_unit_id ? (
        <div className="grid gap-2">
          <h3 className="text-xs font-semibold">{c("inspect")}</h3>
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
            {(
              [
                "imei_check_status",
                "activation_lock_status",
                "data_wipe_status",
                "functional_grade",
                "cosmetic_grade",
              ] as const
            ).map((key) => {
              const value = current.inspection[key];
              const label: SalesCopyKey = ["pass", "passed"].includes(value)
                ? "pass"
                : ["fail", "failed", "for_parts", "needs_repair"].includes(value)
                  ? "fail"
                  : ["new", "mint", "good", "fair", "poor"].includes(value)
                    ? (value as SalesCopyKey)
                    : "unknown";
              return (
                <div key={key} className="flex min-w-0 flex-wrap justify-between gap-1">
                  <dt className="text-muted-foreground">{c(key)}</dt>
                  <dd>{c(label)}</dd>
                </div>
              );
            })}
          </dl>
          {current.inspection_missing.length ? (
            <div className="text-xs text-status-warn-foreground">
              <p>{c("blocked")}</p>
              <ul className="mt-1 list-inside list-disc">
                {current.inspection_missing.map((missing) => (
                  <li key={missing}>{c(missingLabel(missing))}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {!caps.can_inspect && caps.inspection_block_reason ? (
            <p className="text-xs text-muted-foreground">
              {c(
                caps.inspection_block_reason === "workflow_disabled" ? "workflowOff" : "permission",
              )}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {caps.can_inspect && inspectionEditable ? (
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => setInspectionOpen(true)}
              >
                {c("inspect")}
              </Button>
            ) : null}
            {caps.can_prepare_for_sale &&
            !["ready_for_sale", "listed"].includes(current.item_status) ? (
              <Button
                variant="outline"
                className="min-h-11"
                disabled={
                  transition.isPending ||
                  current.inspection_missing.some((missing) => missing !== "ready_for_sale")
                }
                onClick={() => void prepare()}
              >
                {c("prepare")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {current.allowed_actions.map((action) => (
          <Button
            key={action}
            className="min-h-11"
            disabled={detail.isFetching || detail.isError || transition.isPending}
            onClick={() => setCommand(action)}
          >
            {c(
              action === "sale.create"
                ? "sell"
                : action === "payment.append"
                  ? "collect"
                  : "pickup",
            )}
          </Button>
        ))}
      </div>
      {order && caps.print_kinds.length ? (
        <div className="flex flex-wrap gap-2">
          {caps.print_kinds
            .filter((kind) => kind !== "payment")
            .map((kind) => (
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                key={kind}
                onClick={() => setReceipt({ id: order.id, kind })}
              >
                {c(kind === "warranty" ? "warrantyDoc" : "sale")}
              </Button>
            ))}
        </div>
      ) : null}
      {detail.data?.payments.length && !detail.isError ? (
        <div className="space-y-1 border-t border-border pt-2">
          <h3 className="text-xs font-semibold">{c("history")}</h3>
          {detail.data.payments.map((payment) => (
            <div
              key={payment.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-muted/40 p-2"
            >
              <div className="min-w-0 text-xs">
                <p>
                  {salesDocumentDate(payment.occurred_at, language)} · {c(payment.method)}
                </p>
                <p className="font-semibold">
                  {salesDocumentMoney(payment.amount_cents, language)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {c("balance")} · {salesDocumentMoney(payment.balance_after_cents, language)}
                </p>
              </div>
              {caps.print_kinds.includes("payment") && order ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  onClick={() =>
                    setReceipt({ id: order.id, kind: "payment", payment_id: payment.id })
                  }
                >
                  {c("payment")}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {c(error)}
        </p>
      ) : null}
      {command ? (
        <SalesTransactionDialog
          summary={current}
          command={command}
          storeId={storeId}
          onClose={() => setCommand(null)}
          onRefresh={async () => {
            await onRefresh();
            if (order) await detail.refetch();
          }}
        />
      ) : null}
      {inspectionOpen ? (
        <SalesInspectionDialog
          summary={current}
          storeId={storeId}
          onClose={() => setInspectionOpen(false)}
        />
      ) : null}
      {receipt ? (
        <SalesReceiptDialog
          key={`${storeId}:${receipt.kind}:${receipt.payment_id ?? ""}`}
          input={receipt}
          storeId={storeId}
          onClose={() => setReceipt(null)}
        />
      ) : null}
    </section>
  );
}
