import { buildOrderDetailWorkspaceHref } from "@/features/orders/model/order-workspace-intent";

export type CapturePayloadKind =
  | "order_link"
  | "customer_link"
  | "inventory_link"
  | "buyback_link"
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

export type ImeiCaptureSource =
  | "camera"
  | "barcode"
  | "image"
  | "ocr"
  | "manual"
  | "paste"
  | "text";

export type ImeiCandidateKind = "imei" | "suspect_imei" | "serial";

export interface ImeiCandidate {
  id: string;
  kind: ImeiCandidateKind;
  raw: string;
  value: string;
  label: string;
  source: ImeiCaptureSource;
  confidence: "high" | "medium" | "low";
  isValidImei: boolean;
  reason?: string;
}

const IMEI_PATTERN = /^\d{14,17}$/;
const SERIAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,63}$/;
const CONTIGUOUS_IMEI_CANDIDATE_PATTERN = /(^|[^A-Za-z0-9])(\d{14,17})(?![A-Za-z0-9])/g;
const IMEI_DIGIT_CANDIDATE_PATTERN =
  /(^|[^A-Za-z0-9])((?:\d[\s\-:：_.,/\\|]*){14,17})(?![\s\-:：_.,/\\|]*\d)/g;
const LABELED_IMEI_CANDIDATE_PATTERN =
  /\b(IMEI\s*(?:1|2)?|MEID)\b\s*(?:[:：#-])?\s*((?:\d[\s\-:：_.,/\\|]*){14,17})(?![\s\-:：_.,/\\|]*\d)/gi;
const LABELED_SERIAL_CANDIDATE_PATTERN =
  /\b(SERIAL\s*NUMBER|SERIAL\s*NO\.?|S\/N|SN|SERIAL|ECID|EC)\b\s*(?:[:：#-])?\s*([A-Z0-9][A-Z0-9._:-]{5,63})/gi;

export function normalizeCaptureIdentifier(value: string) {
  return value
    .trim()
    .replace(/[\s\-:：_.,/\\|]+/g, "")
    .replace(/[^A-Za-z0-9]/g, "");
}

export function isValidImei(value: string) {
  const normalized = normalizeCaptureIdentifier(value);
  if (!/^\d{15}$/.test(normalized)) return false;

  let sum = 0;
  let doubleDigit = false;
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    let digit = Number(normalized[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

export function extractImeiCandidates(
  rawValue: string,
  options: {
    source?: ImeiCaptureSource;
    includeGenericSerial?: boolean;
  } = {},
) {
  const raw = rawValue.trim();
  const source = options.source ?? "text";
  const candidates: ImeiCandidate[] = [];
  const seen = new Set<string>();

  const pushCandidate = (candidate: Omit<ImeiCandidate, "id">) => {
    const key = `${candidate.kind}:${candidate.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({
      ...candidate,
      id: `${candidate.kind}:${candidate.value}:${candidates.length}`,
    });
  };

  const pushNumericCandidate = (candidateRaw: string, labelHint = "") => {
    const value = normalizeCaptureIdentifier(candidateRaw);
    if (!IMEI_PATTERN.test(value)) return;

    const valid = isValidImei(value);
    const label = normalizeIdentifierLabel(labelHint);
    pushCandidate({
      kind: valid ? "imei" : "suspect_imei",
      raw: candidateRaw.trim() || value,
      value,
      label: getNumericCandidateLabel(valid, label),
      source,
      confidence: valid ? "high" : "medium",
      isValidImei: valid,
      reason: valid ? undefined : getSuspectImeiReason(value),
    });
  };

  for (const match of raw.matchAll(LABELED_IMEI_CANDIDATE_PATTERN)) {
    pushNumericCandidate(match[2] ?? "", match[1] ?? "");
  }

  for (const match of raw.matchAll(CONTIGUOUS_IMEI_CANDIDATE_PATTERN)) {
    pushNumericCandidate(match[2] ?? "");
  }

  for (const match of raw.matchAll(IMEI_DIGIT_CANDIDATE_PATTERN)) {
    pushNumericCandidate(match[2] ?? "");
  }

  for (const match of raw.matchAll(LABELED_SERIAL_CANDIDATE_PATTERN)) {
    const value = normalizeCaptureIdentifier(match[2] ?? "");
    if (!SERIAL_PATTERN.test(value)) continue;
    pushCandidate({
      kind: "serial",
      raw: (match[2] ?? value).trim(),
      value,
      label: getSerialCandidateLabel(normalizeIdentifierLabel(match[1] ?? "")),
      source,
      confidence: "medium",
      isValidImei: false,
    });
  }

  const normalized = normalizeCaptureIdentifier(raw);
  const hasSameValueCandidate = candidates.some((candidate) => candidate.value === normalized);
  if (
    options.includeGenericSerial &&
    SERIAL_PATTERN.test(raw) &&
    normalized.length >= 6 &&
    candidates.length === 0 &&
    !hasSameValueCandidate
  ) {
    pushCandidate({
      kind: "serial",
      raw,
      value: normalized,
      label: "序列号",
      source,
      confidence: "medium",
      isValidImei: false,
    });
  }

  return candidates;
}

export function getPreferredImeiCandidate(candidates: readonly ImeiCandidate[]) {
  return (
    candidates.find((candidate) => candidate.kind === "imei") ??
    candidates.find((candidate) => candidate.kind === "serial") ??
    candidates[0] ??
    null
  );
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

function getSuspectImeiReason(value: string) {
  if (value.length !== 15) return "长度不是标准 15 位 IMEI。";
  return "15 位数字未通过 IMEI 校验位。";
}

function normalizeIdentifierLabel(label: string) {
  const normalized = label.toUpperCase().replace(/\s+/g, "");
  if (normalized === "IMEI1" || normalized === "IMEI2") return normalized;
  if (normalized === "IMEI" || normalized === "MEID") return normalized;
  if (normalized === "S/N" || normalized === "SN" || normalized.startsWith("SERIAL")) {
    return "SN";
  }
  if (normalized === "EC" || normalized === "ECID") return "ECID";
  return "";
}

function getNumericCandidateLabel(valid: boolean, label: string) {
  if (label) return valid ? label : `${label}（疑似）`;
  return valid ? "有效 IMEI" : "疑似 IMEI";
}

function getSerialCandidateLabel(label: string) {
  if (label === "ECID") return "ECID";
  if (label === "SN") return "SN";
  return "序列号";
}

function isUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
