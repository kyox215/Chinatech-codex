import { CircleAlert, CircleCheck, Clock3, LockKeyhole, WalletCards, Wrench } from "lucide-react";

import { MoneyText } from "@/components/orders/badges";
import {
  getCustomerPaymentState,
  getCustomerRepairState,
} from "@/features/customers/model/customer-list";
import {
  localizeCustomerPaymentState,
  localizeCustomerRepairState,
} from "@/features/customers/model/customer-i18n";
import type { CustomerListItem } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import { RepairOsBadge } from "@/shared/ui";
import { useLocale } from "@/shared/i18n/locale-provider";

type CustomerStatusFacts = Pick<
  CustomerListItem,
  | "active_order_count"
  | "outstanding_amount"
  | "unpaid_amount"
  | "pending_quote_count"
  | "finance_review_count"
  | "finance_redacted"
>;

export function CustomerStatusBadges({
  customer,
  compact = false,
  className,
}: {
  customer: CustomerStatusFacts;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useLocale();
  const repair = getCustomerRepairState(customer);
  const payment = getCustomerPaymentState(customer);
  const sizeClass = compact ? "text-xs" : "text-xs";
  const iconClass = compact ? "size-2.5" : "size-3";

  return (
    <span className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
      <RepairOsBadge
        className={cn(
          "gap-1 font-semibold",
          sizeClass,
          repair.kind === "active"
            ? "bg-status-info text-status-info-foreground"
            : "bg-status-neutral text-status-neutral-foreground",
        )}
      >
        <Wrench className={iconClass} aria-hidden="true" />
        {localizeCustomerRepairState(repair, t)}
      </RepairOsBadge>
      <RepairOsBadge
        className={cn(
          "gap-1 font-semibold",
          sizeClass,
          payment.kind === "outstanding"
            ? "bg-status-warn text-status-warn-foreground"
            : payment.kind === "review"
              ? "bg-status-danger/10 text-status-danger-foreground"
              : payment.kind === "pending_quote"
                ? "bg-status-info text-status-info-foreground"
                : payment.kind === "settled"
                  ? "bg-status-success text-status-success-foreground"
                  : "bg-status-neutral text-status-neutral-foreground",
        )}
      >
        {payment.kind === "outstanding" ? (
          <WalletCards className={iconClass} aria-hidden="true" />
        ) : payment.kind === "review" ? (
          <CircleAlert className={iconClass} aria-hidden="true" />
        ) : payment.kind === "pending_quote" ? (
          <Clock3 className={iconClass} aria-hidden="true" />
        ) : payment.kind === "settled" ? (
          <CircleCheck className={iconClass} aria-hidden="true" />
        ) : (
          <LockKeyhole className={iconClass} aria-hidden="true" />
        )}
        {payment.kind === "outstanding" ? (
          <>
            {localizeCustomerPaymentState(payment, t)} <MoneyText amount={payment.amount} />
          </>
        ) : payment.kind === "review" || payment.kind === "pending_quote" ? (
          <>
            {localizeCustomerPaymentState(payment, t)} · {payment.count}
          </>
        ) : (
          localizeCustomerPaymentState(payment, t)
        )}
      </RepairOsBadge>
    </span>
  );
}
