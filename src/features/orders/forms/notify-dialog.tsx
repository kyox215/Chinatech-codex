"use client";

import { useEffect, useState } from "react";
import type { CountryCode } from "libphonenumber-js/max";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StoreOutputIdentityRecovery } from "@/components/store/store-output-identity-recovery";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { componentOverlay } from "@/lib/component-patterns";
import type { OrderDetail, OrderWhatsappTemplateKind, OrderWorkflow } from "@/lib/repairdesk/api";
import { localizeWorkflowStatusLabel } from "@/features/orders/model/order-i18n";
import { getOrderDetailSafeErrorMessage } from "@/features/orders/model/order-detail-i18n";
import {
  buildOrderWhatsappMessage,
  buildWhatsAppUrl,
  getDefaultOrderWhatsappTemplateKind,
  getOrderWhatsappTransition,
  orderWhatsappTemplateOptions,
  replaceOrderWhatsappRecipientPhone,
} from "@/features/orders/model/order-message-templates";
import { getOrderContactPhoneOptions } from "@/features/orders/model/order-contact-phones";
import { isOrderCancelledForPayment } from "@/features/orders/model/order-payment-state";
import type { StoreOutputIdentity } from "@/entities/store/model/store-output-identity";
import { WhatsappRecipientEditor } from "@/shared/ui/whatsapp-recipient-editor";
import { inferWhatsappCountry, resolveWhatsappPhone } from "@/shared/lib/whatsapp-phone";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey } from "@/shared/i18n/messages";

const templateLabelKeys: Record<OrderWhatsappTemplateKind, MessageKey> = {
  approval_request: "orders2b2.notify.template.approval_request",
  pickup_ready: "orders2b2.notify.template.pickup_ready",
  unfixed_pickup: "orders2b2.notify.template.unfixed_pickup",
  parts_update: "orders2b2.notify.template.parts_update",
  repair_status: "orders2b2.notify.template.repair_status",
  cancelled: "orders2b2.notify.template.cancelled",
  completed: "orders2b2.notify.template.completed",
};

