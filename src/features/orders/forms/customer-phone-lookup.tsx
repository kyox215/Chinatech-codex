"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { customersKeys } from "@/features/customers/api/query-keys";
import { searchCustomers, type Customer } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import { normalizePhoneRaw, primaryPhoneRaw, splitPhoneCandidates } from "@/shared/lib/phone";

const EMPTY_CUSTOMERS: Customer[] = [];

export function CustomerPhoneLookup({
  value,
  selectedCustomerId,
  onChange,
  onPick,
  className,
  containerClassName,
  placeholder = "电话 * / 搜索客户",
  limit = 8,
  autoPickExact = true,
  disabled,
  showSearchIcon = true,
}: {
  value: string;
  selectedCustomerId?: string;
  onChange: (value: string) => void;
  onPick: (customer: Customer) => void | Promise<void>;
  className?: string;
  containerClassName?: string;
  placeholder?: string;
  limit?: number;
  autoPickExact?: boolean;
  disabled?: boolean;
  showSearchIcon?: boolean;
}) {
  const listboxId = useId();
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const query = value.trim();
  const normalizedPhone = primaryPhoneRaw(value);
  const hasMultiplePhones = splitPhoneCandidates(value).length > 1;
  const searchEnabled = query.length >= 2 || normalizedPhone.length >= 3;
  const debouncedQuery = useDebouncedValue(searchEnabled ? query : "", 180);
  const activeLimit = Math.min(12, Math.max(1, limit));
  const customerQuery = useQuery({
    queryKey: customersKeys.search(debouncedQuery, activeLimit),
    queryFn: () => searchCustomers(debouncedQuery, activeLimit),
    enabled: Boolean(debouncedQuery),
    staleTime: 90_000,
    gcTime: 5 * 60_000,
    retry: false,
  });
  const data = debouncedQuery ? (customerQuery.data ?? EMPTY_CUSTOMERS) : EMPTY_CUSTOMERS;
  const isSearching = Boolean(debouncedQuery && customerQuery.isFetching);
  const queryError = customerQuery.error instanceof Error ? customerQuery.error.message : "";
  const exactCustomer = useMemo(
    () =>
      autoPickExact && normalizedPhone && !hasMultiplePhones
        ? data.find(
            (customer) =>
              customer.phone_raw === normalizedPhone ||
              customer.phone_e164 === value.trim() ||
              customer.contact_phones.some((phone) => normalizePhoneRaw(phone) === normalizedPhone),
          )
        : undefined,
    [autoPickExact, data, hasMultiplePhones, normalizedPhone, value],
  );

  useEffect(() => {
    if (!exactCustomer || exactCustomer.id === selectedCustomerId) return;
    void onPick(exactCustomer);
    setOpen(false);
  }, [exactCustomer, onPick, selectedCustomerId]);

  useEffect(() => {
    setOpen(focused && Boolean(query));
  }, [focused, query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [debouncedQuery, data.length]);

  const pickCustomer = (customer: Customer) => {
    void onPick(customer);
    setOpen(false);
  };

  const resultCount = data.length;
  const activeDescendant =
    open && resultCount > 0 ? `${listboxId}-option-${highlightedIndex}` : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn("relative min-w-0", containerClassName)}>
          {showSearchIcon ? (
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          ) : null}
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
                const customer = data[highlightedIndex];
                if (customer) pickCustomer(customer);
              }
            }}
            placeholder={placeholder}
            className={cn(
              "h-7 font-mono text-base sm:h-9 sm:text-sm",
              className,
              showSearchIcon && "pl-9",
            )}
            onBlur={() => {
              setFocused(false);
              window.setTimeout(() => setOpen(false), 120);
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
        sideOffset={6}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-[min(22rem,calc(100vw-24px))] p-1"
      >
        <div
          id={listboxId}
          role="listbox"
          aria-label="客户搜索结果"
          className="max-h-72 min-w-0 overflow-y-auto"
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
            data.map((customer, index) => {
              const selected = customer.id === selectedCustomerId;
              const highlighted = index === highlightedIndex;
              return (
                <button
                  key={customer.id}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={highlighted}
                  className={cn(
                    "flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors",
                    highlighted ? "bg-accent text-accent-foreground" : "hover:bg-accent/70",
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pickCustomer(customer)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold leading-4">
                      {customer.name}
                    </span>
                    <span className="block truncate font-mono text-[11px] leading-4 text-muted-foreground">
                      {customer.phone_e164}
                      {customer.contact_phones.length
                        ? ` · 备用 ${customer.contact_phones.length}`
                        : ""}
                    </span>
                  </span>
                  {selected ? (
                    <Check className="size-3.5 shrink-0 text-primary" />
                  ) : (
                    <span className="shrink-0 text-[10px] font-medium text-primary">选择</span>
                  )}
                </button>
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
      {icon}
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
