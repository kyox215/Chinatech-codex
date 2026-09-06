"use client";

import { useId, useRef, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ImeiScannerField } from "@/components/imei-scanner-field";
import { PhoneKeypadInput } from "@/components/orders/phone-keypad-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AccessoryNotesPicker } from "@/features/orders/components/accessory-notes-picker";
import { DenseOptionMenu } from "@/features/orders/components/dense-option-menu";
import { CustomerIdentityReview } from "@/features/orders/forms/customer-intake-lookup";
import {
  brandSuggestions,
  deviceModelSuggestionsForBrand,
} from "@/features/orders/model/new-order-form";
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
  customerId = "",
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
  customerId?: string;
  onClose: () => void;
  onSave: (baseline: UpdateOrderInput, draft: UpdateOrderInput) => Promise<unknown>;
}) {
  const { t } = useLocale();
  const id = useId();
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
  const latest = useRef({ pending, canEdit, canEditRepair });
  latest.current = { pending, canEdit, canEditRepair };
  const setField = (key: keyof UpdateOrderInput, value: string) => {
    const state = latest.current;
    if (state.pending || (key === "device_notes" ? !state.canEditRepair : !state.canEdit)) return;
    setDraft((current) => ({ ...current, [key]: value }));
  };
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
  const fieldClass = `${componentOverlay.editorField} h-11 lg:h-9`;
  return (
    <Dialog open={Boolean(group)} onOpenChange={session.requestClose}>
      <DialogContent
        mobileEditor
        editorLayout
        data-order-identity-editor={group ?? undefined}
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
        <DialogHeader className={componentOverlay.editorHeader}>
          <DialogTitle>
            {t(
              group === "customer" ? "orders2b2.overview.customerInfo" : "orders2b1.new.deviceInfo",
            )}
          </DialogTitle>
          <DialogDescription className={session.dirty ? undefined : "sr-only"}>
            {t(session.dirty ? "orders.faultEditor.dirty" : "orders.faultEditor.unchanged")}
          </DialogDescription>
        </DialogHeader>
        {session.confirmDiscard ? (
          <EditorDiscardConfirmation
            returnFocus={session.returnFocus}
            keep={session.keep}
            discard={session.discard}
          />
        ) : null}
        <DialogBody>
          {group === "customer" ? (
            <div className="grid min-w-0 gap-3">
              <label className="grid min-w-0 gap-1 text-xs">
                {t("customers.form.phone")}
                <PhoneKeypadInput
                  preserveFormatting
                  ariaLabel={t("customers.form.phone")}
                  value={draft.customer_phone}
                  onChange={(value) => setField("customer_phone", value)}
                  disabled={!canEdit || pending}
                  className={fieldClass}
                />
              </label>
              <label className="grid min-w-0 gap-1 text-xs">
                {t("customers.form.name")}
                <Input
                  value={draft.customer_name}
                  disabled={!canEdit || pending}
                  className={fieldClass}
                  onChange={(event) => setField("customer_name", event.target.value)}
                />
              </label>
              <CustomerIdentityReview
                phone={draft.customer_phone}
                customerId={customerId}
                enabled={Boolean(group === "customer" && canEdit && !pending)}
              />
            </div>
          ) : (
            <div className="grid min-w-0 gap-3">
              <div className="grid min-w-0 grid-cols-2 gap-2">
                {(["device_brand", "device_model"] as const).map((key) => (
                  <div key={key} className="min-w-0 space-y-1">
                    <label htmlFor={`${id}-${key}`} className="text-xs">
                      {t(key === "device_brand" ? "customers.form.brand" : "customers.form.model")}
                    </label>
                    <div className="relative min-w-0">
                      <Input
                        id={`${id}-${key}`}
                        value={draft[key]}
                        disabled={!canEdit || pending}
                        className={`${fieldClass} pr-9`}
                        onChange={(event) => setField(key, event.target.value)}
                      />
                      <span className="absolute right-1 top-1/2 -translate-y-1/2">
                        <DenseOptionMenu
                          label={t(
                            key === "device_brand"
                              ? "customers.form.brand"
                              : "customers.form.model",
                          )}
                          value={draft[key]}
                          options={
                            key === "device_brand"
                              ? brandSuggestions
                              : deviceModelSuggestionsForBrand(draft.device_brand)
                          }
                          disabled={!canEdit || pending}
                          onSelect={(value) => setField(key, value)}
                        />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="min-w-0 space-y-1">
                <label htmlFor={`${id}-imei`} className="text-xs">
                  {t("customers.form.serial")}
                </label>
                <ImeiScannerField
                  value={draft.device_imei ?? ""}
                  onChange={(value) => setField("device_imei", value)}
                  inputId={`${id}-imei`}
                  inputAriaLabel={t("customers.form.serial")}
                  identifierLabel="IMEI"
                  density="compact"
                  showPaste={false}
                  disabled={!canEdit || pending}
                />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs">{t("orders2b2.overview.accessories")}</p>
                <AccessoryNotesPicker
                  value={draft.accessory_notes}
                  onChange={(value) => setField("accessory_notes", value)}
                  disabled={!canEdit || pending}
                  triggerClassName={`w-full ${fieldClass}`}
                />
              </div>
              <label className="grid min-w-0 gap-1 text-xs">
                {t("customers.form.deviceNotes")}
                <Textarea
                  value={draft.device_notes ?? ""}
                  disabled={!canEditRepair || pending}
                  onChange={(event) => setField("device_notes", event.target.value)}
                  className={`${componentOverlay.editorField} min-h-20`}
                />
              </label>
            </div>
          )}
          {conflict || session.saveFailed ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {t(conflict ? "orders2b2.conflict.description" : "orders.faultEditor.errorState")}
            </p>
          ) : null}
        </DialogBody>
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
