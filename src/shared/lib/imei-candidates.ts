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

export const IMEI_PATTERN = /^\d{14,17}$/;
export const SERIAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,63}$/;
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
