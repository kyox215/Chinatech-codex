import {
  CUSTOMER_STATUS_LEGACY_TOKEN_PATTERN,
  CUSTOMER_STATUS_STABLE_TOKEN_PATTERN,
  parseCustomerStatusLink,
} from "@/entities/customer-status/model/customer-status-link";
import type { CapturePayload } from "@/features/capture/model/barcode-parser";
import { buildOrderDetailWorkspaceHref } from "@/features/orders/model/order-workspace-intent";

const trustedProductionHosts = new Set(["chinatech.in", "www.chinatech.in"]);
const orderIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function parseOrderQrPayload(
  rawValue: string,
  origin = "http://localhost:3000",
): CapturePayload {
  const raw = rawValue.trim();
  const invalid = (): CapturePayload => ({
    kind: "text",
    raw,
    value: "",
    label: "不是有效订单二维码",
  });
  const invalidCustomerStatus = (): CapturePayload => ({
    kind: "customer_status_link",
    raw: "",
    value: "",
    label: "无效客户工单二维码",
    sensitive: true,
  });
  if (!raw) return invalid();

  const customerStatus = parseCustomerStatusLink(raw, origin);
  if (customerStatus?.kind === "valid") {
    return {
      kind: "customer_status_link",
      raw: "",
      value: "",
      label: "客户维修状态二维码",
      targetHref: customerStatus.href,
      sensitive: true,
    };
  }
  if (customerStatus?.kind === "invalid" || containsDelimitedCustomerStatusToken(raw)) {
    return invalidCustomerStatus();
  }

  const prefixedOrderId = raw.match(/^order:([A-Za-z0-9][A-Za-z0-9_-]{0,127})$/i)?.[1];
  if (prefixedOrderId) return orderPayload(raw, prefixedOrderId);

  let url: URL;
  let base: URL;
  try {
    base = new URL(origin);
    if (raw.startsWith("//") || raw.includes("\\")) return invalid();
    url = new URL(raw, base);
  } catch {
    return invalid();
  }

  const hasExplicitOrigin = /^[a-z][a-z\d+.-]*:/i.test(raw);
  if (url.username || url.password || url.hash || url.search) return invalid();
  if (hasExplicitOrigin && !isTrustedOrderOrigin(url, base)) return invalid();

  const path = url.pathname.replace(/\/+$/, "") || "/";
  const match = path.match(/^\/orders\/([^/]+)(?:\/task)?$/);
  const orderId = match?.[1] ? decodeOrderId(match[1]) : "";
  return orderId ? orderPayload(raw, orderId) : invalid();
}

function orderPayload(raw: string, orderId: string): CapturePayload {
  return {
    kind: "order_link",
    raw,
    value: orderId,
    label: "订单二维码",
    targetHref: buildOrderDetailWorkspaceHref(orderId, { source: "order-qr" }),
  };
}

function decodeOrderId(value: string) {
  try {
    const decoded = decodeURIComponent(value);
    return orderIdPattern.test(decoded) ? decoded : "";
  } catch {
    return "";
  }
}

function isTrustedOrderOrigin(url: URL, base: URL) {
  if (url.origin === base.origin) {
    return url.protocol === "https:" || isLocalOrigin(url);
  }
  return (
    url.protocol === "https:" &&
    trustedProductionHosts.has(url.hostname) &&
    !url.port &&
    (isLocalOrigin(base) || trustedProductionHosts.has(base.hostname))
  );
}

function isLocalOrigin(url: URL) {
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}

function containsDelimitedCustomerStatusToken(raw: string) {
  const stableSegments = raw.split(/[^A-Za-z0-9._-]+/);
  if (stableSegments.some(containsStableCustomerStatusToken)) return true;

  return raw
    .split(/[^A-Za-z0-9_-]+/)
    .some((segment) => CUSTOMER_STATUS_LEGACY_TOKEN_PATTERN.test(segment));
}

function containsStableCustomerStatusToken(segment: string) {
  const components = segment.split(".");
  for (let index = 0; index <= components.length - 5; index += 1) {
    const candidate = components.slice(index, index + 5).join(".");
    if (CUSTOMER_STATUS_STABLE_TOKEN_PATTERN.test(candidate)) return true;
  }
  return false;
}
