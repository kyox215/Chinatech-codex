export class AuthSubmissionError extends Error {
  constructor(message: string, readonly status: number, readonly uncertain = false) { super(message); }
}

type AuthAction = 'register' | 'login' | 'resend';
export async function submitAuth(action: AuthAction, body: unknown): Promise<{ message?: string; redirectTo?: string }> {
  let response: Response;
  try {
    response = await fetch('/api/auth/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(20000), body: JSON.stringify(body) });
  } catch { throw new AuthSubmissionError('请求结果尚未确认。请核对账号状态后重试，输入已保留。', 0, true); }
  let payload: { message?: string; redirectTo?: string };
  try { payload = await response.json(); } catch { throw new AuthSubmissionError('请求结果尚未确认。请核对账号状态后重试，输入已保留。', response.status, true); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new AuthSubmissionError('请求结果尚未确认。请核对账号状态后重试，输入已保留。', response.status, true);
  if (!response.ok) throw new AuthSubmissionError(typeof payload.message === 'string' ? payload.message : '认证服务暂不可用，请稍后重试。', response.status, response.status >= 500);
  return payload;
}
