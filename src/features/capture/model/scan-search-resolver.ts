import type { CapturePayload } from "@/features/capture/model/barcode-parser";
import { getCapturePayloadDisplayLabel } from "@/features/capture/model/capture-presentation";
import { translateMessage } from "@/shared/i18n/messages";
import type { AppLocale } from "@/shared/i18n/locales";

export type ScanSearchScope = "global" | "orders" | "customers" | "buyback" | "inventory";

export type ScanSearchAction =
  | {
      id: string;
      kind: "open";
      label: string;
      href: string;
      primary?: boolean;
    }
  | {
      id: string;
      kind: "search";
      scope: Exclude<ScanSearchScope, "global">;
      label: string;
      searchValue: string;
      href: string;
      primary?: boolean;
    };

export interface ScanSearchResolution {
  title: string;
  hint: string;
  actions: ScanSearchAction[];
}

const searchHrefByScope: Record<Exclude<ScanSearchScope, "global">, () => string> = {
  orders: () => "/orders",
  customers: () => "/customers",
  buyback: () => "/buyback",
  inventory: () => "/inventory",
};

export function getScanSearchScopeLabel(scope: ScanSearchScope, locale: AppLocale = "zh-CN") {
  const keys = {
    global: "scanSearch.scope.global",
    orders: "scanSearch.scope.orders",
    customers: "scanSearch.scope.customers",
    buyback: "scanSearch.scope.buyback",
    inventory: "scanSearch.scope.inventory",
  } as const;
  return translateMessage(locale, keys[scope]);
}

export function resolveScanSearchActions(
  payload: CapturePayload,
  scope: ScanSearchScope,
  locale: AppLocale = "zh-CN",
): ScanSearchResolution {
  const searchValue = getScanSearchValue(payload);
  const actions: ScanSearchAction[] = [];
  const exactHref = getInternalTargetHref(payload);

  if (exactHref) {
    actions.push({
      id: `open:${payload.kind}`,
      kind: "open",
      label: getOpenActionLabel(payload, locale),
      href: exactHref,
      primary: true,
    });
  }

  if (scope === "global") {
    if (searchValue) {
      actions.push(
        buildRouteSearchAction("orders", searchValue, locale),
        buildRouteSearchAction("customers", searchValue, locale),
        buildRouteSearchAction("buyback", searchValue, locale),
        buildRouteSearchAction("inventory", searchValue, locale),
      );
    }
  } else if (searchValue) {
    actions.push({
      id: `search:${scope}`,
      kind: "search",
      scope,
      label: translateMessage(locale, "scanSearch.searchIn", {
        scope: getScanSearchScopeLabel(scope, locale),
      }),
      searchValue,
      href: searchHrefByScope[scope](),
      primary: actions.length === 0,
    });
  }

  return {
    title: getCapturePayloadDisplayLabel(payload, locale),
    hint: getResolutionHint(payload, scope, Boolean(exactHref), Boolean(searchValue), locale),
    actions: dedupeActions(actions),
  };
}

function buildRouteSearchAction(
  scope: Exclude<ScanSearchScope, "global">,
  searchValue: string,
  locale: AppLocale,
): ScanSearchAction {
  return {
    id: `search:${scope}`,
    kind: "search",
    scope,
    label: translateMessage(locale, "scanSearch.searchShort", {
      scope: getScanSearchScopeLabel(scope, locale),
    }),
    searchValue,
    href: searchHrefByScope[scope](),
  };
}

function getScanSearchValue(payload: CapturePayload) {
  if (payload.sensitive || payload.kind === "customer_status_link") return "";
  return (payload.value || payload.raw).trim();
}

function getInternalTargetHref(payload: CapturePayload) {
  if (payload.kind === "inventory_link") return getInventoryHref(payload);
  if (payload.kind === "buyback_link") return getBuybackHref(payload);
  if (!payload.targetHref || !isInternalHref(payload.targetHref)) return "";
  return payload.targetHref;
}

function getInventoryHref(payload: CapturePayload) {
  const parsed = parseInternalUrl(payload.targetHref || "");
  const itemId = parsed?.searchParams.get("item") || parsed?.searchParams.get("id");
  const value = getScanSearchValue(payload);
  if (itemId) return `/inventory?item=${encodeURIComponent(itemId)}`;
  if (value && !value.startsWith("/inventory"))
    return `/inventory?item=${encodeURIComponent(value)}`;
  if (payload.targetHref && isInternalHref(payload.targetHref)) return payload.targetHref;
  return "";
}

function getBuybackHref(payload: CapturePayload) {
  const parsed = parseInternalUrl(payload.targetHref || "");
  const recordId = parsed?.searchParams.get("id") || parsed?.searchParams.get("record");
  const value = getScanSearchValue(payload);
  if (recordId) return `/buyback?id=${encodeURIComponent(recordId)}`;
  if (value && !value.startsWith("/buyback")) return `/buyback?id=${encodeURIComponent(value)}`;
  if (payload.targetHref && isInternalHref(payload.targetHref)) return payload.targetHref;
  return "";
}

function parseInternalUrl(href: string) {
  if (!isInternalHref(href)) return null;
  try {
    return new URL(href, "http://repairdesk.local");
  } catch {
    return null;
  }
}

function isInternalHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

function getOpenActionLabel(payload: CapturePayload, locale: AppLocale) {
  const key =
    payload.kind === "customer_status_link"
      ? "scanSearch.viewOrder"
      : payload.kind === "order_link"
        ? "scanSearch.openOrder"
        : payload.kind === "customer_link"
          ? "scanSearch.openCustomer"
          : payload.kind === "inventory_link"
            ? "scanSearch.openInventory"
            : payload.kind === "buyback_link"
              ? "scanSearch.openBuyback"
              : "scanSearch.openTarget";
  return translateMessage(locale, key);
}

function getResolutionHint(
  payload: CapturePayload,
  scope: ScanSearchScope,
  hasExactHref: boolean,
  hasSearchValue: boolean,
  locale: AppLocale,
) {
  if (payload.kind === "customer_status_link" && hasExactHref) {
    return translateMessage(locale, "scanSearch.protectedHint");
  }
  if (payload.kind === "customer_status_link") {
    return translateMessage(locale, "scanSearch.protectedInvalidHint");
  }
  if (hasExactHref && scope !== "global") {
    return translateMessage(locale, "scanSearch.exactAndSearchHint");
  }
  if (hasExactHref) return translateMessage(locale, "scanSearch.exactHint");
  if (hasSearchValue)
    return translateMessage(locale, "scanSearch.searchHint", {
      scope: getScanSearchScopeLabel(scope, locale),
    });
  if (payload.kind === "url") return translateMessage(locale, "scanSearch.externalHint");
  return translateMessage(locale, "scanSearch.emptyHint");
}

function dedupeActions(actions: ScanSearchAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key =
      action.kind === "open" ? `${action.kind}:${action.href}` : `${action.kind}:${action.href}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
