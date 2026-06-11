"use client";

import { Copy, MessageSquare, Phone, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { PhoneText } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function digitsOnly(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("00") ? digits.slice(2) : digits;
}

export function PhoneContactMenu({
  phone,
  className,
  compact = false,
}: {
  phone?: string | null;
  className?: string;
  compact?: boolean;
}) {
  const normalized = phone?.trim() ?? "";
  if (!normalized) return <span className="text-muted-foreground">—</span>;
  const whatsapp = digitsOnly(normalized);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-w-0 items-center gap-1.5 rounded-md text-left font-mono text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:ring-1 focus-visible:ring-ring",
            className,
          )}
          title="联系客户"
        >
          <Phone className="size-3 shrink-0" />
          <PhoneText value={normalized} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(16rem,calc(100vw-24px))] p-2">
        <div className="mb-2 min-w-0 px-1">
          <div className="text-[11px] font-medium text-muted-foreground">联系客户</div>
          <div className="truncate font-mono text-sm" title={normalized}>
            {normalized}
          </div>
        </div>
        <div className="grid gap-1">
          <Button asChild variant="ghost" size="sm" className="justify-start gap-2">
            <a href={`tel:${normalized}`}>
              <Phone className="size-3.5" /> 拨打电话
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm" className="justify-start gap-2">
            <a href={`sms:${normalized}`}>
              <Smartphone className="size-3.5" /> 发送短信
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm" className="justify-start gap-2">
            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
              <MessageSquare className="size-3.5" /> WhatsApp
            </a>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start gap-2"
            onClick={async () => {
              await navigator.clipboard?.writeText(normalized);
              toast.success("号码已复制");
            }}
          >
            <Copy className="size-3.5" /> 复制号码
          </Button>
        </div>
        {compact && <div className="sr-only">电话快捷联系菜单</div>}
      </PopoverContent>
    </Popover>
  );
}
