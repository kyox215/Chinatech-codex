"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import { searchCustomers, type Customer } from "@/lib/repairdesk/api";

export function CustomerPhoneLookup({
  value,
  selectedCustomerId,
  onChange,
  onPick,
}: {
  value: string;
  selectedCustomerId?: string;
  onChange: (value: string) => void;
  onPick: (customer: Customer) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["customer-suggest", value],
    queryFn: () => searchCustomers(value),
    enabled: value.trim().length > 0,
    staleTime: 30_000,
  });
  const normalizedPhone = value.replace(/\D/g, "");
  const exactCustomer = useMemo(
    () =>
      normalizedPhone
        ? data.find(
            (customer) =>
              customer.phone_raw === normalizedPhone || customer.phone_e164 === value.trim(),
          )
        : undefined,
    [data, normalizedPhone, value],
  );

  useEffect(() => {
    if (!exactCustomer || exactCustomer.id === selectedCustomerId) return;
    void onPick(exactCustomer);
    setOpen(false);
  }, [exactCustomer, onPick, selectedCustomerId]);

  useEffect(() => {
    setOpen(value.trim().length > 0 && data.length > 0);
  }, [data.length, value]);

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="输入电话搜索客户"
        className="font-mono"
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => value && data.length > 0 && setOpen(true)}
      />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border/70 bg-popover p-1 shadow-elevated">
          {data.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  void onPick(customer);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{customer.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {customer.phone_e164}
                </span>
                <Check className="size-3.5 text-primary" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
