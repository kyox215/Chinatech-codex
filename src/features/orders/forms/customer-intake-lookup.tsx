"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Clock3, Loader2, Search, Smartphone, UserRound } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { customersKeys } from "@/features/customers/api/query-keys";
import {
  searchCustomerIntakeCandidates,
  type CustomerHistoryDeviceCandidate,
  type CustomerIntakeCandidate,
} from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import { primaryPhoneRaw } from "@/shared/lib/phone";

const EMPTY_CANDIDATES: CustomerIntakeCandidate[] = [];

export function CustomerIntakeLookup({
  value,
  selectedCustomerId,
  selectedDeviceId,
  onChange,
  onPickCustomer,
  onPickHistoryDevice,
  className,
  containerClassName,
  placeholder = "搜索电话 / 客户",
  limit = 8,
  deviceLimit = 4,
  disabled,
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
  placeholder?: string;
  limit?: number;
  deviceLimit?: number;
  disabled?: boolean;
}) {
  const listboxId = useId();
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const query = value.trim();
  const rawPhone = primaryPhoneRaw(value);
  const searchEnabled = query.length >= 2 || rawPhone.length >= 3;
  const activeLimit = Math.min(12, Math.max(1, limit));
  const activeDeviceLimit = Math.min(8, Math.max(1, deviceLimit));
  const debouncedQuery = useDebouncedValue(searchEnabled ? query : "", 160);

  const candidateQuery = useQuery({
    queryKey: customersKeys.intakeSearch(debouncedQuery, activeLimit, activeDeviceLimit),
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
    open && resultCount > 0 ? `${listboxId}-option-${highlightedIndex}` : undefined;

  useEffect(() => {
    setOpen(focused && Boolean(query));
  }, [focused, query]);

  useEffect(() => {
    setHighlightedIndex(0);
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn("relative min-w-0", containerClassName)}>
          <Input
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
                setOpen(Boolean(query));
                setHighlightedIndex((index) =>
                  resultCount ? Math.min(resultCount - 1, index + 1) : 0,
                );
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlightedIndex((index) => (resultCount ? Math.max(0, index - 1) : 0));
                return;
              }
              if (event.key === "Enter" && open && resultCount > 0) {
                event.preventDefault();
                const candidate = data[highlightedIndex];
                if (candidate) pickCustomer(candidate);
              }
            }}
            placeholder={placeholder}
            className={cn("h-7 font-mono text-base sm:h-9 sm:text-sm", className)}
            onBlur={() => {
              setFocused(false);
              window.setTimeout(() => setOpen(false), 140);
            }}
            onFocus={() => {
              setFocused(true);
              if (query) setOpen(true);
            }}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        collisionPadding={12}
        sideOffset={6}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-[calc(100vw-24px)] max-w-sm overflow-x-hidden p-1 sm:w-[28rem] sm:max-w-[calc(100vw-24px)] md:w-[32rem]"
      >
        <div
          id={listboxId}
          role="listbox"
          aria-label="客户和历史维修型号"
          className="max-h-80 min-w-0 overflow-y-auto"
        >
          {!searchEnabled ? (
            <LookupHint>输入 2 个字或 3 位号码开始搜索</LookupHint>
          ) : isSearching && data.length === 0 ? (
            <LookupHint icon={<Loader2 className="size-3 animate-spin" />}>搜索中…</LookupHint>
          ) : queryError ? (
            <LookupHint tone="danger">搜索失败：{queryError}</LookupHint>
          ) : data.length === 0 ? (
            <LookupHint>未找到客户，可继续手动录入</LookupHint>
          ) : (
            data.map((candidate, index) => {
              const selected = candidate.customer.id === selectedCustomerId;
              const highlighted = index === highlightedIndex;
              return (
                <div
                  key={candidate.customer.id}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={highlighted}
                  className={cn(
                    "mb-1 rounded-lg border border-[var(--border-panel)] bg-card p-1 shadow-[var(--shadow-card)] last:mb-0",
                    highlighted && "ring-1 ring-primary/25",
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <button
                    type="button"
                    className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring sm:grid-cols-[auto_minmax(0,1fr)_auto]"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pickCustomer(candidate)}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <UserRound className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="min-w-0 break-words text-sm font-bold leading-5 sm:text-xs sm:leading-4">
                          {candidate.customer.name}
                        </span>
                        {candidate.exactMatch ? (
                          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-primary">
                            精确匹配
                          </span>
                        ) : null}
                      </span>
                      <span className="block break-all font-mono text-xs font-medium leading-4 text-muted-foreground sm:text-[11px]">
                        {candidate.customer.phone_e164}
                        {candidate.customer.contact_phones.length
                          ? ` · 备用 ${candidate.customer.contact_phones.length}`
                          : ""}
                      </span>
                    </span>
                    {selected ? (
                      <Check className="col-start-2 size-3.5 shrink-0 justify-self-start text-primary sm:col-start-auto sm:justify-self-end" />
                    ) : (
                      <span className="col-start-2 shrink-0 justify-self-start text-[10px] font-semibold text-primary sm:col-start-auto sm:justify-self-end">
                        选择
                      </span>
                    )}
                  </button>

                  <div className="px-1.5 pb-1">
                    {candidate.historyDevices.length ? (
                      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {candidate.historyDevices.map((device) => (
                          <HistoryDeviceButton
                            key={device.id}
                            device={device}
                            selected={Boolean(
                              device.device_id && device.device_id === selectedDeviceId,
                            )}
                            onClick={() => pickDevice(candidate, device)}
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
            })
          )}
          {isSearching && data.length > 0 ? (
            <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              正在更新结果…
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
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
        "min-w-0 rounded-md border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-2.5 py-1.5 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring",
        selected && "border-primary/45 bg-primary/10 text-primary",
      )}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <span className="flex min-w-0 items-start gap-1.5">
        <Smartphone className="size-3 shrink-0 text-primary" />
        <span className="min-w-0 break-words text-[11px] font-bold leading-4">
          {device.brand} {device.model}
        </span>
      </span>
      <span className="mt-0.5 flex min-w-0 items-start gap-1.5 text-[10px] font-medium leading-4 text-muted-foreground">
        <Clock3 className="size-2.5 shrink-0" />
        <span className="min-w-0 break-all">
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
