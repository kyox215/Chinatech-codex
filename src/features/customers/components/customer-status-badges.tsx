import { CircleCheck, LockKeyhole, WalletCards, Wrench } from "lucide-react";

import { MoneyText } from "@/components/orders/badges";
import {
  getCustomerPaymentState,
  getCustomerRepairState,
} from "@/features/customers/model/customer-list";
import type { CustomerListItem } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import { RepairOsBadge } from "@/shared/ui";

type CustomerStatusFacts = Pick<
  CustomerListItem,
  "active_order_count" | "outstanding_amount" | "unpaid_amount" | "finance_redacted"
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
  const repair = getCustomerRepairState(customer);
  const payment = getCustomerPaymentState(customer);
  const sizeClass = compact ? "text-[9px]" : "text-[11px]";
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
        {repair.label}
      </RepairOsBadge>
      <RepairOsBadge
        className={cn(
          "gap-1 font-semibold",
          sizeClass,
          payment.kind === "outstanding"
            ? "bg-status-warn text-status-warn-foreground"
            : payment.kind === "settled"
              ? "bg-status-success text-status-success-foreground"
              : "bg-status-neutral text-status-neutral-foreground",
        )}
      >
        {payment.kind === "outstanding" ? (
          <WalletCards className={iconClass} aria-hidden="true" />
        ) : payment.kind === "settled" ? (
          <CircleCheck className={iconClass} aria-hidden="true" />
        ) : (
          <LockKeyhole className={iconClass} aria-hidden="true" />
        )}
        {payment.kind === "outstanding" ? (
          <>
            待收 <MoneyText amount={payment.amount} />
          </>
        ) : (
          payment.label
        )}
      </RepairOsBadge>
    </span>
  );
}
