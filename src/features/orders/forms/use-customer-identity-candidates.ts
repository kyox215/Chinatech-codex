"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { customersKeys } from "@/features/customers/api/query-keys";
import {
  compareCustomerIntakeMatches,
  getCustomerIntakeNameMatchKind,
  getCustomerIntakePhoneMatchKind,
  normalizeCustomerIntakeName,
} from "@/features/customers/model/customer-intake-search";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";
import {
  searchCustomerIntakeCandidates,
  type CustomerIntakeCandidate,
  type CustomerIntakeSearchInput,
} from "@/lib/repairdesk/api";
import { normalizePhoneKeypadDraft } from "@/shared/lib/mobile-input";
import { primaryPhoneRaw } from "@/shared/lib/phone";

const EMPTY_CANDIDATES: CustomerIntakeCandidate[] = [];

export function useCustomerIdentityCandidates({
  phone,
  name,
  limit,
  deviceLimit,
}: {
  phone: string;
  name: string;
  limit: number;
  deviceLimit: number;
}) {
  const isOnline = useOnlineStatus();
  const shell = useStoreShellContext();
  const normalizedPhone = normalizePhoneKeypadDraft(phone);
  const phoneRaw = primaryPhoneRaw(normalizedPhone);
  const normalizedName = name.trim();
  const nameHasDigits = /\d/.test(normalizedName);
  const phonePresent = Boolean(normalizedPhone.trim());
  const searchEnabled = phonePresent
    ? phoneRaw.length >= 3
    : normalizedName.length >= 2 && !nameHasDigits;
  const currentIntentKey = searchEnabled
    ? JSON.stringify({ phone: normalizedPhone, name: normalizedName })
    : "";
  const debouncedIntentKey = useDebouncedValue(currentIntentKey, 180);
  const activeLimit = Math.min(12, Math.max(1, limit));
  const activeDeviceLimit = Math.min(8, Math.max(1, deviceLimit));
  const searchInput = useMemo<CustomerIntakeSearchInput>(() => {
    if (!debouncedIntentKey) return { phone: "", name: "" };
    const parsed = JSON.parse(debouncedIntentKey) as { phone: string; name: string };
    const phoneMatchMode = parsed.phone && parsed.name ? "exact" : "progressive";
    return {
      phone: parsed.phone || undefined,
      name: parsed.name || undefined,
      phoneMatchMode,
      limit: activeLimit,
      deviceLimit: activeDeviceLimit,
    };
  }, [activeDeviceLimit, activeLimit, debouncedIntentKey]);

  const candidateQuery = useQuery({
    queryKey: customersKeys.intakeSearch(searchInput, shell.activeStore?.id),
    queryFn: () => searchCustomerIntakeCandidates(searchInput),
    enabled: Boolean(debouncedIntentKey && isOnline),
    staleTime: 90_000,
    gcTime: 5 * 60_000,
    retry: false,
  });
  const intentIsCurrent = Boolean(
    currentIntentKey && debouncedIntentKey && currentIntentKey === debouncedIntentKey,
  );
  const isSearching = Boolean(
    searchEnabled &&
    isOnline &&
    (!intentIsCurrent || (candidateQuery.isFetching && candidateQuery.data === undefined)),
  );
  const rawCandidates =
    intentIsCurrent && isOnline ? (candidateQuery.data ?? EMPTY_CANDIDATES) : EMPTY_CANDIDATES;
  const candidates = useMemo(
    () =>
      rawCandidates
        .flatMap((candidate): CustomerIntakeCandidate[] => {
          if (!phoneRaw) {
            return [
              {
                ...candidate,
                nameMatchKind:
                  candidate.nameMatchKind ??
                  getCustomerIntakeNameMatchKind(
                    candidate.customer.name,
                    normalizeCustomerIntakeName(normalizedName),
                  ),
              },
            ];
          }
          const phoneMatchKind = getCustomerIntakePhoneMatchKind(
            candidate.customer,
            phoneRaw,
            normalizedName ? "exact" : "progressive",
          );
          if (!phoneMatchKind) return [];
          return [
            {
              ...candidate,
              exactMatch:
                phoneMatchKind === "exact_primary" || phoneMatchKind === "exact_alternate",
              phoneMatchKind,
              nameMatchKind:
                candidate.nameMatchKind ??
                getCustomerIntakeNameMatchKind(
                  candidate.customer.name,
                  normalizeCustomerIntakeName(normalizedName),
                ),
            },
          ];
        })
        .sort(compareCustomerIntakeMatches),
    [normalizedName, phoneRaw, rawCandidates],
  );
  const queryError = candidateQuery.error instanceof Error ? candidateQuery.error.message : "";
  const trustedResult = Boolean(
    searchEnabled && intentIsCurrent && isOnline && !isSearching && !queryError,
  );

  return {
    candidates,
    currentIntentKey,
    isOnline,
    isSearching,
    nameHasDigits,
    normalizedName,
    normalizedPhone,
    phonePresent,
    phoneRaw,
    phoneReadyForCreation: phoneRaw.length >= 8,
    queryError,
    retry: () => void candidateQuery.refetch(),
    searchEnabled,
    trustedResult,
  };
}

function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debounced;
}
