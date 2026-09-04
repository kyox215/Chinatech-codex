"use client";

import { Copy, MessageSquare, Phone, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { PhoneText } from "@/components/orders/badges";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { buildWhatsappUrl } from "@/shared/lib/whatsapp-phone";
import { useLocale } from "@/shared/i18n/locale-provider";

export function PhoneContactMenu({
  phone,
  className,
  compact = false,
}: {
  phone?: string | null;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useLocale();
  const normalized = phone?.trim() ?? "";
  if (!normalized) return <span className="text-muted-foreground">—</span>;
  const whatsappHref = buildWhatsappUrl(normalized);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-w-0 items-center gap-1.5 rounded-md text-left font-mono text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:ring-1 focus-visible:ring-ring",
            className,
          )}
          title={t("orders2b2.contact.title")}
        >
          <Phone className="size-3 shrink-0" />
          <PhoneText value={normalized} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(16rem,calc(100vw-24px))] p-2">
        <div className="mb-2 min-w-0 px-1">
          <div className="text-[11px] font-medium text-muted-foreground">
            {t("orders2b2.contact.title")}
          </div>
          <div className="truncate font-mono text-sm" title={normalized}>
            {normalized}
          </div>
        </div>
        <div className="grid gap-1">
          <Button asChild variant="ghost" size="sm" className="justify-start gap-2">
            <a href={`tel:${normalized}`}>
              <Phone className="size-3.5" /> {t("orders2b2.contact.call")}
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm" className="justify-start gap-2">
            <a href={`sms:${normalized}`}>
              <Smartphone className="size-3.5" /> {t("orders2b2.contact.sms")}
            </a>
          </Button>
          <Button
            asChild={Boolean(whatsappHref)}
            variant="ghost"
            size="sm"
            className="justify-start gap-2"
            disabled={!whatsappHref}
          >
            {whatsappHref ? (
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                <MessageSquare className="size-3.5" /> WhatsApp
              </a>
            ) : (
              <span>
                <MessageSquare className="size-3.5" />
                {t("orders2b2.contact.invalidWhatsapp")}
              </span>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start gap-2"
            onClick={async () => {
              try {
                await navigator.clipboard?.writeText(normalized);
                toast.success(t("orders2b2.contact.copied"));
              } catch {
                toast.error(t("orders2b2.contact.copyFailed"));
              }
            }}
          >
            <Copy className="size-3.5" /> {t("orders2b2.contact.copy")}
          </Button>
        </div>
        {compact && <div className="sr-only">{t("orders2b2.contact.menu")}</div>}
      </PopoverContent>
    </Popover>
  );
}
