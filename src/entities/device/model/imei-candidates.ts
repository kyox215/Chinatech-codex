import {
  extractImeiCandidates as extractIdentifierCandidates,
  type ImeiCandidate,
  type ImeiCaptureSource,
} from "@/features/capture/model/barcode-parser";

/**
 * Automatic device capture is intentionally IMEI-only. SN, EID, EAN and SKU
 * remain manual fields and must never be promoted by this recognition gate.
 */
export function extractValidImeiCandidates(
  rawValue: string,
  options: { source?: ImeiCaptureSource } = {},
): ImeiCandidate[] {
  const imeiOnlyEvidence = rawValue
    .split(/\r?\n/)
    .map((line) => selectImeiEvidence(line))
    .filter(Boolean)
    .join("\n");
  return extractIdentifierCandidates(imeiOnlyEvidence, {
    source: options.source,
    includeGenericSerial: false,
  }).filter(
    (candidate) =>
      candidate.kind === "imei" && candidate.isValidImei && /^\d{15}$/.test(candidate.value),
  );
}

function selectImeiEvidence(line: string) {
  if (!/\b(?:S\/N|SN|SERIAL(?:\s+(?:NUMBER|NO\.?))?|EID|ECID|EC|MEID)\b/i.test(line)) {
    return line;
  }

  return [
    ...line.matchAll(
      /\bIMEI\s*(?:1|2)?\b\s*(?:[:：#-])?\s*((?:\d[\s\-:：_.,/\\|]*){15})(?![\s\-:：_.,/\\|]*\d)/gi,
    ),
  ]
    .map((match) => `IMEI: ${match[1] ?? ""}`)
    .join("\n");
}

export function getPreferredValidImeiCandidate(candidates: readonly ImeiCandidate[]) {
  return candidates.find((candidate) => candidate.kind === "imei" && candidate.isValidImei) ?? null;
}
