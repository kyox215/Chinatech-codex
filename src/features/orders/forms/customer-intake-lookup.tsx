"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Clock3, Loader2, Search, Smartphone, UserRound } from "lucide-react";

import { PhoneKeypadInput } from "@/components/orders/phone-keypad-input";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { customersKeys } from "@/features/customers/api/query-keys";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import {
  searchCustomerIntakeCandidates,
  type CustomerHistoryDeviceCandidate,
  type CustomerIntakeCandidate,
} from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import { normalizePhoneKeypadDraft } from "@/shared/lib/mobile-input";
import { primaryPhoneRaw } from "@/shared/lib/phone";

const EMPTY_CANDIDATES: CustomerIntakeCandidate[] = [];
type CustomerIntakeLookupMode = "phone" | "name";
type CustomerIntakeResultsPlacement = "popover" | "inline";

export function CustomerIntakeLookup({
  value,
  selectedCustomerId,
  selectedDeviceId,
  onChange,
  onPickCustomer,
  onPickHistoryDevice,
  className,
  containerClassName,
  rootClassName,
  placeholder,
  limit = 8,
  deviceLimit = 4,
  disabled,
  mode = "phone",
  resultsPlacement = "popover",
  fieldLabel,
  fieldRequired,
  fieldLeading,
  fieldTrailing,
  fieldTrailingInteractive,
}: {
  value: string;
  selectedCustomerId?: string;
  selectedDeviceId?: string;
  onChange: (value: string) => void;
  onPickCustomer: (candidate: CustomerIntakeCandidate) => void | Promise<void>;
  onPickHistoryDevice: (
    candidate: CustomerIntakeCandidate,
    device: CustomerHistoryDeviceCandidate,
  ) => void | Promise<void>;
  className?: string;
  containerClassName?: string;
  rootClassName?: string;
  placeholder?: string;
  limit?: number;
  deviceLimit?: number;
  disabled?: boolean;
  mode?: CustomerIntakeLookupMode;
  resultsPlacement?: CustomerIntakeResultsPlacement;
  fieldLabel?: string;
  fieldRequired?: boolean;
  fieldLeading?: ReactNode;
  fieldTrailing?: ReactNode;
  fieldTrailingInteractive?: boolean;
}) {
  const listboxId = useId();
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const query = mode === "phone" ? normalizePhoneKeypadDraft(value) : value.trim();
  const rawPhone = primaryPhoneRaw(query);
  const nameHasDigits = mode === "name" && /\d/.test(query);
  const searchEnabled =
    mode === "phone" ? rawPhone.length >= 3 : query.length >= 2 && !nameHasDigits;
  const activeLimit = Math.min(12, Math.max(1, limit));
  const activeDeviceLimit = Math.min(8, Math.max(1, deviceLimit));
  const debouncedQuery = useDebouncedValue(searchEnabled ? query : "", 160);
  const shell = useStoreShellContext();
  const activeStoreId = shell.activeStore?.id;

  const candidateQuery = useQuery({
    queryKey: [
      ...customersKeys.intakeSearch(debouncedQuery, activeLimit, activeDeviceLimit, activeStoreId),
      mode,
    ] as const,
    queryFn: () => searchCustomerIntakeCandidates(debouncedQuery, activeLimit, activeDeviceLimit),
    enabled: Boolean(debouncedQuery),
    staleTime: 90_000,
    gcTime: 5 * 60_000,
    retry: false,
  });
  const data = debouncedQuery ? (candidateQuery.data ?? EMPTY_CANDIDATES) : EMPTY_CANDIDATES;
  const isSearching = Boolean(debouncedQuery && candidateQuery.isFetching);
  const queryError = candidateQuery.error instanceof Error ? candidateQuery.error.message : "";
  const resultCount = data.length;
  const activeDescendant =
    open && resultCount > 0 && highlightedIndex !== null
      ? `${listboxId}-option-${highlightedIndex}`
      : undefined;

  useEffect(() => {
    setOpen(resultsPlacement === "inline" ? searchEnabled : focused && searchEnabled);
  }, [focused, resultsPlacement, searchEnabled]);

  useEffect(() => {
    setHighlightedIndex(null);
  }, [debouncedQuery, data.length]);

  const pickCustomer = (candidate: CustomerIntakeCandidate) => {
    void onPickCustomer(candidate);
    setOpen(false);
  };

  const pickDevice = (
    candidate: CustomerIntakeCandidate,
    device: CustomerHistoryDeviceCandidate,
  ) => {
    void onPickHistoryDevice(candidate, device);
    setOpen(false);
  };

  const placeholderText =
    placeholder ?? (mode === "phone" ? "输入电话号码" : "搜索客户姓名（可选）");
  const resultsContent = (
    <CustomerIntakeResults
      listboxId={listboxId}
      mode={mode}
      searchEnabled={searchEnabled}
      nameHasDigits={nameHasDigits}
      isSearching={isSearching}
      queryError={queryError}
      data={data}
      highlightedIndex={highlightedIndex}
      selectedCustomerId={selectedCustomerId}
      selectedDeviceId={selectedDeviceId}
      onHighlight={setHighlightedIndex}
      onPickCustomer={pickCustomer}
      onPickDevice={pickDevice}
    />
  );
  const control =
    mode === "phone" ? (
      <PhoneKeypadInput
        value={value}
        onChange={(nextValue) => {
          onChange(normalizePhoneKeypadDraft(nextValue));
          setFocused(true);
        }}
        disabled={disabled}
        ariaLabel="客户电话号码"
        ariaControls={listboxId}
        ariaExpanded={open}
        ariaActiveDescendant={activeDescendant}
        placeholder={placeholderText}
        triggerClassName={className}
        onOpenChange={(nextOpen) => {
          setFocused(nextOpen || Boolean(query));
          if (nextOpen && searchEnabled) setOpen(true);
        }}
      />
    ) : (
      <Input
        type="text"
        value={value}
        disabled={disabled}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeDescendant}
        onChange={(event) => {
          onChange(event.target.value);
          setFocused(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(searchEnabled);
            setHighlightedIndex((index) =>
              resultCount ? (index === null ? 0 : Math.min(resultCount - 1, index + 1)) : null,
            );
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((index) =>
              resultCount ? (index === null ? resultCount - 1 : Math.max(0, index - 1)) : null,
            );
            return;
          }
          if (event.key === "Enter" && open && resultCount > 0) {
            event.preventDefault();
            if (highlightedIndex === null) return;
            const candidate = data[highlightedIndex];
            if (candidate) pickCustomer(candidate);
          }
        }}
        placeholder={placeholderText}
        className={cn("h-7 text-base sm:h-9 sm:text-sm", className)}
        onBlur={() => {
          setFocused(false);
          if (resultsPlacement === "popover") window.setTimeout(() => setOpen(false), 140);
        }}
        onFocus={() => {
          setFocused(true);
          if (searchEnabled) setOpen(true);
        }}
      />
    );
  const controlFrame = <div className={cn("relative min-w-0", containerClassName)}>{control}</div>;
  const inlineResults = open ? (
    <CustomerIntakeResultsPanel mode={mode}>{resultsContent}</CustomerIntakeResultsPanel>
  ) : null;
  const lookupBody =
    resultsPlacement === "popover" ? (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>{controlFrame}</PopoverAnchor>
        <PopoverContent
          align="start"
          collisionPadding={12}
          side="top"
          sideOffset={6}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="w-[calc(100vw-24px)] max-w-sm overflow-x-hidden p-1 sm:w-[28rem] sm:max-w-[calc(100vw-24px)] md:w-[32rem]"
        >
          {resultsContent}
        </PopoverContent>
      </Popover>
    ) : (
      <div className={cn("grid min-w-0 gap-1", rootClassName)}>
        {controlFrame}
        {inlineResults}
      </div>
    );

  if (!fieldLabel) return lookupBody;

  if (resultsPlacement === "inline") {
    return (
      <div className={cn("grid min-w-0 gap-1", rootClassName)}>
        <CustomerIntakeFieldShell
          label={fieldLabel}
          required={fieldRequired}
          leading={fieldLeading}
          trailing={fieldTrailing}
          trailingInteractive={fieldTrailingInteractive}
        >
          {controlFrame}
        </CustomerIntakeFieldShell>
        {inlineResults}
      </div>
    );
  }

  return (
    <CustomerIntakeFieldShell
      label={fieldLabel}
      required={fieldRequired}
      leading={fieldLeading}
      trailing={fieldTrailing}
      trailingInteractive={fieldTrailingInteractive}
    >
      {lookupBody}
    </CustomerIntakeFieldShell>
  );
}

