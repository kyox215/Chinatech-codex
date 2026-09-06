"use client";

import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { UpdateOrderInput } from "@/lib/repairdesk/api";
import { componentOverlay } from "@/lib/component-patterns";
import { useLocale } from "@/shared/i18n/locale-provider";
import {
  useCompactEditorSession,
  EditorDiscardConfirmation,
  editorConfirmationClass,
} from "@/shared/lib/use-compact-editor-session";
import { hasOrderEditRemoteConflict } from "@/features/orders/model/order-edit-conflict";

export function OrderIdentityEditor({
  group,
  returnFocusRef,
  scopeKey,
  initial,
  pending,
  canEdit,
  canEditRepair,
  onClose,
  onSave,
}: {
  returnFocusRef?: RefObject<HTMLElement | null>;
  group: "customer" | "device" | null;
  scopeKey: string;
  initial: UpdateOrderInput;
  pending: boolean;
  canEdit: boolean;
  canEditRepair: boolean;
  onClose: () => void;
  onSave: (baseline: UpdateOrderInput, draft: UpdateOrderInput) => Promise<unknown>;
}) {
  const { t } = useLocale();
  const session = useCompactEditorSession({
    open: Boolean(group),
    scopeKey: `${scopeKey}:${group}`,
    initial,
    busy: pending,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });
  const { draft, setDraft, baseline } = session;
  const conflict = hasOrderEditRemoteConflict({
    baselineUpdatedAt: baseline.expected_updated_at,
    currentUpdatedAt: initial.expected_updated_at,
    hasLocalChanges: session.dirty,
    isEditing: Boolean(group),
  });
  const valid =
    group === "customer"
      ? draft.customer_name.trim() && draft.customer_phone.trim()
      : draft.device_brand.trim() && draft.device_model.trim();
  const fields =
    group === "customer"
      ? ([
          ["customer_name", t("customers.form.name")],
          ["customer_phone", t("customers.form.phone")],
        ] as const)
      : ([
          ["device_brand", t("customers.form.brand")],
          ["device_model", t("customers.form.model")],
          ["device_imei", t("customers.form.serial")],
          ["device_notes", t("customers.form.deviceNotes")],
          ["accessory_notes", t("orders2b2.overview.accessories")],
        ] as const);
  return (
    <Dialog open={Boolean(group)} onOpenChange={session.requestClose}>
      <DialogContent
        mobileEditor
        onCloseAutoFocus={(event) => {
          if (returnFocusRef?.current?.isConnected) {
            event.preventDefault();
            returnFocusRef.current.focus({ preventScroll: true });
          }
        }}
        data-confirm-discard={session.confirmDiscard}
        closeLabel={t("common.cancel")}
        className={`${componentOverlay.formContent} ${componentOverlay.editorSurface} ${editorConfirmationClass}`}
      >
        <DialogHeader>
          <DialogTitle>
            {t(
              group === "customer"
                ? "orders2b2.overview.customerInfo"
                : "orders2b2.overview.deviceIssue",
            )}
          </DialogTitle>
          <DialogDescription>{t("orders.faultEditor.dirty")}</DialogDescription>
        </DialogHeader>
        {session.confirmDiscard ? (
          <EditorDiscardConfirmation
            returnFocus={session.returnFocus}
            keep={session.keep}
            discard={session.discard}
          />
        ) : null}
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {fields.map(([key, label]) => (
            <label key={key} className="grid min-w-0 gap-1 text-xs">
              {label}
              <Input
                className={componentOverlay.editorField}
                value={draft[key] ?? ""}
                disabled={pending || (key === "device_notes" ? !canEditRepair : !canEdit)}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
              />
            </label>
          ))}
        </div>
        {conflict || session.saveFailed ? (
          <p role="alert" className="text-sm text-destructive">
            {t(conflict ? "orders2b2.conflict.description" : "orders.faultEditor.errorState")}
          </p>
        ) : null}
        <DialogFooter className={componentOverlay.editorFooter}>
          <Button variant="outline" disabled={pending} onClick={() => session.requestClose(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={pending || !canEdit || !valid || !session.dirty || conflict}
            onClick={() =>
              void session.save(async (value) => {
                await onSave(baseline, value);
                onClose();
              })
            }
          >
            {t(pending ? "orders2b2.hero.saving" : "orders2b2.hero.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
