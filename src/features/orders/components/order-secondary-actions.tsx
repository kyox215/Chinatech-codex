"use client";

import { MoreHorizontal, Pencil, Printer, QrCode, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/shared/i18n/locale-provider";
import { cn } from "@/lib/utils";

/** Presentation-only secondary actions; authorization and effects remain supplied by the host. */
export function OrderSecondaryActions({
  onPrint,
  printDisabled,
  printDisabledReason,
  printPending,
  onRevokeCustomerStatusLinks,
  customerStatusRevokePending,
  onCancel,
  canCancel,
  onEdit,
  disabled = false,
  className,
}: {
  onPrint: () => void;
  printDisabled: boolean;
  printDisabledReason?: string;
  printPending?: boolean;
  onRevokeCustomerStatusLinks?: () => void;
  customerStatusRevokePending?: boolean;
  onCancel: () => void;
  canCancel: boolean;
  onEdit?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useLocale();
  return (
    <div
      data-order-secondary-actions="true"
      className={cn("flex shrink-0 items-center gap-2", className)}
    >
      <Button
        type="button"
        variant="outline"
        size="touch"
        disabled={disabled || printDisabled}
        aria-busy={printPending}
        onClick={onPrint}
        aria-label={
          printDisabled
            ? (printDisabledReason ?? t("orders2b2.hero.printUnavailable"))
            : t("orders2b2.hero.print")
        }
        title={printDisabledReason}
      >
        <Printer aria-hidden="true" />
        <span>{t("orders2b2.hero.print")}</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="touch"
            disabled={disabled}
            aria-label={t("orders2b2.hero.more")}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="order-workbench-secondary-menu">
          {onEdit ? (
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="mr-2 size-4" />
              {t("orders2b2.hero.edit")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={() => {
              const copy = navigator.clipboard?.writeText(window.location.href);
              if (!copy) return;
              void copy
                .then(() => toast.success(t("orders2b2.hero.linkCopied")))
                .catch(() => toast.error(t("orders2b2.hero.copyFailed")));
            }}
          >
            {t("orders2b2.hero.copyLink")}
          </DropdownMenuItem>
          {onRevokeCustomerStatusLinks ? (
            <DropdownMenuItem
              disabled={customerStatusRevokePending}
              onSelect={onRevokeCustomerStatusLinks}
            >
              <QrCode className="mr-2 size-4" />
              {t(
                customerStatusRevokePending
                  ? "orders2b2.hero.resettingQr"
                  : "orders2b2.hero.resetQr",
              )}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            disabled={!canCancel}
            onSelect={onCancel}
          >
            <XCircle className="mr-2 size-4" />
            {t(canCancel ? "orders2b2.hero.cancelOrder" : "orders2b2.hero.cancelUnavailable")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
