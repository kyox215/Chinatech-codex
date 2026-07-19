import { createClient } from "@/utils/supabase/client";

export function lifecycleMfaRequired() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export async function verifyRecentLifecycleAal2(code: string) {
  if (!lifecycleMfaRequired()) return;
  if (!/^\d{6}$/.test(code)) throw new Error("请输入身份验证器中的 6 位安全验证码");
  const supabase = createClient();
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) throw new Error("读取账号安全验证方式失败");
  const factor = factors.totp.find((entry) => entry.status === "verified");
  if (!factor) throw new Error("当前账号还没有设置身份验证器，请先在账号设置中完成");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) throw new Error("安全验证码无效或已过期");
}
