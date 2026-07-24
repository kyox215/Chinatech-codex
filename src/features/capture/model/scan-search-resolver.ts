import type { CapturePayload } from "@/features/capture/model/barcode-parser";

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

const scopeLabels: Record<ScanSearchScope, string> = {
  global: "全局",
  orders: "订单",
  customers: "客户",
  buyback: "回收",
  inventory: "库存",
};

const searchHrefByScope: Record<Exclude<ScanSearchScope, "global">, () => string> = {
  orders: () => "/orders",
  customers: () => "/customers",
  buyback: () => "/buyback",
  inventory: () => "/inventory",
};

export function getScanSearchScopeLabel(scope: ScanSearchScope) {
  return scopeLabels[scope];
}

export function resolveScanSearchActions(
  payload: CapturePayload,
  scope: ScanSearchScope,
): ScanSearchResolution {
  if (payload.kind === "customer_status_link" && payload.targetHref) {
    return {
      title: payload.label,
      hint: "已安全识别维修工单二维码。系统会按当前登录身份打开内部工单或客户公开进度。",
      actions: [
        {
          id: "open:customer-status",
          kind: "open",
          label: "查看此订单",
          href: payload.targetHref,
          primary: true,
        },
      ],
    };
  }

  if (payload.kind === "customer_status_invalid") {
    return {
      title: payload.label,
      hint: "二维码格式无效、已损坏或来源不受信任，请重新扫描或重新打印。",
      actions: [],
    };
  }

  const searchValue = getScanSearchValue(payload);
  const actions: ScanSearchAction[] = [];
  const exactHref = getInternalTargetHref(payload);

  if (exactHref) {
    actions.push({
      id: `open:${payload.kind}`,
      kind: "open",
      label: getOpenActionLabel(payload),
      href: exactHref,
      primary: true,
    });
  }

  if (scope === "global") {
    if (searchValue) {
      actions.push(
        buildRouteSearchAction("orders", searchValue),
        buildRouteSearchAction("customers", searchValue),
        buildRouteSearchAction("buyback", searchValue),
        buildRouteSearchAction("inventory", searchValue),
      );
    }
  } else if (searchValue) {
    actions.push({
      id: `search:${scope}`,
      kind: "search",
      scope,
      label: `在${scopeLabels[scope]}搜索`,
      searchValue,
      href: searchHrefByScope[scope](),
      primary: actions.length === 0,
    });
  }

  return {
    title: payload.label,
    hint: getResolutionHint(payload, scope, Boolean(exactHref), Boolean(searchValue)),
    actions: dedupeActions(actions),
  };
}

function buildRouteSearchAction(
  scope: Exclude<ScanSearchScope, "global">,
  searchValue: string,
): ScanSearchAction {
  return {
    id: `search:${scope}`,
    kind: "search",
    scope,
    label: `搜${scopeLabels[scope]}`,
    searchValue,
    href: searchHrefByScope[scope](),
  };
}

function getScanSearchValue(payload: CapturePayload) {
  if (payload.kind === "url" || payload.sensitive) return "";
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

function getOpenActionLabel(payload: CapturePayload) {
  if (payload.kind === "order_link") return "打开工单";
  if (payload.kind === "customer_link") return "打开客户";
  if (payload.kind === "inventory_link") return "打开库存";
  if (payload.kind === "buyback_link") return "打开回收";
  if (payload.kind === "customer_status_link") return "查看此订单";
  return "打开目标";
}

function getResolutionHint(
  payload: CapturePayload,
  scope: ScanSearchScope,
  hasExactHref: boolean,
  hasSearchValue: boolean,
) {
  if (hasExactHref && scope !== "global") {
    return "已识别到其他页面目标，也可以只把内容填入当前搜索。";
  }
  if (hasExactHref) return "已识别到系统内部目标。";
  if (hasSearchValue) return `已识别到可查询内容，可用于${scopeLabels[scope]}搜索。`;
  if (payload.kind === "url") return "外部链接不会自动打开；如需使用请先复制核对。";
  return "没有可用的查询内容，请重新扫描或手动输入。";
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
