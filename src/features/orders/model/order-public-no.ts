export const repairOrderPublicNoPattern = /^R\d+$/;

export function isRepairOrderPublicNo(value: unknown): value is string {
  return typeof value === "string" && repairOrderPublicNoPattern.test(value);
}

export function normalizeGeneratedRepairOrderPublicNo(value: unknown) {
  if (isRepairOrderPublicNo(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return `R${String(value).padStart(7, "0")}`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeGeneratedRepairOrderPublicNo(record.generate_repair_order_public_no);
  }
  return undefined;
}

export function createFallbackRepairOrderPublicNo({
  now = new Date(),
  attempt = 0,
  entropy = Math.floor(Math.random() * 1000),
}: {
  now?: Date;
  attempt?: number;
  entropy?: number;
} = {}) {
  const timestamp = Math.max(0, now.getTime());
  const attemptSuffix = String(Math.max(0, attempt)).padStart(2, "0");
  const entropySuffix = String(Math.max(0, Math.floor(entropy)) % 1000).padStart(3, "0");
  return `R${timestamp}${attemptSuffix}${entropySuffix}`;
}

export function isRepairOrderPublicNoInsertError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /public_no/i.test(message) || /repair_orders_public_no/i.test(message);
}
