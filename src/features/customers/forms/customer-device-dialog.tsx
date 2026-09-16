"use client";

import { CustomerVersionNotice, useCustomerEditorSession } from "./use-customer-editor-session";

import { useRef, type RefObject } from "react";

import {
  EditorDiscardConfirmation,
  editorConfirmationClass,
} from "@/shared/lib/use-compact-editor-session";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CustomerFormField } from "@/features/customers/forms/customer-form-field";
import { componentOverlay } from "@/lib/component-patterns";
import type { CustomerDeviceInput, Device } from "@/lib/repairdesk/api";
import { useLocale } from "@/shared/i18n/locale-provider";

const compactInputClass = `${componentOverlay.editorField} h-11 lg:h-9 lg:text-sm`;

export function CustomerDeviceDialog({
  open,
  onOpenChange,
  device,
  busy,
  returnFocusRef,
  onSave,
  onRefresh,
}: {
  onRefresh?: () => void;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  device?: Device;
  busy: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onSave: (input: CustomerDeviceInput) => Promise<unknown>;
}) {
  const { t } = useLocale();
  const outsideDismissedRef = useRef(false);
  const session = useCustomerEditorSession<CustomerDeviceInput>({
    open,
    scopeKey: device?.id ?? "new",
    version: device ? device.updated_at : "new",
    initial: {
      ...(device
        ? { id: device.id, expected_updated_at: device.updated_at ?? "" }
        : { id: undefined, expected_updated_at: undefined }),
      brand: device?.brand ?? "",
      model: device?.model ?? "",
      serial_or_imei: device?.serial_or_imei ?? "",
      device_notes: device?.device_notes ?? "",
    },
    busy,
    onOpenChange,
    onRefresh,
  });
  const { draft: form, setDraft: setForm } = session;
  return (
    <Dialog open={open} onOpenChange={session.requestClose}>
      <DialogContent
        mobileEditor
        editorLayout
        data-confirm-discard={session.confirmDiscard}
        closeLabel={t("customers.detail.close")}
        className={`${componentOverlay.formContent} ${componentOverlay.editorSurface} ${componentOverlay.taskWorkspace} ${editorConfirmationClass}`}
        onPointerDownOutside={() => {
          outsideDismissedRef.current = true;
        }}
        onCloseAutoFocus={(event) => {
          if (outsideDismissedRef.current) {
            outsideDismissedRef.current = false;
            return;
          }
          const intendedOpener = returnFocusRef?.current;
          if (!intendedOpener?.isConnected || intendedOpener.getClientRects().length === 0) return;
          event.preventDefault();
          intendedOpener.focus({ preventScroll: true });
        }}
      >
        {session.confirmDiscard ? (
          <EditorDiscardConfirmation
            returnFocus={session.returnFocus}
            keep={session.keep}
            discard={session.discard}
          />
        ) : null}
        {session.saveFailed ? (
          <p role="alert" className="text-sm text-destructive">
            {t("orders.faultEditor.errorState")}
          </p>
        ) : null}
        <DialogHeader className={componentOverlay.editorHeader}>
          <DialogTitle className={componentOverlay.title}>
            {t(form.id ? "customers.form.editDeviceTitle" : "customers.form.addDeviceTitle")}
          </DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            {t("customers.form.deviceDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <CustomerVersionNotice
            blocked={session.blocked}
            conflict={session.conflict}
            reload={session.reload}
            busy={busy}
          />
          <div className="grid min-w-0 gap-2.5 sm:grid-cols-2">
            <CustomerFormField
              label={t("customers.form.brand")}
              required
              htmlFor="customer-device-brand"
            >
              <Input
                id="customer-device-brand"
                className={compactInputClass}
                value={form.brand}
                onChange={(event) => setForm({ ...form, brand: event.target.value })}
              />
            </CustomerFormField>
            <CustomerFormField
              label={t("customers.form.model")}
              required
              htmlFor="customer-device-model"
            >
              <Input
                id="customer-device-model"
                className={compactInputClass}
                value={form.model}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
              />
            </CustomerFormField>
            <CustomerFormField label={t("customers.form.serial")} htmlFor="customer-device-serial">
              <Input
                id="customer-device-serial"
                value={form.serial_or_imei ?? ""}
                onChange={(event) => setForm({ ...form, serial_or_imei: event.target.value })}
                className={`${compactInputClass} font-mono`}
              />
            </CustomerFormField>
            <CustomerFormField
              label={t("customers.form.deviceNotes")}
              htmlFor="customer-device-notes"
            >
              <Input
                id="customer-device-notes"
                className={compactInputClass}
                value={form.device_notes ?? ""}
                onChange={(event) => setForm({ ...form, device_notes: event.target.value })}
              />
            </CustomerFormField>
          </div>
        </DialogBody>
        <DialogFooter className={`${componentOverlay.footer} ${componentOverlay.editorFooter}`}>
          <Button
            className="min-h-11 whitespace-normal lg:min-h-9"
            variant="ghost"
            onClick={() => session.requestClose(false)}
          >
            {t("customers.form.cancel")}
          </Button>
          <Button
            disabled={busy || session.blocked || !form.brand.trim() || !form.model.trim()}
            className="min-h-11 whitespace-normal lg:min-h-9"
            onClick={() => void session.save(onSave)}
          >
            {busy ? t("customers.form.saving") : t("customers.form.saveDevice")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
