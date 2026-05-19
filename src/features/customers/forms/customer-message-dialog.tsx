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
import { Textarea } from "@/components/ui/textarea";
import { CustomerSegmented } from "@/features/customers/forms/customer-filters";
import type { CustomerDetail, CustomerMessageInput } from "@/lib/repairdesk/api";

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
  const [body, setBody] = useState(() => buildCustomerMessage(data, appOrigin));
  useEffect(() => {
    if (open) {
      setChannel(data.customer.preferred_channel ?? "whatsapp");
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
                  ? whatsAppUrl(data.customer.phone_e164, body.trim())
                  : smsUrl(data.customer.phone_e164, body.trim());
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
