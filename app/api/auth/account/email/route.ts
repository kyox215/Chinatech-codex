import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseMode } from "@/lib/supabase/config";
import { authEmail, authFailure, AuthRequestError, preventAuthCaching, readAuthBody, requireSameOrigin } from "@/lib/supabase/server";
import { accountActionError, issueAccountIntent, requireAccountSession } from "@/lib/server/account-auth";

export async function POST(request: NextRequest) {
  if (!isSupabaseMode()) return authFailure(null, "邮箱修改未开放。", 404);
  const response = preventAuthCaching(NextResponse.json({ message: "请在当前浏览器分别打开原邮箱和新邮箱的确认邮件；全部确认后才会更换主邮箱。" }));
  try {
    const origin = requireSameOrigin(request); const body = await readAuthBody(request, ["email"]); const email = authEmail(body.email);
    const { supabase, user, identity } = await requireAccountSession(request, response, true);
    if (user.email?.toLowerCase() === email) throw new AuthRequestError("这已经是当前主邮箱。", 409);
    const intent = issueAccountIntent(response, identity, "email", email);
    const callback = new URL("/auth/account/callback", origin); callback.searchParams.set("intent", intent.nonce);
    const { data, error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: callback.toString() });
    accountActionError(error, "无法申请更换邮箱，请核对地址后重试。");
    if (data.user?.id !== identity.userId) throw new Error("Unexpected account update identity.");
    return response;
  } catch (reason) { return authFailure(reason, "邮箱修改暂不可用，请稍后重试。"); }
}
