export class CustomerMutationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "CustomerMutationError";
  }
}

export function customerVersionConflict() {
  return new CustomerMutationError(
    "客户资料已更新，请载入最新版本后重试",
    409,
    "CUSTOMER_STALE_VERSION",
  );
}

export function requireCustomerVersion(value: string | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) {
    throw new CustomerMutationError("缺少资料版本，请刷新后重试", 400, "CUSTOMER_VERSION_REQUIRED");
  }
  return value;
}
