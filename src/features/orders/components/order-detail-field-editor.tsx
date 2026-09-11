"use client";

import { type RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AccessoryNotesPicker } from "@/features/orders/components/accessory-notes-picker";
import { WarrantyPicker, WarrantyTag } from "@/features/orders/components/warranty-picker";
import { warrantyReasonRequired } from "@/features/orders/model/order-warranty";
import { hasOrderEditRemoteConflict } from "@/features/orders/model/order-edit-conflict";
import type { UpdateOrderInput } from "@/lib/repairdesk/api";
import { componentOverlay } from "@/lib/component-patterns";
import { useLocale } from "@/shared/i18n/locale-provider";
import {
  EditorDiscardConfirmation,
  editorConfirmationClass,
  useCompactEditorSession,
} from "@/shared/lib/use-compact-editor-session";

export type OrderDetailField = "accessories" | "notes" | "warranty";

export function OrderDetailFieldEditor({
  field,
  initial,
  scopeKey,
  pending,
  canEditIntake,
  canEditRepair,
  defaultWarrantyMonths,
  returnFocusRef,
  onClose,
  onSave,
}: {
  field: OrderDetailField | null;
  initial: UpdateOrderInput;
  scopeKey: string;
  pending: boolean;
  canEditIntake: boolean;
  canEditRepair: boolean;
  defaultWarrantyMonths: number;
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSave: (baseline: UpdateOrderInput, draft: UpdateOrderInput) => Promise<unknown>;
}) {
  const { t } = useLocale();
  const session = useCompactEditorSession({
    open: Boolean(field),
    scopeKey: `${scopeKey}:${field}`,
    initial,
    busy: pending,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });
  const { draft, baseline, setDraft } = session;
  const editable = field === "accessories" ? canEditIntake : canEditRepair;
  const title = t(
    field === "accessories"
      ? "orders2b2.overview.accessories"
      : field === "warranty"
        ? "orders2b2.overview.warranty"
        : "orders2b2.overview.deviceNotes",
  );
  const conflict = hasOrderEditRemoteConflict({
    baselineUpdatedAt: baseline.expected_updated_at,
    currentUpdatedAt: initial.expected_updated_at,
    hasLocalChanges: session.dirty,
    isEditing: Boolean(field),
  });
  const valid =
    field !== "warranty" ||
    !warrantyReasonRequired(
      draft.warranty_months ?? defaultWarrantyMonths,
      defaultWarrantyMonths,
    ) ||
    Boolean(draft.warranty_change_reason?.trim());
  const patch = (value: Partial<UpdateOrderInput>) => {
    if (!pending && editable) setDraft((current) => ({ ...current, ...value }));
  };
  return (
    <Dialog open={Boolean(field)} onOpenChange={session.requestClose}>
      <DialogContent
        mobileEditor
        editorLayout
        data-order-field-editor={field ?? undefined}
        data-confirm-discard={session.confirmDiscard}
        aria-busy={pending}
        aria-describedby={undefined}
        className={`${componentOverlay.editorSurface} ${componentOverlay.denseEditorSurface} ${editorConfirmationClass} order-detail-interaction-overlay`}
        onCloseAutoFocus={(event) => {
          if (returnFocusRef.current?.isConnected) {
            event.preventDefault();
            returnFocusRef.current.focus({ preventScroll: true });
          }
        }}
      >
        <DialogHeader className={componentOverlay.denseEditorHeader}>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {session.confirmDiscard ? (
          <EditorDiscardConfirmation
            returnFocus={session.returnFocus}
            keep={session.keep}
            discard={session.discard}
          />
        ) : null}
        <DialogBody className={componentOverlay.denseEditorBody}>
          {!editable ? (
            <div className="whitespace-pre-wrap break-words text-sm leading-6">
              {field === "accessories" ? (
                draft.accessory_notes || "—"
              ) : field === "notes" ? (
                draft.device_notes || "—"
              ) : (
                <WarrantyTag months={draft.warranty_months} text={draft.warranty_text} />
              )}
            </div>
          ) : (
            <fieldset disabled={pending} className="min-w-0">
              {field === "accessories" ? (
                <AccessoryNotesPicker
                  value={draft.accessory_notes}
                  onChange={(accessory_notes) => patch({ accessory_notes })}
                  disabled={pending}
                  quickChoices
                />
              ) : field === "notes" ? (
                <Textarea
                  aria-label={title}
                  value={draft.device_notes ?? ""}
                  onChange={(event) => patch({ device_notes: event.target.value })}
                  className="min-h-32 text-base"
                />
              ) : (
                <WarrantyPicker
                  valueMonths={draft.warranty_months}
                  valueText={draft.warranty_text}
                  reason={draft.warranty_change_reason}
                  defaultMonths={defaultWarrantyMonths}
                  onChange={patch}
                />
              )}
            </fieldset>
          )}
          {conflict || session.saveFailed ? (
            <p role="alert" className="text-sm text-destructive">
              {t(conflict ? "orders2b2.conflict.description" : "orders.faultEditor.errorState")}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter className={componentOverlay.denseEditorFooter}>
          <Button variant="outline" disabled={pending} onClick={() => session.requestClose(false)}>
            {t(editable ? "common.cancel" : "common.close")}
          </Button>
          {editable ? (
            <Button
              disabled={pending || !session.dirty || !valid || conflict}
              onClick={() =>
                void session.save(async (value) => {
                  await onSave(baseline, value);
                  onClose();
                })
              }
            >
              {t(pending ? "orders2b2.hero.saving" : "orders2b2.hero.save")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