export function NotifyDialog({
  open,
  onOpenChange,
  data,
  workflow,
  orderUrl,
  storeIdentity,
  canReadStoreSettings,
  canUpdateStoreSettings,
  onRetryStoreSettings,
  onReloadStoreContext,
  busy,
  approvalQuoteReady = true,
  approvalQuoteBlockedReason,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: OrderDetail;
  workflow?: OrderWorkflow;
  orderUrl: string;
  storeIdentity: StoreOutputIdentity;
  canReadStoreSettings: boolean;
  canUpdateStoreSettings: boolean;
  onRetryStoreSettings?: () => void | Promise<unknown>;
  onReloadStoreContext?: () => void | Promise<unknown>;
  busy: boolean;
  approvalQuoteReady?: boolean;
  approvalQuoteBlockedReason?: string;
  onConfirm: (input: {
    idempotencyKey: string;
    body: string;
    templateKind: OrderWhatsappTemplateKind;
    recipientPhone?: string;
    transitionTo?: OrderDetail["order"]["status"];
  }) => Promise<unknown>;
}) {
  const { t } = useLocale();
  const cancelled = isOrderCancelledForPayment(data.order);
  const effectiveStatus = cancelled ? "cancelled" : data.order.status;
  const defaultKind = getDefaultOrderWhatsappTemplateKind(effectiveStatus);
  const templateOptions = cancelled
    ? orderWhatsappTemplateOptions.filter((option) => option.kind === "cancelled")
    : orderWhatsappTemplateOptions;
  const phoneOptions = getOrderContactPhoneOptions(data);
  const defaultPhone = phoneOptions[0] ?? "";
  const [templateKind, setTemplateKind] = useState<OrderWhatsappTemplateKind>(defaultKind);
  const [body, setBody] = useState(() =>
    buildOrderWhatsappMessage(data, defaultKind, orderUrl, {
      recipientPhone: defaultPhone,
      storeIdentity,
    }),
  );
  const [phone, setPhone] = useState(defaultPhone);
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(() =>
    inferWhatsappCountry(defaultPhone),
  );
  const [whatsappOpened, setWhatsappOpened] = useState(false);
  const [confirmationId, setConfirmationId] = useState(() => crypto.randomUUID());
  const [submitError, setSubmitError] = useState("");
  const phoneResolution = resolveWhatsappPhone(phone, phoneCountry);
  const canOpenWhatsApp = phoneResolution.valid;
  const transitionTo = getOrderWhatsappTransition(effectiveStatus, templateKind);
  const approvalQuoteBlocked = templateKind === "approval_request" && !approvalQuoteReady;

  useEffect(() => {
    if (!open) return;
    const nextKind = getDefaultOrderWhatsappTemplateKind(effectiveStatus);
    const nextPhone = getOrderContactPhoneOptions(data)[0] ?? "";
    setTemplateKind(nextKind);
    setBody(
      buildOrderWhatsappMessage(data, nextKind, orderUrl, {
        recipientPhone: nextPhone,
        storeIdentity,
      }),
    );
    setPhone(nextPhone);
    setPhoneCountry(inferWhatsappCountry(nextPhone));
    setWhatsappOpened(false);
    setConfirmationId(crypto.randomUUID());
    setSubmitError("");
  }, [data, effectiveStatus, open, orderUrl, storeIdentity]);

  const updateTemplate = (kind: OrderWhatsappTemplateKind) => {
    setTemplateKind(kind);
    setBody(
      buildOrderWhatsappMessage(data, kind, orderUrl, { recipientPhone: phone, storeIdentity }),
    );
    setWhatsappOpened(false);
    setConfirmationId(crypto.randomUUID());
    setSubmitError("");
  };

  const updatePhone = (nextPhone: string) => {
    setPhone(nextPhone);
    setBody((current) => replaceOrderWhatsappRecipientPhone(current, nextPhone));
    setWhatsappOpened(false);
    setConfirmationId(crypto.randomUUID());
    setSubmitError("");
  };

  const selectPhone = (nextPhone: string) => {
    setPhoneCountry(inferWhatsappCountry(nextPhone));
    updatePhone(nextPhone);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${componentOverlay.modalMd} grid max-h-[calc(100svh-24px)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0`}
      >
        <DialogHeader className="border-b border-[var(--border-panel)] px-4 py-3 text-left">
          <DialogTitle>{t("orders2b2.notify.title")}</DialogTitle>
          <DialogDescription className="text-xs">{t("orders2b2.notify.help")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 min-w-0 overflow-y-auto p-3 sm:p-4">
          <StoreOutputIdentityRecovery
            identity={storeIdentity}
            canReadSettings={canReadStoreSettings}
            canUpdateSettings={canUpdateStoreSettings}
            onRetrySettings={onRetryStoreSettings}
            onReloadStoreContext={onReloadStoreContext}
            openSettingsInNewTab
            className="mb-2"
          />
          <div className="grid min-w-0 gap-2 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-2 sm:grid-cols-[1fr_1.25fr]">
            <div className="min-w-0">
              <Label className="text-xs">{t("orders2b2.notify.type")}</Label>
              <Select
                value={templateKind}
                disabled={!storeIdentity.canOutput}
                onValueChange={(value) => updateTemplate(value as OrderWhatsappTemplateKind)}
              >
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templateOptions.map((option) => (
                    <SelectItem key={option.kind} value={option.kind}>
                      {t(templateLabelKeys[option.kind])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label className="text-xs">WhatsApp</Label>
              {phoneOptions.length > 1 ? (
                <Select
                  value={phone}
                  disabled={!storeIdentity.canOutput}
                  onValueChange={selectPhone}
                >
                  <SelectTrigger className="mt-1 h-8 font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {phoneOptions.map((option, index) => (
                      <SelectItem key={option} value={option}>
                        {index === 0 ? t("orders2b2.notify.primary") : t("orders2b2.notify.backup")}{" "}
                        · {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          </div>
          <div className="mt-2">
            <WhatsappRecipientEditor
              id="notify-whatsapp-phone"
              phone={phone}
              country={phoneCountry}
              disabled={!storeIdentity.canOutput}
              onPhoneChange={updatePhone}
              onCountryChange={(country, nextPhone) => {
                setPhoneCountry(country);
                updatePhone(nextPhone);
              }}
            />
          </div>
          {transitionTo && (
            <div className="mt-2 rounded-md border border-status-warn-foreground/20 bg-status-warn px-2 py-1.5 text-xs text-status-warn-foreground">
              {t("orders2b2.notify.transition", {
                status: localizeWorkflowStatusLabel(workflow, transitionTo, t),
              })}
            </div>
          )}
          {approvalQuoteBlocked ? (
            <div className="mt-2 rounded-md border border-status-danger-foreground/20 bg-status-danger/10 px-2 py-1.5 text-xs text-status-danger-foreground">
              {approvalQuoteBlockedReason || t("orders2b2.notify.quoteBlocked")}
            </div>
          ) : null}
          {whatsappOpened ? (
            <div
              aria-live="polite"
              className="mt-2 rounded-md border border-status-success-foreground/20 bg-status-success/10 px-2 py-1.5 text-xs text-status-success-foreground"
            >
              {t("orders2b2.notify.opened")}
            </div>
          ) : null}
          <div className="mt-2">
            <Label className="text-xs">{t("orders2b2.notify.body")}</Label>
            <Textarea
              aria-label={t("orders2b2.notify.body")}
              rows={10}
              value={body}
              disabled={!storeIdentity.canOutput}
              onChange={(e) => {
                setBody(e.target.value);
                setWhatsappOpened(false);
                setConfirmationId(crypto.randomUUID());
              }}
              className="mt-1 min-h-[260px] resize-none font-mono text-xs leading-relaxed"
            />
          </div>
          {submitError ? (
            <p role="alert" className="mt-2 text-xs text-status-danger-foreground">
              {submitError}
            </p>
          ) : null}
        </div>
        <DialogFooter className="border-t border-[var(--border-panel)] px-4 py-3 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          {whatsappOpened ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy || approvalQuoteBlocked || !canOpenWhatsApp}
              onClick={() => {
                const url = buildWhatsAppUrl(phone, body.trim());
                if (url) window.open(url, "_blank", "noopener,noreferrer");
              }}
            >
              {t("orders2b2.notify.reopen")}
            </Button>
          ) : null}
          <Button
            disabled={
              busy ||
              approvalQuoteBlocked ||
              !storeIdentity.canOutput ||
              !body.trim() ||
              !canOpenWhatsApp
            }
            onClick={async () => {
              if (!whatsappOpened) {
                const url = buildWhatsAppUrl(phone, body.trim());
                if (!url || !canOpenWhatsApp) {
                  toast.error(t("orders2b2.notify.invalidPhone"));
                  return;
                }
                const openedWindow = window.open(url, "_blank", "noopener,noreferrer");
                if (!openedWindow) {
                  toast.error(t("orders2b2.notify.popupBlocked"));
                  return;
                }
                setWhatsappOpened(true);
                return;
              }
              const url = buildWhatsAppUrl(phone, body.trim());
              if (!url || !canOpenWhatsApp) {
                toast.error(t("orders2b2.notify.invalidPhone"));
                return;
              }
              setSubmitError("");
              try {
                await onConfirm({
                  idempotencyKey: confirmationId,
                  body: body.trim(),
                  templateKind,
                  recipientPhone: phoneResolution.valid ? phoneResolution.e164 : undefined,
                  transitionTo,
                });
                onOpenChange(false);
              } catch (error) {
                setSubmitError(getOrderDetailSafeErrorMessage(error, "notification", t));
              }
            }}
          >
            <Send className="mr-1.5 size-3.5" />
            {busy
              ? t("orders2b2.notify.recording")
              : whatsappOpened
                ? t("orders2b2.notify.confirm")
                : t("orders2b2.notify.open")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
