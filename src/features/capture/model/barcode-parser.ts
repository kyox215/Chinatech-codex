import {
  CUSTOMER_STATUS_LEGACY_TOKEN_PATTERN,
  CUSTOMER_STATUS_STABLE_TOKEN_PATTERN,
  parseCustomerStatusLink as parseCustomerStatusEntityLink,
} from "@/entities/customer-status/model/customer-status-link";
import { buildOrderDetailWorkspaceHref } from "@/features/orders/model/order-workspace-intent";

export type CapturePayloadKind =
  | "order_link"
  | "customer_link"
  | "inventory_link"
  | "buyback_link"
  | "customer_status_link"
  | "imei"
  | "serial"
  | "url"
  | "text";

export interface CapturePayload {
  kind: CapturePayloadKind;
  raw: string;
  value: string;
  label: string;
  targetHref?: string;
  sensitive?: boolean;
}

export {
  extractImeiCandidates,
  isValidImei,
  normalizeCaptureIdentifier,
  getPreferredImeiCandidate,
} from "@/shared/lib/imei-candidates";
export type {
  ImeiCaptureSource,
  ImeiCandidateKind,
  ImeiCandidate,
} from "@/shared/lib/imei-candidates";
import {
  normalizeCaptureIdentifier,
  IMEI_PATTERN,
  SERIAL_PATTERN,
} from "@/shared/lib/imei-candidates";

export function parseBarcodePayload(rawValue: string, origin = "http://localhost:3000") {
  const raw = rawValue.trim();
  const normalized = normalizeCaptureIdentifier(raw);

  if (!raw) {
    return {
      kind: "text",
      raw,
      value: "",
      label: "空内容",
    } satisfies CapturePayload;
  }

  const internalLink = parseInternalLink(raw, origin);
  if (internalLink) return internalLink;

  const prefixed = parsePrefixedPayload(raw);
  if (prefixed) return prefixed;

  const labeledIdentifier = parseLabeledIdentifier(raw);
  if (labeledIdentifier) return labeledIdentifier;

  if (IMEI_PATTERN.test(normalized)) {
    return {
      kind: "imei",
      raw,
      value: normalized,
      label: "IMEI / 序列号",
    } satisfies CapturePayload;
  }

  if (SERIAL_PATTERN.test(raw) && normalized.length >= 6) {
    return {
      kind: "serial",
      raw,
      value: normalized,
      label: "序列号",
    } satisfies CapturePayload;
  }

  if (isUrl(raw)) {
    return {
      kind: "url",
      raw,
      value: raw,
      label: "外部链接",
      targetHref: raw,
    } satisfies CapturePayload;
  }

  return {
    kind: "text",
    raw,
    value: raw,
    label: "文本内容",
  } satisfies CapturePayload;
}

function parseInternalLink(raw: string, origin: string): CapturePayload | null {
  const customerStatusLink = parseCustomerStatusPayload(raw, origin);
  if (customerStatusLink) return customerStatusLink;

  let url: URL;
  try {
    const base = new URL(origin);
    const isAbsoluteUrl = /^[a-z][a-z\d+.-]*:/i.test(raw);
    if (raw.startsWith("//")) return null;

    url = new URL(raw, base);
    if (isAbsoluteUrl && url.origin !== base.origin) return null;
  } catch {
    return null;
  }

  const path = url.pathname.replace(/\/+$/, "") || "/";
  const orderTaskMatch = path.match(/^\/orders\/([^/]+)\/task$/);
  if (orderTaskMatch?.[1]) {
    return {
      kind: "order_link",
      raw,
      value: orderTaskMatch[1],
      label: "工单任务",
      targetHref: `/orders/${orderTaskMatch[1]}/task`,
    };
  }

  const orderMatch = path.match(/^\/orders\/([^/]+)$/);
  if (orderMatch?.[1]) {
    return {
      kind: "order_link",
      raw,
      value: orderMatch[1],
      label: "工单链接",
      targetHref: buildOrderDetailWorkspaceHref(orderMatch[1], { source: "scanner" }),
    };
  }

  const customerMatch = path.match(/^\/customers\/([^/]+)$/);
  if (customerMatch?.[1]) {
    return {
      kind: "customer_link",
      raw,
      value: customerMatch[1],
      label: "客户链接",
      targetHref: `/customers/${customerMatch[1]}`,
    };
  }

  if (path.startsWith("/inventory")) {
    const itemId = url.searchParams.get("item") ?? url.searchParams.get("id");
    return {
      kind: "inventory_link",
      raw,
      value: itemId ?? path,
      label: "库存链接",
      targetHref: itemId ? `/inventory?item=${encodeURIComponent(itemId)}` : `${path}${url.search}`,
    };
  }

  if (path.startsWith("/buyback")) {
    return {
      kind: "buyback_link",
      raw,
      value: url.searchParams.get("id") ?? url.searchParams.get("record") ?? path,
      label: "回收记录",
      targetHref: `${path}${url.search}`,
    };
  }

  return null;
}

