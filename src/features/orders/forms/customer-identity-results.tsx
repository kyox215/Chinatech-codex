import { AlertTriangle, Check, Loader2, RefreshCw, UserPlus, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LookupNotice } from "@/features/orders/forms/customer-identity-status";
import type { CustomerIntakeCandidate } from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";

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
  const phoneBasis = Boolean(phone);

  return (
    <div
      data-customer-identity-results="true"
      className="min-w-0 max-w-full overflow-hidden rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-1 shadow-[var(--shadow-card)]"
    >
      <div className="flex min-w-0 items-start justify-between gap-2 px-2 py-1.5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold leading-4">
            {phoneBasis ? "按电话匹配客户" : "按姓名匹配客户"}
          </p>
          <p className="truncate text-[9.5px] leading-3 text-muted-foreground">
            {phoneBasis
              ? name
                ? `电话 ${phone} · 姓名仅排序同号结果`
                : `电话 ${phone}`
              : `姓名 ${name}`}
          </p>
        </div>
        {trustedResult ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
            {candidates.length} 位候选
          </span>
        ) : null}
      </div>

      {!isOnline ? (
        <LookupNotice tone="danger" icon={<AlertTriangle className="size-3.5" />}>
          离线时无法确认客户身份，请联网后重试；不会把离线状态当作无匹配。
        </LookupNotice>
      ) : isSearching ? (
        <div aria-busy="true" className="grid gap-1 px-1 pb-1">
          <LookupNotice icon={<Loader2 className="size-3.5 animate-spin" />}>
            正在核对客户…
          </LookupNotice>
          <div className="h-11 animate-pulse rounded-lg bg-card" />
          <div className="h-11 animate-pulse rounded-lg bg-card" />
        </div>
      ) : queryError ? (
        <LookupNotice tone="danger" icon={<AlertTriangle className="size-3.5" />}>
          <span className="min-w-0 flex-1">暂时无法确认是否已有客户：{queryError}</span>
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={onRetry}>
            <RefreshCw className="mr-1 size-3" />
            重试
          </Button>
        </LookupNotice>
      ) : (
        <>
          <div
            id={listboxId}
            role="listbox"
            aria-label="客户匹配结果"
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
                    ? `未找到使用 ${phone} 的客户，不会显示电话号码不同的同名客户。`
                    : "暂未找到电话候选；请继续输入完整号码后再决定是否新建。"
                  : `未找到姓名为 ${name} 的客户。`}
              </LookupNotice>
            )}
          </div>
          <div className="mt-1 border-t border-[var(--border-panel)] p-1 pt-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full whitespace-normal px-2 text-xs"
              disabled={!trustedResult || !phoneReadyForCreation}
              onClick={onRequestNewCustomer}
            >
              <UserPlus className="mr-1.5 size-3.5 shrink-0" />
              {phoneBasis
                ? phoneReadyForCreation
                  ? "不使用这些结果，按当前资料新建客户"
                  : "请先输入完整电话号码"
                : "先填写电话，再按当前资料新建"}
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
  const badge = customerMatchBadge(candidate, phoneBasis, hasNameQuery);
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={selected}
      className={cn(
        "mb-1 grid min-h-11 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[var(--border-panel)] bg-card px-2 py-1.5 text-left outline-none transition-colors last:mb-0 hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring",
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
          {candidate.customer.name || "未命名客户"}
        </span>
        <span className="block truncate font-mono text-[10.5px] font-medium leading-4 text-muted-foreground">
          {candidate.customer.phone_e164}
        </span>
        <span className="block truncate text-[9px] font-semibold leading-3 text-primary">
          {badge}
        </span>
      </span>
      {selected ? (
        <Check className="size-3.5 shrink-0 text-primary" />
      ) : (
        <span className="shrink-0 text-[10px] font-semibold text-primary">选择</span>
      )}
    </button>
  );
}

function customerMatchBadge(
  candidate: CustomerIntakeCandidate,
  phoneBasis: boolean,
  hasNameQuery: boolean,
) {
  if (!phoneBasis) {
    if (candidate.nameMatchKind === "exact") return "姓名一致";
    if (candidate.nameMatchKind === "prefix" || candidate.nameMatchKind === "contains") {
      return "姓名相似";
    }
    return "姓名候选";
  }
  const phoneLabel = candidate.exactMatch ? "电话相同" : "电话候选";
  if (!hasNameQuery) return phoneLabel;
  if (candidate.nameMatchKind === "exact") return `${phoneLabel} · 姓名一致`;
  if (candidate.nameMatchKind === "prefix" || candidate.nameMatchKind === "contains") {
    return `${phoneLabel} · 姓名相似`;
  }
  return `${phoneLabel} · 姓名不同，请确认`;
}