function CustomerIntakeResultsPanel({
  mode,
  children,
}: {
  mode: CustomerIntakeLookupMode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-1 shadow-[var(--shadow-card)]",
        mode === "phone" ? "max-h-[18rem]" : "max-h-[20rem]",
      )}
      data-customer-intake-results={mode}
    >
      {children}
    </div>
  );
}

function CustomerIntakeResults({
  listboxId,
  mode,
  searchEnabled,
  nameHasDigits,
  isSearching,
  queryError,
  data,
  highlightedIndex,
  selectedCustomerId,
  selectedDeviceId,
  onHighlight,
  onPickCustomer,
  onPickDevice,
}: {
  listboxId: string;
  mode: CustomerIntakeLookupMode;
  searchEnabled: boolean;
  nameHasDigits: boolean;
  isSearching: boolean;
  queryError: string;
  data: CustomerIntakeCandidate[];
  highlightedIndex: number | null;
  selectedCustomerId?: string;
  selectedDeviceId?: string;
  onHighlight: (index: number) => void;
  onPickCustomer: (candidate: CustomerIntakeCandidate) => void;
  onPickDevice: (
    candidate: CustomerIntakeCandidate,
    device: CustomerHistoryDeviceCandidate,
  ) => void;
}) {
  return (
    <div
      id={listboxId}
      role="listbox"
      aria-label={mode === "phone" ? "客户电话搜索结果" : "客户姓名搜索结果"}
      className="max-h-[min(20rem,calc(100dvh_-_var(--rd-overlay-avoid-bottom,0px)_-_1rem))] min-w-0 overflow-y-auto"
    >
      {!searchEnabled ? (
        <LookupHint>
          {nameHasDigits
            ? "姓名搜索只接收姓名，电话号码请在电话栏输入"
            : mode === "phone"
              ? "输入 3 位号码开始搜索"
              : "输入 2 个字开始搜索客户姓名"}
        </LookupHint>
      ) : isSearching && data.length === 0 ? (
        <LookupHint icon={<Loader2 className="size-3 animate-spin" />}>搜索中…</LookupHint>
      ) : queryError ? (
        <LookupHint tone="danger">搜索失败：{queryError}</LookupHint>
      ) : data.length === 0 ? (
        <LookupHint>
          {mode === "phone" ? "未找到客户，可作为新客户继续创建" : "未找到客户，可继续手动录入姓名"}
        </LookupHint>
      ) : (
        data.map((candidate, index) => {
          const selected = candidate.customer.id === selectedCustomerId;
          const highlighted = index === highlightedIndex;
          return (
            <CustomerIntakeCandidateCard
              key={candidate.customer.id}
              listboxId={listboxId}
              candidate={candidate}
              index={index}
              selected={selected}
              highlighted={highlighted}
              selectedDeviceId={selectedDeviceId}
              onHighlight={() => onHighlight(index)}
              onPickCustomer={() => onPickCustomer(candidate)}
              onPickDevice={(device) => onPickDevice(candidate, device)}
            />
          );
        })
      )}
      {isSearching && data.length > 0 ? (
        <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          正在更新结果…
        </div>
      ) : null}
    </div>
  );
}

