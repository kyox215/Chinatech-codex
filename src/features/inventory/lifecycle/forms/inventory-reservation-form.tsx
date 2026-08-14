"use client";

import { useDeferredValue, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { searchCustomers, runInventoryLifecycleCommand } from "@/lib/repairdesk/api";
import type {
  Customer,
  InventoryLifecycleCommandResult,
  InventoryLifecycleListSummary,
} from "@/lib/repairdesk/types";
import {
  getInventoryConflictDetails,
  type InventoryConflictDetails,
} from "../../components/inventory-conflict-panel";
import {
  classifyInventoryOperationError,
  type InventoryOperationErrorDetails,
  type InventoryOperationVerificationStatus,
} from "../../model/inventory-operation-error";
import {
  InventoryReservationFormBody,
  type InventoryReservationPaymentMethod,
} from "./inventory-reservation-form-body";

class InventoryReservationValidationError extends Error {
  constructor() {
    super("reservation-validation-failed");
    this.name = "InventoryReservationValidationError";
  }
}

export function InventoryReservationForm({
  summary,
  storeId,
  defaultPrice,
  onSuccess,
  disabledReason,
  onVerify,
}: {
  summary: InventoryLifecycleListSummary;
  storeId?: string | null;
  defaultPrice?: number;
  onSuccess: (result: InventoryLifecycleCommandResult) => void;
  disabledReason?: string;
  onVerify?: () => void | Promise<void>;
}) {
  const [customerSearch, setCustomerSearch] = useState("");
  const deferredCustomerSearch = useDeferredValue(customerSearch.trim());
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [price, setPrice] = useState(defaultPrice === undefined ? "" : String(defaultPrice));
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState<InventoryReservationPaymentMethod>("cash");
  const [paymentNote, setPaymentNote] = useState("");
  const [expiresAt, setExpiresAt] = useState(() => toDateTimeLocal(addDays(7)));
  const [expectedPickupAt, setExpectedPickupAt] = useState(() => toDateTimeLocal(addDays(3)));
  const [noDepositReason, setNoDepositReason] = useState("");
  const [conflict, setConflict] = useState<InventoryConflictDetails | null>(null);
  const [operationError, setOperationError] = useState<InventoryOperationErrorDetails | null>(null);
  const [operationVerification, setOperationVerification] =
    useState<InventoryOperationVerificationStatus>("idle");
  const [operationAcknowledged, setOperationAcknowledged] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());

  const customersQuery = useQuery({
    queryKey: ["inventory-lifecycle", "customers", storeId ?? "no-store", deferredCustomerSearch],
    queryFn: () => searchCustomers(deferredCustomerSearch, 6),
    enabled: Boolean(storeId) && deferredCustomerSearch.length >= 2 && !customer,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const agreedPrice = parseMoney(price);
      const depositAmount = deposit.trim() ? parseMoney(deposit) : 0;
      if (!customer) throw new InventoryReservationValidationError();
      if (!agreedPrice || agreedPrice <= 0) throw new InventoryReservationValidationError();
      if (depositAmount === undefined || depositAmount < 0)
        throw new InventoryReservationValidationError();
      if (depositAmount > agreedPrice) throw new InventoryReservationValidationError();
      if (depositAmount === 0 && !noDepositReason.trim())
        throw new InventoryReservationValidationError();
      const expiry = parseDateTime(expiresAt);
      const pickup = parseDateTime(expectedPickupAt);
      if (!expiry || expiry <= new Date()) throw new InventoryReservationValidationError();
      if (!pickup || pickup <= new Date()) throw new InventoryReservationValidationError();
      if (pickup > expiry) throw new InventoryReservationValidationError();

      return runInventoryLifecycleCommand({
        command: "reservation.create",
        idempotency_key: idempotencyKey.current,
        payload: {
          stock_unit_id: summary.stock_unit_id,
          expected_unit_version: summary.unit_version,
          agreed_price: agreedPrice,
          customer_id: customer.id,
          ...(depositAmount > 0 ? { deposit_amount: depositAmount, payment_method: method } : {}),
          ...(noDepositReason.trim() ? { no_deposit_reason: noDepositReason.trim() } : {}),
          ...(paymentNote.trim() ? { payment_note: paymentNote.trim() } : {}),
          expires_at: expiry.toISOString(),
          expected_pickup_at: pickup.toISOString(),
        },
      });
    },
    onSuccess: (result) => {
      idempotencyKey.current = crypto.randomUUID();
      setConflict(null);
      setOperationError(null);
      setOperationVerification("idle");
      setOperationAcknowledged(false);
      toast.success("预订已提交");
      onSuccess(result);
    },
    onError: (error) => {
      const nextConflict = getInventoryConflictDetails(error);
      setConflict(nextConflict);
      setOperationError(nextConflict ? null : classifyInventoryOperationError(error));
      setOperationVerification("idle");
      setOperationAcknowledged(false);
    },
  });

  const verifyOperation = async () => {
    if (!onVerify || operationVerification === "verifying") return;
    setOperationAcknowledged(false);
    setOperationVerification("verifying");
    try {
      await onVerify();
      mutation.reset();
      // A read-only recovery is the only safe point to retire the key that
      // produced the conflict/outcome-unknown result. Never replay the old
      // command key after a successful verification.
      idempotencyKey.current = crypto.randomUUID();
      setConflict(null);
      setOperationVerification("verified");
    } catch {
      setOperationVerification("failed");
      throw new Error("reservation-readback-unavailable");
    }
  };

  const operationWriteBlocked =
    operationError?.kind === "outcome-unknown" &&
    (operationVerification !== "verified" || !operationAcknowledged);
  const writeBlocked = Boolean(mutation.isPending || conflict || operationWriteBlocked);

  const canSubmit =
    summary.allowed_actions?.includes("reservation.create") === true &&
    Boolean(summary.unit_version) &&
    !disabledReason &&
    !writeBlocked;
  const noDeposit = !deposit.trim() || parseMoney(deposit) === 0;
  const customerResults = customersQuery.data ?? [];

  return (
    <InventoryReservationFormBody
      summary={summary}
      customerSearch={customerSearch}
      onCustomerSearchChange={setCustomerSearch}
      customer={customer}
      onCustomerClear={() => setCustomer(null)}
      customerResults={customerResults}
      onCustomerSelect={(candidate) => {
        setCustomer(candidate);
        setCustomerSearch("");
      }}
      price={price}
      onPriceChange={setPrice}
      deposit={deposit}
      onDepositChange={setDeposit}
      method={method}
      onMethodChange={setMethod}
      paymentNote={paymentNote}
      onPaymentNoteChange={setPaymentNote}
      expiresAt={expiresAt}
      onExpiresAtChange={setExpiresAt}
      expectedPickupAt={expectedPickupAt}
      onExpectedPickupAtChange={setExpectedPickupAt}
      noDepositReason={noDepositReason}
      onNoDepositReasonChange={setNoDepositReason}
      noDeposit={noDeposit}
      canSubmit={canSubmit}
      disabledReason={disabledReason}
      conflict={conflict}
      operationError={operationError}
      operationVerification={operationVerification}
      operationAcknowledged={operationAcknowledged}
      onAcknowledgeOperation={() => {
        setOperationAcknowledged(true);
        setOperationError(null);
      }}
      onVerifyOperation={verifyOperation}
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        mutation.mutate();
      }}
      pending={mutation.isPending}
    />
  );
}
function parseMoney(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : undefined;
}

function parseDateTime(value: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function addDays(days: number) {
  const result = new Date();
  result.setDate(result.getDate() + days);
  return result;
}

function toDateTimeLocal(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}
