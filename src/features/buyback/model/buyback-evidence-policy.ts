export const BUYBACK_EVIDENCE_UPLOAD_MAX_BYTES = 2_400_000;
export const BUYBACK_EVIDENCE_UPLOAD_MAX_BASE64_LENGTH =
  Math.ceil(BUYBACK_EVIDENCE_UPLOAD_MAX_BYTES / 3) * 4;
export const HOSTED_FUNCTION_REQUEST_BODY_LIMIT_BYTES = 4_500_000;
export const BUYBACK_EVIDENCE_HOSTED_REQUEST_MAX_BYTES = 4_400_000;
export const BUYBACK_EVIDENCE_JSON_OVERHEAD_BYTES = 120_000;

export function estimatedBuybackEvidenceRequestBytes(fileBytes: number) {
  return Math.ceil(Math.max(0, fileBytes) / 3) * 4 + BUYBACK_EVIDENCE_JSON_OVERHEAD_BYTES;
}

export function fitsHostedBuybackEvidenceRequest(fileBytes: number) {
  return estimatedBuybackEvidenceRequestBytes(fileBytes) < HOSTED_FUNCTION_REQUEST_BODY_LIMIT_BYTES;
}
