"use client";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { applyInventoryWorkflowV2, type ApplyInventoryWorkflowV2Input } from "@/lib/repairdesk/api";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { InventorySalesSummary } from "../model/contracts";
import { invalidateInventorySales } from "../api/queries";
import { Field, MoneyField, SalesDialog } from "./sales-transaction-dialog";
import { salesCopy, type SalesCopyKey } from "./sales-copy";
import { commandIdentity, moneyToCents, salesErrorKey } from "./sales-ui-adapter";

export function SalesInspectionDialog({
  summary: liveSummary,
  storeId,
  onClose,
}: {
  summary: InventorySalesSummary;
  storeId: string;
  onClose: () => void;
}) {
  const [summary] = useState(liveSummary);
  const { locale } = useLocale();
  const c = (key: SalesCopyKey) => salesCopy(locale, key);
  const client = useQueryClient();
  const [inspection, setInspection] = useState({ ...summary.inspection });
  const [price, setPrice] = useState(String((summary.inspection.list_price_cents ?? 0) / 100));
  const [error, setError] = useState<SalesCopyKey | null>(null);
  const identity = useRef<ReturnType<typeof commandIdentity> | null>(null);
  const lock = useRef(false);
  const mutation = useMutation({
    mutationFn: (input: ApplyInventoryWorkflowV2Input) =>
      applyInventoryWorkflowV2(summary.inventory_item_id, input),
  });
  const checks = [
    "imei_check_status",
    "activation_lock_status",
    "data_wipe_status",
    "functional_grade",
    "cosmetic_grade",
  ] as const;
  async function save() {
    if (lock.current || !summary.capabilities.can_inspect) return;
    const cents = moneyToCents(price);
    if (!cents) {
      setError("overpayment");
      return;
    }
    lock.current = true;
    setError(null);
    try {
      const { list_price_cents: _price, ...values } = inspection;
      const input = {
        expected_updated_at: summary.item_updated_at,
        operation: "inspect" as const,
        inspection: values as ApplyInventoryWorkflowV2Input["inspection"],
        ...(cents !== summary.inspection.list_price_cents
          ? { commercial_patch: { list_price: cents / 100 } }
          : {}),
      };
      identity.current = commandIdentity(identity.current, input);
      await mutation.mutateAsync({ ...input, idempotency_key: identity.current.key });
      await invalidateInventorySales(client, storeId);
      onClose();
    } catch (cause) {
      setError(salesErrorKey(cause));
    } finally {
      lock.current = false;
    }
  }
  return (
    <SalesDialog
      title={c("inspect")}
      description={c("blocked")}
      onClose={onClose}
      pending={mutation.isPending}
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-3">
          {checks.map((field) => {
            const options =
              field === "functional_grade"
                ? ["untested", "passed", "needs_repair", "failed", "for_parts"]
                : field === "cosmetic_grade"
                  ? ["unknown", "new", "mint", "good", "fair", "poor", "for_parts"]
                  : ["unknown", "unchecked", "pass", "fail"];
            return (
              <Field key={field} label={c(field)}>
                <select
                  aria-label={c(field)}
                  className="min-h-11 w-full rounded-lg border border-input bg-background px-2 text-base lg:text-sm"
                  value={inspection[field]}
                  disabled={mutation.isPending}
                  onChange={(e) => setInspection({ ...inspection, [field]: e.target.value })}
                >
                  {options.map((v) => (
                    <option key={v} value={v}>
                      {c(
                        v === "passed"
                          ? "pass"
                          : ["failed", "for_parts", "needs_repair"].includes(v)
                            ? "fail"
                            : ["untested", "unchecked"].includes(v)
                              ? "unknown"
                              : (v as SalesCopyKey),
                      )}
                    </option>
                  ))}
                </select>
              </Field>
            );
          })}
          <MoneyField
            label={c("price")}
            value={price}
            onChange={setPrice}
            disabled={mutation.isPending}
          />
        </div>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {c(error)}
          </p>
        ) : null}
      </div>
      <footer className="grid grid-cols-2 gap-2 border-t border-border p-3">
        <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
          {c("cancel")}
        </Button>
        <Button disabled={mutation.isPending} onClick={() => void save()}>
          {c(mutation.isPending ? "pending" : "save")}
        </Button>
      </footer>
    </SalesDialog>
  );
}
