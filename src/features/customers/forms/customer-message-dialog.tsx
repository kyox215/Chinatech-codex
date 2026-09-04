"use client";

import { useEffect, useState } from "react";
import type { CountryCode } from "libphonenumber-js/max";
import { Check, ExternalLink } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { componentOverlay } from "@/lib/component-patterns";
import type { CustomerDetail, CustomerMessageInput } from "@/lib/repairdesk/api";
import { normalizePhoneRaw, uniqueContactPhones } from "@/shared/lib/phone";
import type { StoreOutputIdentity } from "@/entities/store/model/store-output-identity";
import { WhatsappRecipientEditor } from "@/shared/ui/whatsapp-recipient-editor";
import {
  buildWhatsappUrl,
  inferWhatsappCountry,
  resolveWhatsappPhone,
} from "@/shared/lib/whatsapp-phone";
import { useLocale } from "@/shared/i18n/locale-provider";

const customerMessageChannels = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
] as const;

const compactControlClass = "h-11 text-base lg:h-9 lg:text-sm";

export function CustomerMessageDialog({
  open,
  onOpenChange,
  data,
  appOrigin,
  storeIdentity,
  canReadStoreSettings,
  canUpdateStoreSettings,
  onRetryStoreSettings,
  onReloadStoreContext,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data: CustomerDetail;
  appOrigin: string;
  storeIdentity: StoreOutputIdentity;
  canReadStoreSettings: boolean;
  canUpdateStoreSettings: boolean;
  onRetryStoreSettings?: () => void | Promise<unknown>;
  onReloadStoreContext?: () => void | Promise<unknown>;
  busy: boolean;
  onConfirm: (input: CustomerMessageInput) => Promise<unknown>;
}) {
  const { t } = useLocale();
  const [channel, setChannel] = useState<"whatsapp" | "sms">(
    data.customer.preferred_channel ?? "whatsapp",
  );
  const phoneOptions = customerPhoneOptions(data);
  const [phone, setPhone] = useState(phoneOptions[0] ?? "");
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(() =>
    inferWhatsappCountry(phoneOptions[0] ?? ""),
  );
  const [body, setBody] = useState(() => buildCustomerMessage(data, appOrigin, storeIdentity));
  const [channelOpened, setChannelOpened] = useState(false);
  const [channelOpenError, setChannelOpenError] = useState(false);
  useEffect(() => {
    if (open) {
      setChannel(data.customer.preferred_channel ?? "whatsapp");
      setPhone(customerPhoneOptions(data)[0] ?? "");
      setPhoneCountry(inferWhatsappCountry(customerPhoneOptions(data)[0] ?? ""));
      setBody(buildCustomerMessage(data, appOrigin, storeIdentity));
      setChannelOpened(false);
      setChannelOpenError(false);
    }
  }, [data, open, appOrigin, storeIdentity]);
  const phoneResolution = resolveWhatsappPhone(phone, phoneCountry);
  const updatePhone = (nextPhone: string) => {
    setPhone(nextPhone);
    setChannelOpened(false);
    setChannelOpenError(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setChannelOpened(false);
        if (!nextOpen) setChannelOpenError(false);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        closeLabel={t("customers.detail.close")}
        className={componentOverlay.formContent}
      >
        <DialogHeader className={componentOverlay.header}>
          <DialogTitle className={componentOverlay.title}>
            {t("customers.message.title")}
          </DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            {t("customers.message.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-2.5">
          <StoreOutputIdentityRecovery
            identity={storeIdentity}
            canReadSettings={canReadStoreSettings}
            canUpdateSettings={canUpdateStoreSettings}
            onRetrySettings={onRetryStoreSettings}
            onReloadStoreContext={onReloadStoreContext}
            openSettingsInNewTab
          />
          <Select
            value={channel}
            disabled={!storeIdentity.canOutput}
            onValueChange={(value) => {
              setChannel(value as "whatsapp" | "sms");
              setChannelOpened(false);
              setChannelOpenError(false);
            }}
          >
            <SelectTrigger className={compactControlClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {customerMessageChannels.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {phoneOptions.length > 1 ? (
            <Select
              value={phone}
              disabled={!storeIdentity.canOutput}
              onValueChange={(value) => {
                setPhoneCountry(inferWhatsappCountry(value));
                updatePhone(value);
              }}
            >
              <SelectTrigger className="h-11 min-w-0 font-mono text-base lg:h-9 lg:text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {phoneOptions.map((option, index) => (
                  <SelectItem key={option} value={option}>
                    {t(
                      index === 0
                        ? "customers.message.primaryPhone"
                        : "customers.message.backupPhone",
                    )}{" "}
                    · {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : channel === "sms" ? (
            <div className="flex h-11 items-center truncate rounded-md border border-[var(--border-panel)] bg-surface-muted px-3 font-mono text-base text-muted-foreground lg:h-9 lg:text-xs">
              {phone || t("customers.message.missingPhone")}
            </div>
          ) : null}
          {channel === "whatsapp" ? (
            <WhatsappRecipientEditor
              id="customer-message-whatsapp-phone"
              phone={phone}
              country={phoneCountry}
              disabled={!storeIdentity.canOutput}
              onPhoneChange={updatePhone}
              onCountryChange={(country, nextPhone) => {
                setPhoneCountry(country);
                updatePhone(nextPhone);
              }}
            />
          ) : null}
          <Textarea
            aria-label={t("customers.message.bodyLabel")}
            value={body}
            disabled={!storeIdentity.canOutput}
            onChange={(event) => {
              setBody(event.target.value);
              setChannelOpened(false);
              setChannelOpenError(false);
            }}
            className="min-h-56 font-mono text-base leading-relaxed sm:min-h-64 lg:text-xs"
          />
          {channelOpened ? (
            <p
              role="status"
              className="rounded-lg bg-status-success/10 px-3 py-2 text-xs text-status-success-foreground"
            >
              {t("customers.message.opened")}
            </p>
          ) : null}
          {channelOpenError ? (
            <p
              role="alert"
              className="rounded-lg bg-status-warn/10 px-3 py-2 text-xs text-status-warn-foreground"
            >
              {t("customers.message.openFailed")}
            </p>
          ) : null}
        </div>
        <DialogFooter className={componentOverlay.footer}>
          <Button
            className="min-h-11 whitespace-normal lg:min-h-9"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {t("customers.form.cancel")}
          </Button>
          {channelOpened ? (
            <Button
              disabled={busy}
              className="min-h-11 whitespace-normal lg:min-h-9"
              onClick={() =>
                void onConfirm({
                  channel,
                  body: body.trim(),
                  recipient_phone:
                    channel === "whatsapp" && phoneResolution.valid
                      ? phoneResolution.e164
                      : undefined,
                }).catch(() => undefined)
              }
            >
              <Check className="mr-1.5 size-3.5" /> {t("customers.message.confirm")}
            </Button>
          ) : (
            <Button
              disabled={
                busy ||
                !storeIdentity.canOutput ||
                !body.trim() ||
                (channel === "whatsapp" ? !phoneResolution.valid : !phone)
              }
              onClick={() => {
                const url =
                  channel === "whatsapp"
                    ? buildWhatsappUrl(phone, body.trim(), phoneCountry)
                    : smsUrl(phone, body.trim());
                if (!url) return;
                const opened = window.open(url, "_blank");
                if (!opened) {
                  setChannelOpenError(true);
                  return;
                }
                opened.opener = null;
                setChannelOpenError(false);
                setChannelOpened(true);
              }}
            >
              <ExternalLink className="mr-1.5 size-3.5" /> {t("customers.message.open")}
              {channel === "whatsapp" ? " WhatsApp" : ` ${t("customers.channel.sms")}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function customerPhoneOptions(data: CustomerDetail) {
  const result: string[] = [];
  const seen = new Set<string>();
  const backupPhones = uniqueContactPhones(data.customer.phone_e164, data.customer.contact_phones);
  for (const phone of [data.customer.phone_e164, ...backupPhones]) {
    const trimmed = phone.trim();
    const raw = normalizePhoneRaw(trimmed);
    if (!trimmed || !raw || seen.has(raw)) continue;
    seen.add(raw);
    result.push(trimmed);
  }
  return result;
}

export function buildCustomerMessage(
  data: CustomerDetail,
  _appOrigin: string,
  storeIdentity: Pick<StoreOutputIdentity, "storeName" | "messageSignature">,
) {
  const { customer, orders, stats } = data;
  const latest = orders[0];
  return [
    `Gentile ${customer.name},`,
    "",
    storeIdentity.storeName
      ? `la contattiamo da ${storeIdentity.storeName} per il servizio di assistenza.`
      : "la contattiamo per il servizio di assistenza.",
    latest ? `Ultimo ordine: ${latest.public_no} - ${latest.device_label}` : null,
    `Dispositivi registrati: ${stats.device_count}`,
    "",
    "Restiamo a disposizione per qualsiasi necessità.",
    "Grazie,",
    storeIdentity.messageSignature || null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function smsUrl(phone: string, body: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return "";
  return `sms:${digits}?body=${encodeURIComponent(body)}`;
}
