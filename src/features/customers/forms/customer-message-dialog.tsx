"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { CustomerSegmented } from "@/features/customers/forms/customer-filters";
import type { CustomerDetail, CustomerMessageInput } from "@/lib/repairdesk/api";
import { normalizePhoneRaw } from "@/shared/lib/phone";

export function CustomerMessageDialog({
  open,
  onOpenChange,
  data,
  appOrigin,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  data: CustomerDetail;
  appOrigin: string;
  busy: boolean;
  onConfirm: (input: CustomerMessageInput) => Promise<unknown>;
}) {
  const [channel, setChannel] = useState<"whatsapp" | "sms">(
    data.customer.preferred_channel ?? "whatsapp",
  );
  const phoneOptions = customerPhoneOptions(data);
  const [phone, setPhone] = useState(phoneOptions[0] ?? "");
  const [body, setBody] = useState(() => buildCustomerMessage(data, appOrigin));
  useEffect(() => {
    if (open) {
      setChannel(data.customer.preferred_channel ?? "whatsapp");
      setPhone(customerPhoneOptions(data)[0] ?? "");
      setBody(buildCustomerMessage(data, appOrigin));
    }
  }, [data, open, appOrigin]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>预览客户消息</DialogTitle>
          <DialogDescription>
            客户可见内容使用意大利语。确认后打开对应通道并记录联系历史。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <CustomerSegmented
            value={channel}
            options={[
              ["whatsapp", "WhatsApp"],
              ["sms", "SMS"],
            ]}
            onChange={(value) => setChannel(value as "whatsapp" | "sms")}
          />
          {phoneOptions.length > 1 ? (
            <Select value={phone} onValueChange={setPhone}>
              <SelectTrigger className="font-mono text-xs">
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
            <div className="rounded-md border bg-surface-muted px-3 py-2 font-mono text-xs text-muted-foreground">
              {phone || "缺少电话号码"}
            </div>
          )}
          <Textarea
            rows={10}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="font-mono text-xs"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={busy || !body.trim()}
            onClick={async () => {
              const url =
                channel === "whatsapp"
                  ? whatsAppUrl(phone, body.trim())
                  : smsUrl(phone, body.trim());
              if (url) window.open(url, "_blank", "noopener,noreferrer");
              await onConfirm({ channel, body: body.trim() });
            }}
          >
            <Send className="mr-1.5 size-3.5" /> 确认并记录
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function customerPhoneOptions(data: CustomerDetail) {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const phone of [data.customer.phone_e164, ...data.customer.contact_phones]) {
    const trimmed = phone.trim();
    const raw = normalizePhoneRaw(trimmed);
    if (!trimmed || !raw || seen.has(raw)) continue;
    seen.add(raw);
    result.push(trimmed);
  }
  return result;
}

function buildCustomerMessage(data: CustomerDetail, appOrigin: string) {
  const { customer, orders, stats } = data;
  const latest = orders[0];
  return [
    `Gentile ${customer.name},`,
    "",
    "la contattiamo da ChinaTech per il servizio di assistenza.",
    latest ? `Ultimo ordine: ${latest.public_no} - ${latest.device_label}` : null,
    `Dispositivi registrati: ${stats.device_count}`,
    appOrigin ? `Area assistenza: ${appOrigin}/customers/${customer.id}` : null,
    "",
    "Restiamo a disposizione per qualsiasi necessità.",
    "Grazie,",
    "ChinaTech",
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
