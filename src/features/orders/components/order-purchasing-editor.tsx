"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyKeypadInput } from "@/components/orders/money-keypad-input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { componentOverlay } from "@/lib/component-patterns";
import { useLocale } from "@/shared/i18n/locale-provider";
import { formatCurrency } from "@/shared/i18n/format";
import {
  EditorDiscardConfirmation,
  editorConfirmationClass,
  useCompactEditorSession,
} from "@/shared/lib/use-compact-editor-session";
import { orderPurchasingCopy } from "../model/order-purchasing-i18n";

export interface PurchaseDraft {
  part_name: string;
  line_id: string | null;
  supplier_id: string;
  unit_cost_eur: string;
  quantity: string;
}
export function purchaseDraftAmount(value: string) {
  const clean = value.trim().replace(",", ".");
  if (clean === "") return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(clean)) return undefined;
  const [whole, decimal = ""] = clean.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= 99999999 ? (cents / 100).toFixed(2) : undefined;
}

export function OrderPurchasingEditor({
  initial,
  title,
  suppliers,
  repairLines = [],
  status = "needed",
  batch = false,
  canAssignSupplier = true,
  conflict = false,
  onClose,
  onSave,
}: {
  initial: PurchaseDraft;
  title: string;
  suppliers: { id: string; name: string }[];
  repairLines?: { line_id?: string; name: string }[];
  status?: "needed" | "ordered";
  batch?: boolean;
  canAssignSupplier?: boolean;
  conflict?: boolean;
  onClose: () => void;
  onSave: (draft: PurchaseDraft, markOrdered: boolean) => Promise<void>;
}) {
  const { locale } = useLocale();
  const copy = orderPurchasingCopy(locale);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);
  const session = useCompactEditorSession({
    open: true,
    scopeKey: "purchase",
    initial,
    busy: pending,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });
  const { draft, setDraft } = session;
  const patch = (value: Partial<PurchaseDraft>) => {
    if (!inFlight.current) {
      setError(undefined);
      setDraft((old) => ({ ...old, ...value }));
    }
  };
  const amount = purchaseDraftAmount(draft.unit_cost_eur);
  const quantity = /^\d+$/.test(draft.quantity) ? Number(draft.quantity) : NaN;
  const validQuantity = Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 100000;
  async function save(markOrdered: boolean) {
    if (inFlight.current || conflict) return;
    if (
      batch
        ? !draft.supplier_id
        : !draft.part_name.trim() ||
          !validQuantity ||
          ((markOrdered || status === "ordered") && (!draft.supplier_id || amount == null))
    ) {
      setError(copy.required);
      return;
    }
    if (!batch && amount === undefined) {
      setError(copy.invalidAmount);
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError(undefined);
    try {
      await onSave(draft, markOrdered);
    } catch (failure) {
      setError((failure as { status?: number })?.status === 409 ? copy.conflict : copy.failed);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return (
    <Dialog open onOpenChange={session.requestClose}>
      <DialogContent
        mobileEditor
        editorLayout
        aria-describedby={undefined}
        aria-busy={pending}
        data-order-purchasing-editor="true"
        data-confirm-discard={session.confirmDiscard}
        className={`${componentOverlay.editorSurface} ${componentOverlay.denseEditorSurface} ${editorConfirmationClass}`}
      >
        <DialogHeader className={componentOverlay.denseEditorHeader}>
          <div className="min-w-0">
            <DialogTitle>{batch ? copy.batchSupplier : copy.edit}</DialogTitle>
            <p className="break-words text-xs text-muted-foreground">{title}</p>
          </div>
        </DialogHeader>
        {session.confirmDiscard ? (
          <DialogBody className={componentOverlay.denseEditorBody}>
            <EditorDiscardConfirmation
              keep={session.keep}
              discard={session.discard}
              returnFocus={session.returnFocus}
            />
          </DialogBody>
        ) : (
          <>
            <DialogBody className={componentOverlay.denseEditorBody}>
              {!batch && (
                <>
                  {repairLines.length > 0 && (
                    <label className="block space-y-1 text-sm">
                      {copy.orderLine}
                      <select
                        aria-label={copy.orderLine}
                        disabled={pending}
                        className={`${componentOverlay.editorField} min-h-11 w-full min-w-0 border p-2`}
                        value={draft.line_id ?? ""}
                        onChange={(event) => {
                          const line = repairLines.find(
                            (item) => item.line_id === event.target.value,
                          );
                          patch({
                            line_id: event.target.value || null,
                            ...(line ? { part_name: line.name } : {}),
                          });
                        }}
                      >
                        <option value="">{copy.customPart}</option>
                        {repairLines
                          .filter((line) => line.line_id)
                          .map((line) => (
                            <option key={line.line_id} value={line.line_id}>
                              {line.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <label className="block space-y-1 text-sm">
                    {copy.part}
                    <Input
                      aria-label={copy.part}
                      className="min-h-11 text-base"
                      maxLength={160}
                      value={draft.part_name}
                      disabled={pending}
                      onChange={(event) => patch({ part_name: event.target.value })}
                    />
                  </label>
                </>
              )}
              <label className="block space-y-1 text-sm">
                {copy.supplier}
                <select
                  aria-label={copy.supplier}
                  className={`${componentOverlay.editorField} min-h-11 w-full min-w-0 border p-2`}
                  value={draft.supplier_id}
                  disabled={pending || !canAssignSupplier}
                  onChange={(event) => patch({ supplier_id: event.target.value })}
                >
                  <option value="">{copy.selectSupplier}</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>
              {suppliers.length === 0 && (
                <p className="text-xs text-muted-foreground">{copy.noSupplier}</p>
              )}
              {canAssignSupplier && (
                <div className="flex flex-wrap gap-1">
                  {suppliers.slice(0, 3).map((supplier) => (
                    <Button
                      type="button"
                      key={supplier.id}
                      variant="outline"
                      className="min-h-11 max-w-full whitespace-normal break-words text-xs"
                      aria-pressed={draft.supplier_id === supplier.id}
                      disabled={pending}
                      onClick={() => patch({ supplier_id: supplier.id })}
                    >
                      {supplier.name}
                    </Button>
                  ))}
                </div>
              )}
              {batch ? (
                <p className="text-sm text-muted-foreground">{copy.batchHint}</p>
              ) : (
                <>
                  <div className="grid min-w-0 grid-cols-2 gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm">{copy.cost}</p>
                      <MoneyKeypadInput
                        ariaLabel={copy.cost}
                        value={draft.unit_cost_eur}
                        onChange={(value) => patch({ unit_cost_eur: value })}
                        disabled={pending}
                        placeholder={copy.missingCost}
                        className="min-h-11"
                      />
                    </div>
                    <label className="min-w-0 space-y-1 text-sm">
                      {copy.quantity}
                      <Input
                        aria-label={copy.quantity}
                        inputMode="numeric"
                        className="min-h-11 text-base"
                        disabled={pending}
                        value={draft.quantity}
                        onChange={(event) => patch({ quantity: event.target.value })}
                      />
                    </label>
                  </div>
                  <div className="flex justify-between gap-2 border-t py-3 text-sm">
                    <span>{copy.total}</span>
                    <strong className="font-mono tabular-nums">
                      {amount != null && validQuantity
                        ? formatCurrency(Number(amount) * quantity, locale)
                        : "—"}
                    </strong>
                  </div>
                </>
              )}
              {conflict && (
                <p role="alert" className="text-sm text-status-danger-foreground">
                  {copy.conflict}
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-status-danger-foreground">
                  {error}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{copy.noInventory}</p>
            </DialogBody>
            <DialogFooter className={componentOverlay.denseEditorFooter}>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => session.requestClose(false)}
              >
                {copy.cancel}
              </Button>
              <Button
                variant={batch || status === "ordered" ? "default" : "outline"}
                disabled={pending || conflict}
                onClick={() => void save(false)}
              >
                {pending ? copy.pending : copy.save}
              </Button>
              {!batch && status === "needed" && (
                <Button
                  className="col-span-2"
                  disabled={pending || conflict}
                  onClick={() => void save(true)}
                >
                  {copy.saveOrder}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
