"use client";

import { useEffect, useState } from "react";
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

const customerMessageChannels = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
] as const;

const compactControlClass = "h-8 text-sm sm:h-9";

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
  const [channel, setChannel] = useState<"whatsapp" | "sms">(
    data.customer.preferred_channel ?? "whatsapp",
  );
  const phoneOptions = customerPhoneOptions(data);
  const [phone, setPhone] = useState(phoneOptions[0] ?? "");
  const [body, setBody] = useState(() => buildCustomerMessage(data, appOrigin, storeIdentity));
  const [channelOpened, setChannelOpened] = useState(false);
  const [channelOpenError, setChannelOpenError] = useState(false);
  useEffect(() => {
    if (open) {
      setChannel(data.customer.preferred_channel ?? "whatsapp");
      setPhone(customerPhoneOptions(data)[0] ?? "");
      setBody(buildCustomerMessage(data, appOrigin, storeIdentity));
      setChannelOpened(false);
      setChannelOpenError(false);
    }
  }, [data, open, appOrigin, storeIdentity]);
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setChannelOpened(false);
        if (!nextOpen) setChannelOpenError(false);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className={componentOverlay.formContent}>
        <DialogHeader className={componentOverlay.header}>
          <DialogTitle className={componentOverlay.title}>给客户发消息</DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            第一步打开发送软件；实际发出后，再回来记录联系结果。
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
                setPhone(value);
                setChannelOpened(false);
                setChannelOpenError(false);
              }}
            >
              <SelectTrigger className="h-8 min-w-0 font-mono text-xs sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {phoneOptions.map((option, index) => (
                  <SelectItem key={option} value={option}>
                    {index === 0 ? "主号码" : "备用号码"} · {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex h-8 items-center truncate rounded-md border border-[var(--border-panel)] bg-surface-muted px-3 font-mono text-xs text-muted-foreground sm:h-9">
              {phone || "缺少电话号码"}
            </div>
          )}
          <Textarea
            aria-label="客户消息内容"
            value={body}
            disabled={!storeIdentity.canOutput}
            onChange={(event) => {
              setBody(event.target.value);
              setChannelOpened(false);
              setChannelOpenError(false);
            }}
            className="min-h-56 font-mono text-xs leading-relaxed sm:min-h-64"
          />
          {channelOpened ? (
            <p
              role="status"
              className="rounded-lg bg-status-success/10 px-3 py-2 text-xs text-status-success-foreground"
            >
              发送软件已打开。请确认消息真的发出后，再点击“我已发送”。
            </p>
          ) : null}
          {channelOpenError ? (
            <p
              role="alert"
              className="rounded-lg bg-status-warn/10 px-3 py-2 text-xs text-status-warn-foreground"
            >
              没有打开发送软件。请允许浏览器弹窗后，再点一次“打开”。
            </p>
          ) : null}
        </div>
        <DialogFooter className={componentOverlay.footer}>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          {channelOpened ? (
            <Button disabled={busy} onClick={() => onConfirm({ channel, body: body.trim() })}>
              <Check className="mr-1.5 size-3.5" /> 我已发送，记录联系
            </Button>
          ) : (
            <Button
              disabled={busy || !storeIdentity.canOutput || !phone || !body.trim()}
              onClick={() => {
                const url =
                  channel === "whatsapp"
                    ? whatsAppUrl(phone, body.trim())
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
              <ExternalLink className="mr-1.5 size-3.5" /> 打开
              {channel === "whatsapp" ? " WhatsApp" : "短信"}
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

function whatsAppUrl(phone: string, body: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

function smsUrl(phone: string, body: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return "";
  return `sms:${digits}?body=${encodeURIComponent(body)}`;
}
