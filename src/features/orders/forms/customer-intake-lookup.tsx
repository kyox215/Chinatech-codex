"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { Search, UserRound } from "lucide-react";

import { PhoneKeypadInput } from "@/components/orders/phone-keypad-input";
import { Input } from "@/components/ui/input";
import { getCustomerIntakeNewCustomerPolicy } from "@/features/customers/model/customer-intake-search";
import { CustomerIdentityResultsPanel } from "@/features/orders/forms/customer-identity-results";
import {
  CustomerIdentitySummary,
  CustomerIntakeFieldShell,
} from "@/features/orders/forms/customer-identity-status";
import { useCustomerIdentityCandidates } from "@/features/orders/forms/use-customer-identity-candidates";
import type {
  CustomerIntakeCandidate,
  CustomerIntakeNewCustomerPolicy,
} from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { normalizePhoneKeypadDraft } from "@/shared/lib/mobile-input";

type NewCustomerIntent = CustomerIntakeNewCustomerPolicy;

export function CustomerIdentityLookup({
  phone,
  name,
  selectedCustomerId,
  onPhoneChange,
  onNameChange,
  onPickCustomer,
  onClearCustomerSelection,
  onNewCustomerIntentChange,
  inputClassName,
  inputContainerClassName,
  limit = 8,
  deviceLimit = 4,
  disabled,
}: {
  phone: string;
  name: string;
  selectedCustomerId?: string;
  onPhoneChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onPickCustomer: (candidate: CustomerIntakeCandidate) => void | Promise<void>;
  onClearCustomerSelection: () => void;
  onNewCustomerIntentChange?: (intent: CustomerIntakeNewCustomerPolicy | null) => void;
  inputClassName?: string;
  inputContainerClassName?: string;
  limit?: number;
  deviceLimit?: number;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const listboxId = useId();
  const [activeField, setActiveField] = useState<"phone" | "name" | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [dismissedIntentKey, setDismissedIntentKey] = useState("");
  const [newCustomerIntent, setNewCustomerIntent] = useState<NewCustomerIntent | null>(null);
  const lookup = useCustomerIdentityCandidates({ phone, name, limit, deviceLimit });
  const showResults = Boolean(
    lookup.searchEnabled &&
    !selectedCustomerId &&
    !newCustomerIntent &&
    dismissedIntentKey !== lookup.currentIntentKey,
  );
  const listboxVisible = Boolean(
    showResults && lookup.isOnline && !lookup.isSearching && !lookup.queryError,
  );
  const activeDescendant =
    listboxVisible && highlightedIndex !== null && lookup.candidates[highlightedIndex]
      ? `${listboxId}-option-${highlightedIndex}`
      : undefined;

  const updateNewCustomerIntent = (intent: NewCustomerIntent | null) => {
    setNewCustomerIntent(intent);
    onNewCustomerIntentChange?.(intent);
  };

  useEffect(() => {
    setHighlightedIndex(null);
    setNewCustomerIntent(null);
    onNewCustomerIntentChange?.(null);
  }, [lookup.currentIntentKey, onNewCustomerIntentChange]);

  const pickCustomer = (candidate: CustomerIntakeCandidate) => {
    updateNewCustomerIntent(null);
    setDismissedIntentKey(lookup.currentIntentKey);
    setHighlightedIndex(null);
    void onPickCustomer(candidate);
  };

  const handleKeyboardNavigation = (event: KeyboardEvent<HTMLInputElement | HTMLButtonElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setDismissedIntentKey(lookup.currentIntentKey);
      setHighlightedIndex(null);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setDismissedIntentKey("");
      setHighlightedIndex((index) => nextHighlight(index, lookup.candidates.length, event.key));
      return;
    }
    if (event.key === "Enter" && highlightedIndex !== null) {
      const candidate = lookup.candidates[highlightedIndex];
      if (!candidate) return;
      event.preventDefault();
      pickCustomer(candidate);
    }
  };

  const requestNewCustomer = () => {
    if (!lookup.trustedResult || !lookup.phoneReadyForCreation) return;
    const policy = getCustomerIntakeNewCustomerPolicy(
      lookup.candidates,
      lookup.normalizedPhone,
      lookup.normalizedName,
    );
    onClearCustomerSelection();
    updateNewCustomerIntent(policy);
    setDismissedIntentKey(lookup.currentIntentKey);
  };

  const exactPhoneCandidate = lookup.candidates.find(
    (candidate) =>
      candidate.phoneMatchKind === "exact_primary" ||
      candidate.phoneMatchKind === "exact_alternate" ||
      (candidate.phoneMatchKind === undefined && candidate.exactMatch),
  );
  const blockedIntent =
    newCustomerIntent === "blocked_exact_duplicate" || newCustomerIntent === "blocked_missing_name";
  const liveStatus = getLookupLiveStatus({
    selectedCustomerId,
    newCustomerIntent,
    showResults,
    isSearching: lookup.isSearching,
    trustedResult: lookup.trustedResult,
    candidateCount: lookup.candidates.length,
    queryError: lookup.queryError,
    isOnline: lookup.isOnline,
    t,
  });

  return (
    <div data-customer-identity-lookup="true" className="grid min-w-0 gap-1.5">
      <div className="grid min-w-0 gap-1.5 md:grid-cols-2 lg:grid-cols-1">
        <CustomerIntakeFieldShell
          label={t("orders2b1.new.lookup.phone")}
          required
          leading={<Search className="size-3.5" />}
          trailing={<UserRound className="size-3.5 text-primary" />}
        >
          <div className={cn("relative min-w-0", inputContainerClassName)}>
            <PhoneKeypadInput
              value={phone}
              onChange={(value) => {
                setActiveField("phone");
                setDismissedIntentKey("");
                updateNewCustomerIntent(null);
                onPhoneChange(normalizePhoneKeypadDraft(value));
              }}
              disabled={disabled}
              ariaLabel={t("orders2b1.new.lookup.phoneAria")}
              ariaControls={listboxId}
              ariaExpanded={listboxVisible}
              ariaActiveDescendant={activeField === "phone" ? activeDescendant : undefined}
              placeholder={t("orders2b1.new.lookup.phonePlaceholder")}
              triggerClassName={inputClassName}
              onOpenChange={(open) => {
                setActiveField(open ? "phone" : null);
                if (open) setDismissedIntentKey("");
              }}
              onCandidateKeyDown={handleKeyboardNavigation}
            />
          </div>
        </CustomerIntakeFieldShell>

        <CustomerIntakeFieldShell
          label={t("orders2b1.new.lookup.name")}
          leading={<UserRound className="size-3.5" />}
        >
          <div className={cn("relative min-w-0", inputContainerClassName)}>
            <Input
              type="text"
              value={name}
              disabled={disabled}
              role="combobox"
              aria-label={t("orders2b1.new.lookup.nameAria")}
              aria-autocomplete="list"
              aria-expanded={listboxVisible}
              aria-controls={listboxId}
              aria-activedescendant={activeField === "name" ? activeDescendant : undefined}
              onChange={(event) => {
                setActiveField("name");
                setDismissedIntentKey("");
                updateNewCustomerIntent(null);
                onNameChange(event.target.value);
              }}
              onFocus={() => {
                setActiveField("name");
                setDismissedIntentKey("");
              }}
              onBlur={() => setActiveField(null)}
              onKeyDown={handleKeyboardNavigation}
              placeholder={t("orders2b1.new.lookup.namePlaceholder")}
              className={cn("h-7 text-base sm:h-9 sm:text-sm", inputClassName)}
            />
          </div>
        </CustomerIntakeFieldShell>
      </div>

      <div className="min-w-0">
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {liveStatus}
        </p>
        {selectedCustomerId ? (
          <CustomerIdentitySummary
            tone="selected"
            title={t("orders2b1.new.lookup.selected")}
            description={`${lookup.normalizedName || t("orders2b1.new.lookup.unnamed")} · ${lookup.normalizedPhone}`}
            actionLabel={t("orders2b1.new.lookup.change")}
            onAction={() => {
              onClearCustomerSelection();
              updateNewCustomerIntent(null);
              setDismissedIntentKey("");
            }}
          />
        ) : newCustomerIntent ? (
          <CustomerIdentitySummary
            tone={blockedIntent ? "warning" : "new"}
            title={
              newCustomerIntent === "blocked_exact_duplicate"
                ? t("orders2b1.new.lookup.duplicate")
                : newCustomerIntent === "blocked_missing_name"
                  ? t("orders2b1.new.lookup.distinguishName")
                  : t("orders2b1.new.lookup.createNew")
            }
            description={newCustomerIntentDescription(newCustomerIntent, t)}
            actionLabel={
              blockedIntent
                ? t("orders2b1.new.lookup.backResults")
                : t("orders2b1.new.lookup.backExisting")
            }
            onAction={() => {
              updateNewCustomerIntent(null);
              setDismissedIntentKey("");
            }}
            primaryAction={
              blockedIntent && exactPhoneCandidate
                ? {
                    label: t("orders2b1.new.lookup.useExisting"),
                    onClick: () => pickCustomer(exactPhoneCandidate),
                  }
                : undefined
            }
          />
        ) : showResults ? (
          <CustomerIdentityResultsPanel
            listboxId={listboxId}
            phone={lookup.normalizedPhone}
            name={lookup.normalizedName}
            phoneReadyForCreation={lookup.phoneReadyForCreation}
            isOnline={lookup.isOnline}
            isSearching={lookup.isSearching}
            queryError={lookup.queryError}
            trustedResult={lookup.trustedResult}
            candidates={lookup.candidates}
            highlightedIndex={highlightedIndex}
            selectedCustomerId={selectedCustomerId}
            onHighlight={setHighlightedIndex}
            onPickCustomer={pickCustomer}
            onRetry={lookup.retry}
            onRequestNewCustomer={requestNewCustomer}
          />
        ) : (
          <LookupIdleHint lookup={lookup} />
        )}
      </div>
    </div>
  );
}

