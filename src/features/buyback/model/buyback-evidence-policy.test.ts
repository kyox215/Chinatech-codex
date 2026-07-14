import { describe, expect, it } from "vitest";

import {
  assertBuybackSensitiveWorkflowEnabled,
  BUYBACK_EVIDENCE_HOSTED_REQUEST_MAX_BYTES,
  BUYBACK_EVIDENCE_UPLOAD_MAX_BASE64_LENGTH,
  BUYBACK_EVIDENCE_UPLOAD_MAX_BYTES,
  BUYBACK_SENSITIVE_WORKFLOW_DISABLED_MESSAGE,
  BUYBACK_SENSITIVE_WORKFLOW_ENABLED,
  estimatedBuybackEvidenceRequestBytes,
  fitsHostedBuybackEvidenceRequest,
  HOSTED_FUNCTION_REQUEST_BODY_LIMIT_BYTES,
} from "./buyback-evidence-policy";

describe("buyback evidence upload envelope", () => {
  it("keeps the compressed Base64 JSON request below the hosted function limit", () => {
    expect(BUYBACK_EVIDENCE_UPLOAD_MAX_BASE64_LENGTH).toBe(3_200_000);
    expect(BUYBACK_EVIDENCE_HOSTED_REQUEST_MAX_BYTES).toBeLessThan(
      HOSTED_FUNCTION_REQUEST_BODY_LIMIT_BYTES,
    );
    expect(fitsHostedBuybackEvidenceRequest(BUYBACK_EVIDENCE_UPLOAD_MAX_BYTES)).toBe(true);
    expect(estimatedBuybackEvidenceRequestBytes(BUYBACK_EVIDENCE_UPLOAD_MAX_BYTES)).toBeLessThan(
      HOSTED_FUNCTION_REQUEST_BODY_LIMIT_BYTES,
    );
    expect(fitsHostedBuybackEvidenceRequest(3_400_000)).toBe(false);
  });
});

describe("buyback sensitive workflow production gate", () => {
  it("is fail-closed with one stable non-sensitive message", () => {
    expect(BUYBACK_SENSITIVE_WORKFLOW_ENABLED).toBe(false);
    expect(() => assertBuybackSensitiveWorkflowEnabled()).toThrow(
      BUYBACK_SENSITIVE_WORKFLOW_DISABLED_MESSAGE,
    );
    expect(BUYBACK_SENSITIVE_WORKFLOW_DISABLED_MESSAGE).not.toMatch(
      /数据库|RPC|storage|Supabase|证件号|文件名/i,
    );
  });
});
