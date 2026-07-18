export type AiServiceErrorCode =
  | "AI_DISABLED"
  | "AI_NOT_AUTHORIZED"
  | "AI_INVALID_INPUT"
  | "AI_QUOTA_EXHAUSTED"
  | "AI_PROVIDER_PROTOCOL_ERROR"
  | "AI_PROVIDER_RATE_LIMITED"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_PROVIDER_TIMEOUT"
  | "AI_DEPENDENCY_UNAVAILABLE"
  | "AI_AUDIT_UNAVAILABLE"
  | "AI_MISCONFIGURED";

export class AiServiceError extends Error {
  constructor(
    message: string,
    readonly code: AiServiceErrorCode,
    readonly status: number,
    readonly details?: { retryable?: boolean },
  ) {
    super(message);
    this.name = "AiServiceError";
  }
}

export function aiDisabledError() {
  return new AiServiceError("AI 小助手当前未开放", "AI_DISABLED", 404, {
    retryable: false,
  });
}

export function aiNotAuthorizedError() {
  return new AiServiceError("当前账号不能使用这项 AI 功能", "AI_NOT_AUTHORIZED", 403, {
    retryable: false,
  });
}

export function aiProtocolError() {
  return new AiServiceError(
    "AI 返回格式无效，请继续使用手工查询",
    "AI_PROVIDER_PROTOCOL_ERROR",
    502,
    { retryable: true },
  );
}

export function aiProviderRateLimitedError() {
  return new AiServiceError(
    "AI 服务当前繁忙，请稍后重试或继续使用手工查询",
    "AI_PROVIDER_RATE_LIMITED",
    429,
    { retryable: true },
  );
}

export function aiProviderTimeoutError() {
  return new AiServiceError("AI 查询超时，请重试或继续使用手工查询", "AI_PROVIDER_TIMEOUT", 504, {
    retryable: true,
  });
}

export function aiProviderUnavailableError() {
  return new AiServiceError(
    "AI 服务暂时不可用，请继续使用手工查询",
    "AI_PROVIDER_UNAVAILABLE",
    503,
    { retryable: true },
  );
}

export function aiDependencyUnavailableError() {
  return new AiServiceError(
    "订单查询服务暂时不可用，请继续使用手工查询",
    "AI_DEPENDENCY_UNAVAILABLE",
    503,
    { retryable: true },
  );
}

export function aiAuditUnavailableError() {
  return new AiServiceError(
    "AI 安全审计暂时不可用，请继续使用手工查询",
    "AI_AUDIT_UNAVAILABLE",
    503,
    { retryable: true },
  );
}

export function aiQuotaExhaustedError() {
  return new AiServiceError(
    "当前门店今日 AI 查询次数已达上限，请继续使用手工查询",
    "AI_QUOTA_EXHAUSTED",
    429,
    { retryable: false },
  );
}
