"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  readOrderPurchasingBoard,
  saveOrderPurchase,
  batchOrderPurchases,
} from "@/lib/repairdesk/api";
import type {
  OrderListItem,
  OrderPurchaseLine,
  OrderPurchaseStatus,
  BatchOrderPurchasesInput,
} from "@/lib/repairdesk/types";
import { useLocale } from "@/shared/i18n/locale-provider";
import { formatCurrency } from "@/shared/i18n/format";
import { ordersKeys } from "../api/query-keys";
import { orderPurchasingCopy } from "../model/order-purchasing-i18n";
import {
  OrderPurchasingEditor,
  purchaseDraftAmount,
  type PurchaseDraft,
} from "./order-purchasing-editor";

type BatchIntent = Omit<BatchOrderPurchasesInput, "expected_store_id" | "idempotency_key">;

type Editor =
  | { order: OrderListItem; row?: OrderPurchaseLine; key: string }
  | { batch: OrderPurchaseLine[]; key: string };
export function OrderPurchasingBoard({
  orders,
  storeId,
  online,
}: {
  orders: OrderListItem[];
  storeId: string;
  online: boolean;
}) {
  const { locale } = useLocale();
  const copy = orderPurchasingCopy(locale);
  const client = useQueryClient();
  const orderIds = useMemo(() => orders.map((order) => order.id), [orders]);
  const query = useQuery({
    queryKey: ordersKeys.purchasing(orderIds, storeId),
    queryFn: async ({ signal }) => {
      const chunks: string[][] = [];
      for (let start = 0; start < orderIds.length; start += 50)
        chunks.push(orderIds.slice(start, start + 50));
      const results = [];
      for (const chunk of chunks)
        results.push(
          await readOrderPurchasingBoard(
            { expected_store_id: storeId, order_ids: chunk },
            { signal },
          ),
        );
      return { ...results[0], groups: results.flatMap((result) => result.groups) };
    },
    enabled: online && orderIds.length > 0,
    staleTime: 15_000,
    retry: false,
  });
  const [filter, setFilter] = useState<"all" | OrderPurchaseStatus>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [editor, setEditor] = useState<Editor>();
  const [confirmation, setConfirmation] = useState<{
    rows: OrderPurchaseLine[];
    status: "ordered" | "arrived";
  }>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const lock = useRef(false);
  const retryIntent = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const rows = (query.data?.groups ?? []).flatMap((group) => group.lines);
  const shownRows = rows.filter((row) => filter === "all" || row.status === filter);
  const selectedRows = shownRows.filter(
    (row) => selected.includes(row.id) && row.status !== "arrived",
  );
  const manageable = query.data?.permissions?.canManage === true;
  const assignable = query.data?.permissions?.canAssignSupplier === true;
  const disabled = pending || !online || !manageable;
  function operationKey(payload: unknown) {
    const fingerprint = JSON.stringify(payload);
    if (retryIntent.current?.fingerprint !== fingerprint)
      retryIntent.current = { fingerprint, key: crypto.randomUUID() };
    return retryIntent.current.key;
  }
  async function refresh() {
    await client.invalidateQueries({ queryKey: ordersKeys.all });
  }
  async function batch(intent: BatchIntent) {
    const payload = { expected_store_id: storeId, ...intent };
    const result = await batchOrderPurchases({
      ...payload,
      idempotency_key: operationKey(payload),
    });
    retryIntent.current = undefined;
    await refresh();
    const failed = result.results.filter((item) => !item.ok);
    setSelected(failed.map((item) => item.id));
    if (failed.length) setError(`${copy.partial} (${copy.failure}: ${failed.length})`);
    else {
      setError(undefined);
      toast.success(copy.saved);
    }
  }
  async function runBatch(intent: BatchIntent) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(undefined);
    try {
      await batch(intent);
      setConfirmation(undefined);
    } catch (failure) {
      setError((failure as { status?: number })?.status === 409 ? copy.conflict : copy.failed);
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  function requestStatus(targets: OrderPurchaseLine[], status: "ordered" | "arrived") {
    if (!targets.length) return;
    const before = status === "ordered" ? "needed" : "ordered";
    if (targets.some((row) => row.status !== before)) {
      setError(copy.mixed);
      return;
    }
    if (
      status === "ordered" &&
      targets.some((row) => !row.supplier_id || row.unit_cost_eur == null)
    ) {
      if (targets.length === 1) {
        const order = orders.find((item) => item.id === targets[0].order_id);
        if (order) setEditor({ order, row: targets[0], key: crypto.randomUUID() });
      } else setError(copy.completeFirst);
      return;
    }
    if (targets.length > 1) setConfirmation({ rows: targets, status });
    else
      void runBatch({
        operation: status === "ordered" ? "mark_ordered" : "mark_arrived",
        items: targets.map((row) => ({ id: row.id, expected_revision: row.revision })),
      });
  }
  async function save(draft: PurchaseDraft, markOrdered: boolean) {
    if (!editor || lock.current || !online) throw new Error("Unavailable");
    lock.current = true;
    setPending(true);
    try {
      if ("batch" in editor)
        await batch({
          operation: "assign_supplier",
          supplier_id: draft.supplier_id,
          items: editor.batch.map((row) => ({ id: row.id, expected_revision: row.revision })),
        });
      else {
        const payload = {
          expected_store_id: storeId,
          id: editor.row?.id,
          order_id: editor.order.id,
          line_id: draft.line_id,
          part_name: draft.part_name.trim(),
          supplier_id: draft.supplier_id || null,
          unit_cost_eur: purchaseDraftAmount(draft.unit_cost_eur) ?? null,
          quantity: Number(draft.quantity),
          expected_revision: editor.row?.revision ?? 0,
          status:
            markOrdered || editor.row?.status === "ordered"
              ? ("ordered" as const)
              : ("needed" as const),
        };
        await saveOrderPurchase({ ...payload, idempotency_key: operationKey(payload) });
        retryIntent.current = undefined;
        await refresh();
        toast.success(copy.saved);
      }
      setEditor(undefined);
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  if (query.isPending)
    return (
      <div aria-label={copy.loading} className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  if (query.isError) {
    const status = (query.error as { status?: number }).status;
    return (
      <div role="alert" className="rounded-xl border p-4 text-sm">
        <p>{status === 403 ? copy.noAccess : copy.loadFailed}</p>
        <Button
          variant="outline"
          className="mt-2 min-h-11"
          disabled={!online}
          onClick={() => void query.refetch()}
        >
          {copy.retry}
        </Button>
      </div>
    );
  }
  const initial: PurchaseDraft =
    editor && !("batch" in editor)
      ? {
          part_name: editor.row?.part_name ?? "",
          line_id: editor.row?.line_id ?? null,
          supplier_id: editor.row?.supplier_id ?? "",
          unit_cost_eur: editor.row?.unit_cost_eur ?? "",
          quantity: String(editor.row?.quantity ?? 1),
        }
      : { part_name: "", line_id: null, supplier_id: "", unit_cost_eur: "", quantity: "1" };
  const conflict =
    editor && !("batch" in editor) && editor.row
      ? rows.find((row) => row.id === editor.row?.id)?.revision !== editor.row.revision
      : false;
  const eligible = shownRows.filter((row) => row.status !== "arrived");
  return (
    <section
      data-order-purchasing-board="true"
      className={`min-w-0 space-y-3 ${selectedRows.length ? "pb-40" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{copy.title}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={copy.retry}
          disabled={pending || query.isFetching || !online}
          onClick={() => void query.refetch()}
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-1" role="group" aria-label={copy.progress}>
        {(["all", "needed", "ordered", "arrived"] as const).map((status) => (
          <Button
            key={status}
            variant={filter === status ? "secondary" : "ghost"}
            className="h-auto min-h-11 min-w-0 whitespace-normal break-words px-1 text-xs"
            aria-pressed={filter === status}
            disabled={pending}
            onClick={() => {
              setFilter(status);
              setSelected([]);
              setError(undefined);
            }}
          >
            {copy[status]} {rows.filter((row) => status === "all" || row.status === status).length}
          </Button>
        ))}
      </div>
      {manageable && (
        <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
          <label className="inline-flex min-h-11 items-center gap-2">
            <Checkbox
              aria-label={copy.selectPage}
              disabled={disabled || !eligible.length}
              checked={eligible.length > 0 && selectedRows.length === eligible.length}
              onCheckedChange={(value) => setSelected(value ? eligible.map((row) => row.id) : [])}
            />
            {copy.selectPage}
          </label>
          <span>{copy.selectionScope}</span>
        </div>
      )}
      {orders.map((order) => {
        const orderRows = shownRows.filter((row) => row.order_id === order.id);
        if (!orderRows.length && filter !== "all") return null;
        return (
          <section
            key={order.id}
            className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
            data-purchase-order={order.id}
          >
            <header className="flex flex-wrap items-center justify-between gap-1 border-b bg-muted/40 px-3 py-2">
              <Link
                href={`/orders/${order.id}?from=orders`}
                className="min-w-0 flex-1 text-sm font-semibold"
              >
                <span className="block break-words">
                  {order.device_label || order.device_imei || "—"}
                </span>
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  {order.public_no}
                </span>
              </Link>
              {manageable && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11 max-w-full whitespace-normal text-xs"
                  disabled={disabled}
                  onClick={() => setEditor({ order, key: crypto.randomUUID() })}
                >
                  <Plus className="size-3.5 shrink-0" />
                  {copy.add}
                </Button>
              )}
            </header>
            {orderRows.length ? (
              <table
                className="w-full table-fixed text-sm"
                aria-label={`${order.public_no} ${copy.title}`}
              >
                <colgroup>
                  <col className="w-10" />
                  <col className="w-[30%]" />
                  <col className="w-[30%]" />
                  <col />
                </colgroup>
                <thead>
                  <tr className="text-left text-[11px] text-muted-foreground">
                    <th />
                    <th className="px-1 py-2 font-normal">
                      {copy.part} / {copy.quantity}
                    </th>
                    <th className="px-1 py-2 font-normal">
                      {copy.supplier} / {copy.cost}
                    </th>
                    <th className="px-1 py-2 font-normal">{copy.progress}</th>
                  </tr>
                </thead>
                <tbody>
                  {orderRows.map((row) => (
                    <tr key={row.id} className="border-t" data-purchase-line={row.id}>
                      <td className="align-middle">
                        <label className="flex min-h-11 w-10 items-center justify-center">
                          <Checkbox
                            aria-label={`${copy.selected}: ${order.public_no} ${row.part_name}`}
                            checked={selectedRows.some((item) => item.id === row.id)}
                            disabled={disabled || row.status === "arrived"}
                            onCheckedChange={(checked) =>
                              setSelected((previous) =>
                                checked
                                  ? [...previous, row.id]
                                  : previous.filter((id) => id !== row.id),
                              )
                            }
                          />
                        </label>
                      </td>
                      <td className="break-words px-1 py-3">
                        <span className="font-medium">{row.part_name}</span>
                        <span className="block text-xs text-muted-foreground">
                          × {row.quantity}
                        </span>
                      </td>
                      <td className="px-1 py-2">
                        <Button
                          variant="ghost"
                          className="h-auto min-h-11 w-full min-w-0 flex-col items-start gap-0.5 whitespace-normal break-words px-0 text-left text-xs"
                          disabled={disabled || row.status === "arrived"}
                          aria-label={`${copy.edit}: ${order.public_no} ${row.part_name}`}
                          onClick={() => setEditor({ order, row, key: crypto.randomUUID() })}
                        >
                          <span className="max-w-full text-primary">
                            {row.supplier_name || copy.selectSupplier}
                          </span>
                          <span className="max-w-full break-all font-mono tabular-nums">
                            {row.unit_cost_eur == null
                              ? copy.missingCost
                              : formatCurrency(Number(row.unit_cost_eur), locale)}
                          </span>
                        </Button>
                      </td>
                      <td className="px-1 py-2">
                        <span className="mb-1 block break-words text-[11px] text-muted-foreground">
                          {copy[row.status]}
                        </span>
                        {row.status !== "arrived" && (
                          <Button
                            variant="secondary"
                            className="h-auto min-h-11 w-full whitespace-normal break-words px-1 text-xs text-primary"
                            disabled={disabled}
                            onClick={() =>
                              requestStatus([row], row.status === "needed" ? "ordered" : "arrived")
                            }
                          >
                            {row.status === "needed" ? copy.markOrdered : copy.markArrived}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-3 py-3 text-xs text-muted-foreground">{copy.noParts}</p>
            )}
          </section>
        );
      })}
      {!shownRows.length && filter !== "all" && (
        <p className="py-4 text-center text-sm text-muted-foreground">{copy.noMatches}</p>
      )}
      {error && (
        <p role="alert" className="break-words text-sm text-status-danger-foreground">
          {error}
        </p>
      )}
      {selectedRows.length > 0 && (
        <div
          className="fixed inset-x-3 bottom-20 z-30 mx-auto max-w-xl space-y-2 rounded-xl border bg-card p-3 shadow-sm md:bottom-6"
          data-purchasing-batch="true"
        >
          <div className="flex items-center justify-between gap-1 text-xs">
            <span>
              {copy.selected}: {selectedRows.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11"
              disabled={pending}
              onClick={() => setSelected([])}
            >
              {copy.clear}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <Button
              variant="outline"
              className="h-auto min-h-11 whitespace-normal px-1 text-xs"
              disabled={disabled || !assignable}
              onClick={() => setEditor({ batch: selectedRows, key: crypto.randomUUID() })}
            >
              {copy.batchSupplier}
            </Button>
            <Button
              className="h-auto min-h-11 whitespace-normal px-1 text-xs"
              disabled={disabled}
              onClick={() => requestStatus(selectedRows, "ordered")}
            >
              {copy.batchOrdered}
            </Button>
            <Button
              variant="outline"
              className="h-auto min-h-11 whitespace-normal px-1 text-xs"
              disabled={disabled}
              onClick={() => requestStatus(selectedRows, "arrived")}
            >
              {copy.batchArrived}
            </Button>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{copy.noInventory}</p>
      {editor && (
        <OrderPurchasingEditor
          key={editor.key}
          initial={initial}
          title={
            "batch" in editor
              ? `${copy.selected}: ${editor.batch.length}`
              : `${editor.order.device_label ?? ""} · ${editor.order.public_no}`
          }
          suppliers={query.data?.suppliers ?? []}
          repairLines={"batch" in editor ? [] : editor.order.fault_prices}
          status={
            "batch" in editor ? "needed" : editor.row?.status === "ordered" ? "ordered" : "needed"
          }
          batch={"batch" in editor}
          canAssignSupplier={assignable}
          conflict={Boolean(conflict)}
          onClose={() => setEditor(undefined)}
          onSave={save}
        />
      )}
      <Dialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirmation(undefined);
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{copy.batchConfirm}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p>
              {confirmation ? copy[confirmation.status] : ""} · {confirmation?.rows.length}{" "}
              {copy.part}
            </p>
            {error && (
              <p role="alert" className="text-status-danger-foreground">
                {error}
              </p>
            )}
            <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
              {confirmation?.rows.map((row) => (
                <li key={row.id}>
                  {orders.find((order) => order.id === row.order_id)?.public_no} · {row.part_name}
                </li>
              ))}
            </ul>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setConfirmation(undefined)}>
              {copy.cancel}
            </Button>
            <Button
              disabled={pending || !online}
              onClick={() => {
                if (confirmation)
                  void runBatch({
                    operation: confirmation.status === "ordered" ? "mark_ordered" : "mark_arrived",
                    items: confirmation.rows.map((row) => ({
                      id: row.id,
                      expected_revision: row.revision,
                    })),
                  });
              }}
            >
              {pending ? copy.pending : copy.apply}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