function CustomerIntakeCandidateCard({
  listboxId,
  candidate,
  index,
  selected,
  highlighted,
  selectedDeviceId,
  onHighlight,
  onPickCustomer,
  onPickDevice,
}: {
  listboxId: string;
  candidate: CustomerIntakeCandidate;
  index: number;
  selected: boolean;
  highlighted: boolean;
  selectedDeviceId?: string;
  onHighlight: () => void;
  onPickCustomer: () => void;
  onPickDevice: (device: CustomerHistoryDeviceCandidate) => void;
}) {
  return (
    <div
      id={`${listboxId}-option-${index}`}
      role="option"
      aria-selected={selected}
      className={cn(
        "mb-1 rounded-lg border border-[var(--border-panel)] bg-card p-1 shadow-[var(--shadow-card)] last:mb-0",
        highlighted && "ring-1 ring-primary/25",
      )}
      onMouseEnter={onHighlight}
    >
      <button
        type="button"
        className="grid min-h-10 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 rounded-md px-1.5 py-1 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring sm:gap-2 sm:px-2"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onPickCustomer}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <UserRound className="size-3.5" />
        </span>
        <span className="min-w-0">
          <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
            <span className="min-w-0 truncate text-sm font-bold leading-5 sm:text-xs sm:leading-4">
              {candidate.customer.name}
            </span>
            {candidate.exactMatch ? (
              <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-primary">
                精确匹配
              </span>
            ) : null}
          </span>
          <span className="block truncate font-mono text-xs font-medium leading-4 text-muted-foreground sm:text-[11px]">
            {candidate.customer.phone_e164}
            {candidate.customer.contact_phones.length
              ? ` · 备用 ${candidate.customer.contact_phones.length}`
              : ""}
          </span>
        </span>
        {selected ? (
          <Check className="size-3.5 shrink-0 justify-self-end text-primary" />
        ) : (
          <span className="shrink-0 justify-self-end text-[10px] font-semibold text-primary">
            选择
          </span>
        )}
      </button>

      <div className="px-1 pb-0.5">
        {candidate.historyDevices.length ? (
          <div className="grid grid-cols-2 gap-1">
            {candidate.historyDevices.map((device) => (
              <HistoryDeviceButton
                key={device.id}
                device={device}
                selected={Boolean(device.device_id && device.device_id === selectedDeviceId)}
                onClick={() => onPickDevice(device)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-md bg-[var(--surface-panel-muted)] px-2 py-1 text-[10px] font-medium leading-3 text-muted-foreground">
            暂无历史维修型号
          </p>
        )}
      </div>
    </div>
  );
}

function CustomerIntakeFieldShell({
  label,
  required,
  leading,
  trailing,
  trailingInteractive,
  children,
}: {
  label: string;
  required?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  trailingInteractive?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rd-new-order-field grid min-w-0 grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-1.5 rounded-xl border border-[var(--border-panel)] bg-card px-2 py-1.5 shadow-[var(--shadow-card)]">
      <label className="pt-2.5 text-[10.5px] font-semibold leading-4 text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      <div
        className={cn(
          "grid min-w-0 items-start gap-1.5",
          leading ? "grid-cols-[1rem_minmax(0,1fr)]" : "grid-cols-1",
        )}
      >
        {leading ? (
          <span className="grid size-4 shrink-0 place-items-center pt-2.5 text-muted-foreground">
            {leading}
          </span>
        ) : null}
        <div className="min-w-0">{children}</div>
      </div>
      {trailing ? (
        <div
          className={cn(
            "flex h-9 shrink-0 items-center gap-1 border-l border-[var(--border-panel)] pl-1.5",
            !trailingInteractive && "pointer-events-none pl-2",
          )}
        >
          {trailing}
        </div>
      ) : null}
    </div>
  );
}

function HistoryDeviceButton({
  device,
  selected,
  onClick,
}: {
  device: CustomerHistoryDeviceCandidate;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "min-h-10 min-w-0 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-1.5 py-1 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring",
        selected && "border-primary/45 bg-primary/10 text-primary",
      )}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <span className="flex min-w-0 items-start gap-1.5">
        <Smartphone className="size-3 shrink-0 text-primary" />
        <span className="min-w-0 truncate text-[10.5px] font-bold leading-4">
          {device.brand} {device.model}
        </span>
      </span>
      <span className="mt-0.5 flex min-w-0 items-start gap-1 text-[9.5px] font-medium leading-3 text-muted-foreground">
        <Clock3 className="size-2.5 shrink-0" />
        <span className="min-w-0 truncate">
          {device.serial_or_imei || device.order_public_no || "历史记录"}
        </span>
      </span>
    </button>
  );
}

function LookupHint({
  children,
  icon,
  tone = "muted",
}: {
  children: ReactNode;
  icon?: ReactNode;
  tone?: "muted" | "danger";
}) {
  return (
    <div
      className={cn(
        "flex min-h-9 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs",
        tone === "danger" ? "text-status-danger-foreground" : "text-muted-foreground",
      )}
    >
      {icon ?? <Search className="size-3" />}
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  );
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debounced;
}
