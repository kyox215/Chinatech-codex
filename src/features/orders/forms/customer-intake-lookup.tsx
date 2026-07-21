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
  });

  return (
    <div data-customer-identity-lookup="true" className="grid min-w-0 gap-1.5">
      <div className="grid min-w-0 gap-1.5 md:grid-cols-2 lg:grid-cols-1">
        <CustomerIntakeFieldShell
          label="电话"
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
              ariaLabel="客户电话号码"
              ariaControls={listboxId}
              ariaExpanded={listboxVisible}
              ariaActiveDescendant={activeField === "phone" ? activeDescendant : undefined}
              placeholder="输入电话号码"
              triggerClassName={inputClassName}
              onOpenChange={(open) => {
                setActiveField(open ? "phone" : null);
                if (open) setDismissedIntentKey("");
              }}
              onCandidateKeyDown={handleKeyboardNavigation}
            />
          </div>
        </CustomerIntakeFieldShell>

        <CustomerIntakeFieldShell label="姓名" leading={<UserRound className="size-3.5" />}>
          <div className={cn("relative min-w-0", inputContainerClassName)}>
            <Input
              type="text"
              value={name}
              disabled={disabled}
              role="combobox"
              aria-label="客户姓名"
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
              placeholder="搜索客户姓名（可选）"
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
            title="已选择现有客户"
            description={`${lookup.normalizedName || "未命名客户"} · ${lookup.normalizedPhone}`}
            actionLabel="更换客户"
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
                ? "已有姓名和电话完全相同的客户"
                : newCustomerIntent === "blocked_missing_name"
                  ? "请先填写可区分的客户姓名"
                  : "将按当前资料新建客户"
            }
            description={newCustomerIntentDescription(newCustomerIntent)}
            actionLabel={blockedIntent ? "返回结果" : "返回选择已有客户"}
            onAction={() => {
              updateNewCustomerIntent(null);
              setDismissedIntentKey("");
            }}
            primaryAction={
              blockedIntent && exactPhoneCandidate
                ? { label: "使用已有客户", onClick: () => pickCustomer(exactPhoneCandidate) }
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
  let message = "可单独输入电话或姓名；两者都有时以电话为准。";
  if (lookup.phonePresent) {
    message =
      lookup.phoneRaw.length < 3
        ? "继续输入电话号码；有电话时只显示电话匹配客户。"
        : "姓名仅用于同号客户排序，不会显示电话号码不同的同名客户。";
  } else if (lookup.nameHasDigits) {
    message = "姓名搜索只接收姓名，电话号码请在电话栏输入。";
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

function newCustomerIntentDescription(intent: NewCustomerIntent) {
  if (intent === "blocked_exact_duplicate") {
    return "不能创建无法区分的重复档案，请使用已有客户或修改姓名、电话。";
  }
  if (intent === "blocked_missing_name") {
    return "此电话已有客户；若要新建另一位共用电话的客户，请先填写可区分的姓名。";
  }
  if (intent === "requires_shared_phone_confirmation") {
    return "此电话已有客户；提交工单时仍需确认这是另一位共用电话的客户。";
  }
  return "当前未发现相同电话；最终身份仍会在提交工单时由服务端确认。";
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
}: {
  selectedCustomerId?: string;
  newCustomerIntent: NewCustomerIntent | null;
  showResults: boolean;
  isSearching: boolean;
  trustedResult: boolean;
  candidateCount: number;
  queryError: string;
  isOnline: boolean;
}) {
  if (selectedCustomerId) return "已选择现有客户";
  if (newCustomerIntent) return newCustomerIntentDescription(newCustomerIntent);
  if (!showResults || queryError || !isOnline) return "";
  if (isSearching) return "正在核对客户";
  if (trustedResult) return `客户核对完成，共 ${candidateCount} 位候选`;
  return "";
}
