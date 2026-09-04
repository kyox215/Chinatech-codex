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
import { useLocale } from "@/shared/i18n/locale-provider";
import { APP_TIME_ZONE } from "@/shared/i18n/locales";
import type { InventoryLifecycleValidationIssue } from "../components/inventory-lifecycle-field-feedback";
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
  const { t } = useLocale();
  const [customerSearch, setCustomerSearch] = useState("");
  const deferredCustomerSearch = useDeferredValue(customerSearch.trim());
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [price, setPrice] = useState(defaultPrice === undefined ? "" : String(defaultPrice));
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState<InventoryReservationPaymentMethod>("cash");
  const [paymentNote, setPaymentNote] = useState("");
  const [expiresAt, setExpiresAt] = useState(() =>
    formatInventoryReservationDateTimeLocal(addDays(7)),
  );
  const [expectedPickupAt, setExpectedPickupAt] = useState(() =>
    formatInventoryReservationDateTimeLocal(addDays(3)),
  );
  const [noDepositReason, setNoDepositReason] = useState("");
  const [conflict, setConflict] = useState<InventoryConflictDetails | null>(null);
  const [operationError, setOperationError] = useState<InventoryOperationErrorDetails | null>(null);
  const [operationVerification, setOperationVerification] =
    useState<InventoryOperationVerificationStatus>("idle");
  const [operationAcknowledged, setOperationAcknowledged] = useState(false);
  const [validationIssues, setValidationIssues] = useState<InventoryLifecycleValidationIssue[]>([]);
  const [validationFocusRequestKey, setValidationFocusRequestKey] = useState(0);
  const [localError, setLocalError] = useState<string>();
  const idempotencyAttempt = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const submitLock = useRef(false);

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
      const expiry = parseInventoryReservationDateTimeLocal(expiresAt);
      const pickup = parseInventoryReservationDateTimeLocal(expectedPickupAt);
      if (!expiry || expiry <= new Date()) throw new InventoryReservationValidationError();
      if (!pickup || pickup <= new Date()) throw new InventoryReservationValidationError();
      if (pickup > expiry) throw new InventoryReservationValidationError();

      const payload = {
        stock_unit_id: summary.stock_unit_id,
        expected_unit_version: summary.unit_version,
        agreed_price: agreedPrice,
        customer_id: customer.id,
        ...(depositAmount > 0 ? { deposit_amount: depositAmount, payment_method: method } : {}),
        ...(noDepositReason.trim() ? { no_deposit_reason: noDepositReason.trim() } : {}),
        ...(paymentNote.trim() ? { payment_note: paymentNote.trim() } : {}),
        expires_at: expiry.toISOString(),
        expected_pickup_at: pickup.toISOString(),
      };
      const fingerprint = JSON.stringify(payload);
      const existingAttempt = idempotencyAttempt.current;
      const attempt =
        existingAttempt?.fingerprint === fingerprint
          ? existingAttempt
          : { fingerprint, key: crypto.randomUUID() };
      idempotencyAttempt.current = attempt;

      return runInventoryLifecycleCommand({
        command: "reservation.create",
        idempotency_key: attempt.key,
        payload,
      });
    },
    onSuccess: (result) => {
      submitLock.current = false;
      idempotencyAttempt.current = undefined;
      setConflict(null);
      setOperationError(null);
      setOperationVerification("idle");
      setOperationAcknowledged(false);
      toast.success(t("inventory2b4.reservation.success"));
      onSuccess(result);
    },
    onError: (error) => {
      submitLock.current = false;
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
      idempotencyAttempt.current = undefined;
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
  const customerSearchState =
    !customer && deferredCustomerSearch.length >= 2
      ? customersQuery.isPending
        ? "loading"
        : customersQuery.isError
          ? "error"
          : customerResults.length > 0
            ? "ready"
            : "empty"
      : "idle";
  const clearLocalFeedback = () => {
    setValidationIssues([]);
    setLocalError(undefined);
  };
  const collectValidationIssues = (): InventoryLifecycleValidationIssue[] => {
    const issues: InventoryLifecycleValidationIssue[] = [];
    const agreedPrice = parseMoney(price);
    const depositAmount = deposit.trim() ? parseMoney(deposit) : 0;
    const expiry = parseInventoryReservationDateTimeLocal(expiresAt);
    const pickup = parseInventoryReservationDateTimeLocal(expectedPickupAt);
    const now = new Date();
    if (!customer) {
      issues.push({
        fieldId: "reservation-customer",
        label: t("inventory2b4.reservation.customer"),
        message: t("inventory2b4.reservation.validation.customer"),
      });
    }
    if (!agreedPrice || agreedPrice <= 0) {
      issues.push({
        fieldId: "reservation-price",
        label: t("inventory2b4.reservation.price"),
        message: t("inventory2b4.reservation.validation.price"),
      });
    }
    if (depositAmount === undefined || depositAmount < 0) {
      issues.push({
        fieldId: "reservation-deposit",
        label: t("inventory2b4.reservation.deposit"),
        message: t("inventory2b4.reservation.validation.deposit"),
      });
    } else if (agreedPrice && depositAmount > agreedPrice) {
      issues.push({
        fieldId: "reservation-deposit",
        label: t("inventory2b4.reservation.deposit"),
        message: t("inventory2b4.reservation.validation.depositExceeds"),
      });
    }
    if (depositAmount === 0 && !noDepositReason.trim()) {
      issues.push({
        fieldId: "reservation-no-deposit-reason",
        label: t("inventory2b4.reservation.noDepositReason"),
        message: t("inventory2b4.reservation.validation.noDepositReason"),
      });
    }
    if (!expiry || expiry <= now) {
      issues.push({
        fieldId: "reservation-expires",
        label: t("inventory2b4.reservation.expiresAt"),
        message: t("inventory2b4.reservation.validation.expiry"),
      });
    }
    if (!pickup || pickup <= now) {
      issues.push({
        fieldId: "reservation-pickup",
        label: t("inventory2b4.reservation.expectedPickupAt"),
        message: t("inventory2b4.reservation.validation.pickup"),
      });
    } else if (expiry && pickup > expiry) {
      issues.push({
        fieldId: "reservation-pickup",
        label: t("inventory2b4.reservation.expectedPickupAt"),
        message: t("inventory2b4.reservation.validation.pickupAfterExpiry"),
      });
    }
    return issues;
  };

  return (
    <InventoryReservationFormBody
      summary={summary}
      customerSearch={customerSearch}
      onCustomerSearchChange={(value) => {
        clearLocalFeedback();
        setCustomerSearch(value);
      }}
      customer={customer}
      onCustomerClear={() => {
        clearLocalFeedback();
        setCustomer(null);
      }}
      customerResults={customerResults}
      customerSearchState={customerSearchState}
      onCustomerSelect={(candidate) => {
        setCustomer(candidate);
        setCustomerSearch("");
        clearLocalFeedback();
      }}
      price={price}
      onPriceChange={(value) => {
        clearLocalFeedback();
        setPrice(value);
      }}
      deposit={deposit}
      onDepositChange={(value) => {
        clearLocalFeedback();
        setDeposit(value);
      }}
      method={method}
      onMethodChange={setMethod}
      paymentNote={paymentNote}
      onPaymentNoteChange={(value) => {
        clearLocalFeedback();
        setPaymentNote(value);
      }}
      expiresAt={expiresAt}
      onExpiresAtChange={(value) => {
        clearLocalFeedback();
        setExpiresAt(value);
      }}
      expectedPickupAt={expectedPickupAt}
      onExpectedPickupAtChange={(value) => {
        clearLocalFeedback();
        setExpectedPickupAt(value);
      }}
      noDepositReason={noDepositReason}
      onNoDepositReasonChange={(value) => {
        clearLocalFeedback();
        setNoDepositReason(value);
      }}
      noDeposit={noDeposit}
      canSubmit={canSubmit}
      disabledReason={disabledReason}
      validationIssues={validationIssues}
      validationFocusRequestKey={validationFocusRequestKey}
      localError={localError}
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
        if (!canSubmit || submitLock.current) return;
        const issues = collectValidationIssues();
        if (issues.length > 0) {
          setValidationIssues(issues);
          setValidationFocusRequestKey((current) => current + 1);
          setLocalError(undefined);
          return;
        }
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          setValidationIssues([]);
          setLocalError(t("inventory2b4.reservation.offline"));
          setValidationFocusRequestKey((current) => current + 1);
          return;
        }
        clearLocalFeedback();
        submitLock.current = true;
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

const romeDateTimeParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type InventoryReservationDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

/**
 * Converts a wall-clock value entered for the shop into the canonical instant.
 * Europe/Rome spring-forward gaps and autumn overlaps are invalid because
 * neither can identify exactly one canonical instant.
 */
export function parseInventoryReservationDateTimeLocal(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const requested: InventoryReservationDateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  const wallClockUtc = Date.UTC(
    requested.year,
    requested.month - 1,
    requested.day,
    requested.hour,
    requested.minute,
  );
  const calendarCheck = new Date(wallClockUtc);
  if (
    calendarCheck.getUTCFullYear() !== requested.year ||
    calendarCheck.getUTCMonth() + 1 !== requested.month ||
    calendarCheck.getUTCDate() !== requested.day ||
    calendarCheck.getUTCHours() !== requested.hour ||
    calendarCheck.getUTCMinutes() !== requested.minute
  ) {
    return undefined;
  }

  const matches: Date[] = [];
  for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes += 15) {
    const candidate = new Date(wallClockUtc - offsetMinutes * 60_000);
    if (sameRomeDateTimeParts(candidate, requested)) matches.push(candidate);
  }
  return matches.length === 1 ? matches[0] : undefined;
}

function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1_000);
}

export function formatInventoryReservationDateTimeLocal(value: Date) {
  if (!Number.isFinite(value.getTime())) return "";
  const parts = readRomeDateTimeParts(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${String(parts.year).padStart(4, "0")}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

function sameRomeDateTimeParts(value: Date, requested: InventoryReservationDateTimeParts) {
  const actual = readRomeDateTimeParts(value);
  return (
    actual.year === requested.year &&
    actual.month === requested.month &&
    actual.day === requested.day &&
    actual.hour === requested.hour &&
    actual.minute === requested.minute
  );
}

function readRomeDateTimeParts(value: Date): InventoryReservationDateTimeParts {
  const parts = Object.fromEntries(
    romeDateTimeParts
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
}