function LookupIdleHint({ lookup }: { lookup: ReturnType<typeof useCustomerIdentityCandidates> }) {
  const { t } = useLocale();
  let message = t("orders2b1.new.lookup.idle");
  if (lookup.phonePresent) {
    message =
      lookup.phoneRaw.length < 3
        ? t("orders2b1.new.lookup.keepTyping")
        : t("orders2b1.new.lookup.nameSortOnly");
  } else if (lookup.nameHasDigits) {
    message = t("orders2b1.new.lookup.nameNoPhone");
  }
  return (
    <p className="rounded-lg bg-primary/5 px-2 py-1 text-[10px] leading-4 text-primary">
      {message}
    </p>
  );
}

function nextHighlight(index: number | null, length: number, key: string) {
  if (!length) return null;
  if (key === "ArrowDown") return index === null ? 0 : Math.min(length - 1, index + 1);
  return index === null ? length - 1 : Math.max(0, index - 1);
}

function newCustomerIntentDescription(
  intent: NewCustomerIntent,
  t: ReturnType<typeof useLocale>["t"],
) {
  if (intent === "blocked_exact_duplicate") {
    return t("orders2b1.new.lookup.blockedDuplicate");
  }
  if (intent === "blocked_missing_name") {
    return t("orders2b1.new.lookup.blockedName");
  }
  if (intent === "requires_shared_phone_confirmation") {
    return t("orders2b1.new.lookup.sharedConfirm");
  }
  return t("orders2b1.new.lookup.noMatch");
}

function getLookupLiveStatus({
  selectedCustomerId,
  newCustomerIntent,
  showResults,
  isSearching,
  trustedResult,
  candidateCount,
  queryError,
  isOnline,
  t,
}: {
  selectedCustomerId?: string;
  newCustomerIntent: NewCustomerIntent | null;
  showResults: boolean;
  isSearching: boolean;
  trustedResult: boolean;
  candidateCount: number;
  queryError: string;
  isOnline: boolean;
  t: ReturnType<typeof useLocale>["t"];
}) {
  if (selectedCustomerId) return t("orders2b1.new.lookup.selected");
  if (newCustomerIntent) return newCustomerIntentDescription(newCustomerIntent, t);
  if (!showResults || queryError || !isOnline) return "";
  if (isSearching) return t("orders2b1.new.lookup.checking");
  if (trustedResult) return t("orders2b1.new.lookup.checked", { count: candidateCount });
  return "";
}
