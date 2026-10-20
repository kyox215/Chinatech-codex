import { observe, receiptObservationPhases } from "./request-observation";
const phases: ReadonlySet<string> = new Set(receiptObservationPhases);
// A fixed phase and finite numeric value only. Never attach source, identity,
// URL, document text, error objects or browser/context identifiers.
export function receiptMetric(phase: string, value: number) {
  if (!phases.has(phase) || !Number.isFinite(value) || value < 0) return;
  if (phase === "browser_reused" || phase === "cache_hit") observe("receipt_" + phase, 0, value);
  else observe("receipt_" + phase, value);
  if (process.env.RECEIPT_PHASE_METRICS !== "1") return;
  console.info("ct_receipt_phase", JSON.stringify({ phase, value: Math.round(value * 1000) / 1000 }));
}
export async function receiptPhase<T>(phase: string, run: () => Promise<T>) {
  const start = performance.now();
  try { return await run(); } finally { receiptMetric(phase, performance.now() - start); }
}
