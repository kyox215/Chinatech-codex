export type CapturePayloadKind =
  | "order_link"
  | "customer_link"
  | "inventory_link"
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
}

const IMEI_PATTERN = /^\d{14,17}$/;
const SERIAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,63}$/;

export function normalizeCaptureIdentifier(value: string) {
  return value
    .trim()
    .replace(/[\s\-:：_.,/\\|]+/g, "")
    .replace(/[^A-Za-z0-9]/g, "");
}

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
  let url: URL;
  try {
    url = new URL(raw, origin);
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
      targetHref: `/orders/${orderMatch[1]}`,
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
    return {
      kind: "inventory_link",
      raw,
      value: url.searchParams.get("id") ?? path,
      label: "库存链接",
      targetHref: `${path}${url.search}`,
    };
  }

  return null;
}

function parsePrefixedPayload(raw: string): CapturePayload | null {
  const match = raw.match(/^(order|customer|inventory|imei|serial):(.+)$/i);
  if (!match) return null;

  const type = match[1].toLowerCase();
  const value = match[2].trim();

  if (type === "order") {
    return {
      kind: "order_link",
      raw,
      value,
      label: "工单编号",
      targetHref: `/orders/${encodeURIComponent(value)}`,
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
      targetHref: `/inventory?id=${encodeURIComponent(value)}`,
    };
  }

  return {
    kind: type === "imei" ? "imei" : "serial",
    raw,
    value: normalizeCaptureIdentifier(value),
    label: type === "imei" ? "IMEI / 序列号" : "序列号",
  };
}

function isUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
