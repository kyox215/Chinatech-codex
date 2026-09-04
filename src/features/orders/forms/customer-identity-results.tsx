import { AlertTriangle, Check, Loader2, RefreshCw, UserPlus, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LookupNotice } from "@/features/orders/forms/customer-identity-status";
import type { CustomerIntakeCandidate } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

export function CustomerIdentityResultsPanel({
  listboxId,
  phone,
  name,
  phoneReadyForCreation,
  isOnline,
  isSearching,
  queryError,
  trustedResult,
  candidates,
  highlightedIndex,
  selectedCustomerId,
  onHighlight,
  onPickCustomer,
  onRetry,
  onRequestNewCustomer,
}: {
  listboxId: string;
  phone: string;
  name: string;
  phoneReadyForCreation: boolean;
  isOnline: boolean;
  isSearching: boolean;
  queryError: string;
  trustedResult: boolean;
  candidates: CustomerIntakeCandidate[];
  highlightedIndex: number | null;
  selectedCustomerId?: string;
  onHighlight: (index: number) => void;
  onPickCustomer: (candidate: CustomerIntakeCandidate) => void;
  onRetry: () => void;
  onRequestNewCustomer: () => void;
}) {
  const { t } = useLocale();
  const phoneBasis = Boolean(phone);

  return (
    <div
      data-customer-identity-results="true"
      className="min-w-0 max-w-full overflow-hidden rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-1 shadow-[var(--shadow-card)]"
    >
      <div className="flex min-w-0 items-start justify-between gap-2 px-2 py-1.5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold leading-4 lg:text-xs lg:leading-4">
            {t(phoneBasis ? "orders2b1.new.results.byPhone" : "orders2b1.new.results.byName")}
          </p>
          <p className="truncate text-[9.5px] leading-3 text-muted-foreground lg:text-xs lg:leading-4">
            {phoneBasis
              ? name
                ? t("orders2b1.new.results.phoneAndName", { phone })
                : t("orders2b1.new.results.phone", { phone })
              : t("orders2b1.new.results.name", { name })}
          </p>
        </div>
        {trustedResult ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary lg:text-xs lg:leading-4">
            {t("orders2b1.new.results.candidates", { count: candidates.length })}
          </span>
        ) : null}
      </div>

      {!isOnline ? (
        <LookupNotice tone="danger" icon={<AlertTriangle className="size-3.5" />}>
          {t("orders2b1.new.results.offline")}
        </LookupNotice>
      ) : isSearching ? (
        <div aria-busy="true" className="grid gap-1 px-1 pb-1">
          <LookupNotice icon={<Loader2 className="size-3.5 animate-spin" />}>
            {t("orders2b1.new.results.checking")}
          </LookupNotice>
          <div className="h-[38px] animate-pulse rounded-lg bg-card" />
          <div className="h-[38px] animate-pulse rounded-lg bg-card" />
        </div>
      ) : queryError ? (
        <LookupNotice tone="danger" icon={<AlertTriangle className="size-3.5" />}>
          <span className="min-w-0 flex-1">{t("orders2b1.new.results.error")}</span>
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={onRetry}>
            <RefreshCw className="mr-1 size-3" />
            {t("common.retry")}
          </Button>
        </LookupNotice>
      ) : (
        <>
          <div
            id={listboxId}
            role="listbox"
            aria-label={t("orders2b1.new.results.aria")}
            className="max-h-[min(18rem,calc(100dvh_-_var(--rd-overlay-avoid-bottom,0px)_-_8rem))] min-w-0 overflow-y-auto px-1"
          >
            {candidates.length ? (
              candidates.map((candidate, index) => (
                <CustomerIdentityCandidateOption
                  key={candidate.customer.id}
                  id={`${listboxId}-option-${index}`}
                  candidate={candidate}
                  phoneBasis={phoneBasis}
                  hasNameQuery={Boolean(name)}
                  selected={candidate.customer.id === selectedCustomerId}
                  highlighted={highlightedIndex === index}
                  onHighlight={() => onHighlight(index)}
                  onPick={() => onPickCustomer(candidate)}
                />
              ))
            ) : (
              <LookupNotice>
                {phoneBasis
                  ? phoneReadyForCreation
                    ? t("orders2b1.new.results.noPhone", { phone })
                    : t("orders2b1.new.results.morePhone")
                  : t("orders2b1.new.results.noName", { name })}
              </LookupNotice>
            )}
          </div>
          <div className="mt-1 border-t border-[var(--border-panel)] p-1 pt-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-9 w-full whitespace-normal px-2 text-xs"
              disabled={!trustedResult || !phoneReadyForCreation}
              onClick={onRequestNewCustomer}
            >
              <UserPlus className="mr-1.5 size-3.5 shrink-0" />
              {phoneBasis
                ? phoneReadyForCreation
                  ? t("orders2b1.new.results.createCurrent")
                  : t("orders2b1.new.results.enterPhone")
                : t("orders2b1.new.results.phoneFirst")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function CustomerIdentityCandidateOption({
  id,
  candidate,
  phoneBasis,
  hasNameQuery,
  selected,
  highlighted,
  onHighlight,
  onPick,
}: {
  id: string;
  candidate: CustomerIntakeCandidate;
  phoneBasis: boolean;
  hasNameQuery: boolean;
  selected: boolean;
  highlighted: boolean;
  onHighlight: () => void;
  onPick: () => void;
}) {
  const { t } = useLocale();
  const badge = customerMatchBadge(candidate, phoneBasis, hasNameQuery, t);
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={selected}
      className={cn(
        "mb-1 grid min-h-9 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[var(--border-panel)] bg-card px-2 py-1 text-left outline-none transition-colors last:mb-0 hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring",
        highlighted && "border-primary/35 ring-1 ring-primary/20",
      )}
      onMouseEnter={onHighlight}
      onFocus={onHighlight}
      onClick={onPick}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <UserRound className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold leading-4">
          {candidate.customer.name || t("orders2b1.new.lookup.unnamed")}
        </span>
        <span className="block truncate font-mono text-[10.5px] font-medium leading-4 text-muted-foreground lg:text-xs lg:leading-4">
          {candidate.customer.phone_e164}
        </span>
        <span className="block truncate text-[9px] font-semibold leading-3 text-primary lg:text-xs lg:leading-4">
          {badge}
        </span>
      </span>
      {selected ? (
        <Check className="size-3.5 shrink-0 text-primary" />
      ) : (
        <span className="shrink-0 text-[10px] font-semibold text-primary lg:text-xs lg:leading-4">
          {t("orders2b1.new.results.select")}
        </span>
      )}
    </button>
  );
}

function customerMatchBadge(
  candidate: CustomerIntakeCandidate,
  phoneBasis: boolean,
  hasNameQuery: boolean,
  t: ReturnType<typeof useLocale>["t"],
) {
  if (!phoneBasis) {
    if (candidate.nameMatchKind === "exact") return t("orders2b1.new.results.nameExact");
    if (candidate.nameMatchKind === "prefix" || candidate.nameMatchKind === "contains") {
      return t("orders2b1.new.results.nameSimilar");
    }
    return t("orders2b1.new.results.nameCandidate");
  }
  const phoneLabel = t(
    candidate.exactMatch
      ? "orders2b1.new.results.phoneExact"
      : "orders2b1.new.results.phoneCandidate",
  );
  if (!hasNameQuery) return phoneLabel;
  if (candidate.nameMatchKind === "exact")
    return `${phoneLabel} · ${t("orders2b1.new.results.nameExact")}`;
  if (candidate.nameMatchKind === "prefix" || candidate.nameMatchKind === "contains") {
    return `${phoneLabel} · ${t("orders2b1.new.results.nameSimilar")}`;
  }
  return t("orders2b1.new.results.nameDifferent", { phone: phoneLabel });
}
