export const BUYBACK_EVIDENCE_UPLOAD_MAX_BYTES = 2_400_000;
export const BUYBACK_EVIDENCE_UPLOAD_MAX_BASE64_LENGTH =
  Math.ceil(BUYBACK_EVIDENCE_UPLOAD_MAX_BYTES / 3) * 4;
export const HOSTED_FUNCTION_REQUEST_BODY_LIMIT_BYTES = 4_500_000;
export const BUYBACK_EVIDENCE_HOSTED_REQUEST_MAX_BYTES = 4_400_000;
export const BUYBACK_EVIDENCE_JSON_OVERHEAD_BYTES = 120_000;

/**
 * Production safety gate for the unfinished restricted-evidence lifecycle.
 *
 * Re-enabling this workflow requires a separately reviewed release that proves
 * the linked database migration, private storage policy, retention controls,
 * and end-to-end authorization checks are all live. Do not replace this with a
 * client-controlled or per-request flag.
 */
export const BUYBACK_SENSITIVE_WORKFLOW_ENABLED = false;
export const BUYBACK_SENSITIVE_WORKFLOW_DISABLED_MESSAGE =
  "回收敏感资料采集与成交暂时关闭，仍可保存报价和检测";

export function assertBuybackSensitiveWorkflowEnabled() {
  if (!BUYBACK_SENSITIVE_WORKFLOW_ENABLED) {
    throw new Error(BUYBACK_SENSITIVE_WORKFLOW_DISABLED_MESSAGE);
  }
}

export function estimatedBuybackEvidenceRequestBytes(fileBytes: number) {
  return Math.ceil(Math.max(0, fileBytes) / 3) * 4 + BUYBACK_EVIDENCE_JSON_OVERHEAD_BYTES;
}

export function fitsHostedBuybackEvidenceRequest(fileBytes: number) {
  return estimatedBuybackEvidenceRequestBytes(fileBytes) < HOSTED_FUNCTION_REQUEST_BODY_LIMIT_BYTES;
}
