import path from "node:path";

// Set by playwright.config.ts once per invocation and inherited by workers.
// Historical relative labels are retained only beneath the current run directory.
const evidenceRoot =
  process.env.REPAIRDESK_E2E_EVIDENCE_ROOT ??
  path.resolve("test-results", "evidence", `${Date.now()}-${process.pid}`);
export function runEvidencePath(relativePath: string) {
  return path.join(evidenceRoot, relativePath);
}
