import { CustomerMutationError, requireCustomerVersion } from "./customer-mutation-error";

/** Preserve the viewed microsecond string for CAS; generate a strictly later write value. */
export function nextCustomerWriteVersion(expected: string, now = Date.now()): string {
  requireCustomerVersion(expected);
  // Date.parse truncates fractional microseconds. The next full millisecond is
  // still greater than every possible fraction within the viewed millisecond.
  const value = new Date(Math.max(now, Date.parse(expected) + 1));
  if (!Number.isFinite(value.getTime())) {
    throw new CustomerMutationError("资料版本无效，请刷新后重试", 400, "CUSTOMER_VERSION_REQUIRED");
  }
  return value.toISOString();
}