function parseCustomerStatusPayload(raw: string, origin: string): CapturePayload | null {
  const parsed = parseCustomerStatusEntityLink(raw, origin);
  if (parsed?.kind === "valid") {
    return {
      kind: "customer_status_link",
      raw: "",
      value: "",
      label: "客户工单二维码",
      targetHref: parsed.href,
      sensitive: true,
    } satisfies CapturePayload;
  }

  if (parsed?.kind !== "invalid" && !containsDelimitedCustomerStatusToken(raw)) return null;

  return {
    kind: "customer_status_link",
    raw: "",
    value: "",
    label: "无效客户工单二维码",
    sensitive: true,
  } satisfies CapturePayload;
}

function containsDelimitedCustomerStatusToken(raw: string) {
  const stableSegments = raw.split(/[^A-Za-z0-9._-]+/).filter(Boolean);
  const containsStableToken = stableSegments.some((segment) => {
    const components = segment.split(".");
    for (let index = 0; index <= components.length - 5; index += 1) {
      if (CUSTOMER_STATUS_STABLE_TOKEN_PATTERN.test(components.slice(index, index + 5).join("."))) {
        return true;
      }
    }
    return false;
  });
  if (containsStableToken) return true;

  return raw
    .split(/[^A-Za-z0-9_-]+/)
    .some((segment) => CUSTOMER_STATUS_LEGACY_TOKEN_PATTERN.test(segment));
}

function parsePrefixedPayload(raw: string): CapturePayload | null {
  const match = raw.match(/^(order|customer|inventory|buyback|imei|serial|sn):(.+)$/i);
  if (!match) return null;

  const type = match[1].toLowerCase();
  const value = match[2].trim();

  if (type === "order") {
    return {
      kind: "order_link",
      raw,
      value,
      label: "工单编号",
      targetHref: buildOrderDetailWorkspaceHref(value, { source: "scanner" }),
    };
  }

  if (type === "customer") {
    return {
      kind: "customer_link",
      raw,
      value,
      label: "客户编号",
      targetHref: `/customers/${encodeURIComponent(value)}`,
    };
  }

  if (type === "inventory") {
    return {
      kind: "inventory_link",
      raw,
      value,
      label: "库存编号",
      targetHref: `/inventory?item=${encodeURIComponent(value)}`,
    };
  }

  if (type === "buyback") {
    return {
      kind: "buyback_link",
      raw,
      value,
      label: "回收记录",
      targetHref: `/buyback?id=${encodeURIComponent(value)}`,
    };
  }

  return {
    kind: type === "imei" ? "imei" : "serial",
    raw,
    value: normalizeCaptureIdentifier(value),
    label: type === "imei" ? "IMEI / 序列号" : "序列号",
  };
}

function parseLabeledIdentifier(raw: string): CapturePayload | null {
  const imeiMatch = raw.match(
    /\b(?:IMEI|IMEI\s*[12]|MEID)\b\s*(?:[:：#-])?\s*([0-9][0-9\s\-:：_.,/\\|]{12,24}[0-9])/i,
  );
  if (imeiMatch?.[1]) {
    const value = normalizeCaptureIdentifier(imeiMatch[1]);
    if (IMEI_PATTERN.test(value)) {
      return {
        kind: "imei",
        raw,
        value,
        label: "IMEI / 序列号",
      };
    }
  }

  const serialMatch = raw.match(
    /\b(?:SERIAL\s*NUMBER|SERIAL\s*NO\.?|S\/N|SN|SERIAL)\b\s*(?:[:：#-])?\s*([A-Z0-9][A-Z0-9._:-]{5,63})/i,
  );
  if (serialMatch?.[1]) {
    const value = normalizeCaptureIdentifier(serialMatch[1]);
    if (SERIAL_PATTERN.test(value)) {
      return {
        kind: "serial",
        raw,
        value,
        label: "序列号",
      };
    }
  }

  return null;
}

function isUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
