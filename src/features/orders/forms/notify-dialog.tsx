"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

export interface NotifyIntent {
  orderId: string;
  idempotencyKey: string;
  expectedUpdatedAt: string;
  quoteEventId: string | null;
  body: string;
  templateKind: OrderWhatsappTemplateKind;
  recipientPhone?: string;
  transitionTo?: OrderDetail["order"]["status"];
}

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
  onReloadLatest,
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
  onReloadLatest?: () => Promise<OrderDetail>;
  busy: boolean;
  approvalQuoteReady?: boolean;
  approvalQuoteBlockedReason?: string;
  onConfirm: (input: NotifyIntent) => Promise<unknown>;
}) {
  const { t } = useLocale();
  const [snapshot, setSnapshot] = useState(() => ({
    data,
    orderUrl,
    storeIdentity,
    approvalQuoteReady,
  }));
  const cancelled = isOrderCancelledForPayment(snapshot.data.order);
  const effectiveStatus = cancelled ? "cancelled" : snapshot.data.order.status;
  const defaultKind = getDefaultOrderWhatsappTemplateKind(effectiveStatus);
  const templateOptions = cancelled
    ? orderWhatsappTemplateOptions.filter((option) => option.kind === "cancelled")
    : orderWhatsappTemplateOptions;
  const phoneOptions = getOrderContactPhoneOptions(snapshot.data);
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
  const [conflictCode, setConflictCode] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [dirty, setDirty] = useState(false);
  const intentRef = useRef<NotifyIntent | null>(null);
  const openedRef = useRef(false);
  const scopeRef = useRef(data.order.id);
  const phoneResolution = resolveWhatsappPhone(phone, phoneCountry);
  const canOpenWhatsApp = phoneResolution.valid;
  const bodyLimit = templateKind === "approval_request" ? 8000 : 10000;
  const bodyTooLong = body.trim().length > bodyLimit;
  const transitionTo = getOrderWhatsappTransition(effectiveStatus, templateKind);
  const approvalQuoteBlocked = templateKind === "approval_request" && !snapshot.approvalQuoteReady;
  const version = snapshot.data.order.updated_at;
  const missingVersion = !version || !Number.isFinite(Date.parse(version));
  const changed =
    data.order.id !== snapshot.data.order.id ||
    data.order.updated_at !== version ||
    (data.latest_quote_event_id ?? null) !== (snapshot.data.latest_quote_event_id ?? null);
  const identityChanged =
    snapshot.storeIdentity.storeName !== storeIdentity.storeName ||
    snapshot.storeIdentity.messageSignature !== storeIdentity.messageSignature ||
    snapshot.storeIdentity.canOutput !== storeIdentity.canOutput ||
    snapshot.orderUrl !== orderUrl;
  const conflict = Boolean(conflictCode) || (changed && !attempted);
  const pending = busy || submitting || refreshing;
  const fieldsLocked = pending || whatsappOpened || attempted || !storeIdentity.canOutput;

  const resetSession = useCallback(
    (next: OrderDetail) => {
      const kind = getDefaultOrderWhatsappTemplateKind(
        isOrderCancelledForPayment(next.order) ? "cancelled" : next.order.status,
      );
      const nextPhone = getOrderContactPhoneOptions(next)[0] ?? "";
      setSnapshot({
        data: next,
        orderUrl,
        storeIdentity,
        approvalQuoteReady: next.capabilities
          ? Boolean(
              next.capabilities.canSendQuote &&
              next.latest_quote_event_id &&
              next.order.status === "quoted",
            )
          : approvalQuoteReady,
      });
      setTemplateKind(kind);
      setBody(
        buildOrderWhatsappMessage(next, kind, orderUrl, {
          recipientPhone: nextPhone,
          storeIdentity,
        }),
      );
      setPhone(nextPhone);
      setPhoneCountry(inferWhatsappCountry(nextPhone));
      setWhatsappOpened(false);
      setConfirmationId(crypto.randomUUID());
      setSubmitError("");
      setConflictCode(null);
      setAttempted(false);
      setDirty(false);
      intentRef.current = null;
    },
    [orderUrl, storeIdentity, approvalQuoteReady],
  );

  useEffect(() => {
    if (!open) {
      openedRef.current = false;
      return;
    }
    const scope = data.order.id;
    if (scopeRef.current !== scope) {
      scopeRef.current = scope;
      intentRef.current = null;
      openedRef.current = false;
    }
    if (openedRef.current) return;
    openedRef.current = true;
    // A closed, uncertain attempt resumes the identical request, never a newer order version.
    if (intentRef.current) return;
    resetSession(data);
  }, [open, data, resetSession]);

  useEffect(() => {
    if (!open || attempted || (!changed && !identityChanged)) return;
    if (!dirty && !whatsappOpened) resetSession(data);
    else setConflictCode((current) => current ?? "remote_changed");
  }, [open, attempted, changed, identityChanged, dirty, whatsappOpened, resetSession, data]);

  const reloadLatest = async () => {
    if (pending || (attempted && !conflictCode)) return;
    setRefreshing(true);
    try {
      const next = onReloadLatest ? await onReloadLatest() : data;
      if (conflictCode === "stale_version" && next.order.updated_at === version) return;
      resetSession(next);
    } catch (error) {
      setSubmitError(getOrderDetailSafeErrorMessage(error, "notification", t));
    } finally {
      setRefreshing(false);
    }
  };

  const updateTemplate = (kind: OrderWhatsappTemplateKind) => {
    setDirty(true);
    setTemplateKind(kind);
    setBody(
      buildOrderWhatsappMessage(snapshot.data, kind, snapshot.orderUrl, {
        recipientPhone: phone,
        storeIdentity: snapshot.storeIdentity,
      }),
    );
    setWhatsappOpened(false);
    setConfirmationId(crypto.randomUUID());
    setSubmitError("");
  };

  const updatePhone = (nextPhone: string) => {
    setDirty(true);
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
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
                disabled={fieldsLocked}
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
                <Select value={phone} disabled={fieldsLocked} onValueChange={selectPhone}>
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
              disabled={fieldsLocked}
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
          {conflict || missingVersion || whatsappOpened ? (
            <div
              className="mt-2 rounded-md border border-[var(--border-panel)] p-2 text-xs"
              aria-live="polite"
            >
              <p>
                {t(
                  attempted && !conflictCode
                    ? "orders2b2.notify.retryIntent"
                    : missingVersion
                      ? "orders2b2.notify.versionRequired"
                      : "orders2b2.notify.frozenIntent",
                )}
              </p>
              {!attempted || conflictCode ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={pending}
                  onClick={reloadLatest}
                >
                  {t("orders2b2.conflict.reload")}
                </Button>
              ) : null}
            </div>
          ) : null}
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
              maxLength={bodyLimit}
              value={body}
              disabled={fieldsLocked}
              onChange={(e) => {
                setDirty(true);
                setBody(e.target.value);
                setWhatsappOpened(false);
                setConfirmationId(crypto.randomUUID());
              }}
              className="mt-1 min-h-[260px] resize-none font-mono text-xs leading-relaxed"
            />
          </div>
          {bodyTooLong ? (
            <p role="alert" className="mt-2 text-xs text-status-danger-foreground">
              {t("orders2b2.notify.tooLong", { limit: bodyLimit })}
            </p>
          ) : null}
          {submitError ? (
            <p role="alert" className="mt-2 text-xs text-status-danger-foreground">
              {submitError}
            </p>
          ) : null}
        </div>
        <DialogFooter className="border-t border-[var(--border-panel)] px-4 py-3 sm:gap-2">
          <Button variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          {whatsappOpened ? (
            <Button
              type="button"
              variant="outline"
              disabled={
                pending || approvalQuoteBlocked || conflict || missingVersion || !canOpenWhatsApp
              }
              onClick={() => {
                const url = buildWhatsAppUrl(phone, body.trim());
                try {
                  if (url) window.open(url, "_blank", "noopener,noreferrer");
                } catch {
                  toast.error(t("orders2b2.notify.popupBlocked"));
                }
              }}
            >
              {t("orders2b2.notify.reopen")}
            </Button>
          ) : null}
          <Button
            disabled={
              pending ||
              conflict ||
              missingVersion ||
              approvalQuoteBlocked ||
              !storeIdentity.canOutput ||
              !body.trim() ||
              bodyTooLong ||
              !canOpenWhatsApp
            }
            onClick={async () => {
              if (pending || conflict || missingVersion || bodyTooLong) return;
              if (!whatsappOpened) {
                const url = buildWhatsAppUrl(phone, body.trim());
                if (!url || !canOpenWhatsApp) {
                  toast.error(t("orders2b2.notify.invalidPhone"));
                  return;
                }
                try {
                  // noopener intentionally returns null even when a new tab opens.
                  // Recording still requires the user's separate confirmation of actual sending.
                  window.open(url, "_blank", "noopener,noreferrer");
                } catch {
                  toast.error(t("orders2b2.notify.popupBlocked"));
                  return;
                }
                intentRef.current = {
                  orderId: snapshot.data.order.id,
                  idempotencyKey: confirmationId,
                  expectedUpdatedAt: version,
                  quoteEventId: snapshot.data.latest_quote_event_id ?? null,
                  body: body.trim(),
                  templateKind,
                  recipientPhone: phoneResolution.valid ? phoneResolution.e164 : undefined,
                  transitionTo,
                };
                setWhatsappOpened(true);
                return;
              }
              const url = buildWhatsAppUrl(phone, body.trim());
              if (!url || !canOpenWhatsApp) {
                toast.error(t("orders2b2.notify.invalidPhone"));
                return;
              }
              const intent = intentRef.current;
              if (!intent) return;
              setSubmitError("");
              setSubmitting(true);
              setAttempted(true);
              try {
                await onConfirm(intent);
                intentRef.current = null;
                onOpenChange(false);
              } catch (error) {
                const failure = error as { status?: number; code?: string };
                if (
                  failure?.status !== undefined &&
                  failure.status >= 400 &&
                  failure.status < 500 &&
                  ![408, 429].includes(failure.status)
                ) {
                  setConflictCode(failure.code ?? "conflict");
                  void onReloadLatest?.().catch(() => undefined);
                }
                setSubmitError(getOrderDetailSafeErrorMessage(error, "notification", t));
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <Send className="mr-1.5 size-3.5" />
            {pending
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
